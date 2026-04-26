import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SP_BASE_URL  = Deno.env.get('SHAREPOINT_BASE_URL') || 'https://sharek.aramco.com.sa/orgs/30002972/30037952';
const SP_USERNAME  = Deno.env.get('SHAREPOINT_USERNAME') || '';
const SP_PASSWORD  = Deno.env.get('SHAREPOINT_PASSWORD') || '';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const SP_LISTS = {
  ONWCOD: '0BEA2164-4ADD-45F8-B462-C838F331246C',
  OFFWCOD_WSD: '1CDF80FC-8319-4D5F-8186-437C9DDB2C7F',
  ONWSD: '259ACF29-2737-41CB-A8DD-C8692A9AAF1A'
};

// Get Form Digest token for SharePoint authentication
async function getFormDigest(): Promise<string | null> {
  try {
    const auth = btoa(`${SP_USERNAME}:${SP_PASSWORD}`);
    const res = await fetch(`${SP_BASE_URL}/_api/contextinfo`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json; odata=verbose',
        'Content-Type': 'application/json; odata=verbose'
      }
    });
    if (!res.ok) {
      console.error(`Form Digest error: ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data.d?.GetContextWebInformation?.FormDigestValue || null;
  } catch (err) {
    console.error('Form Digest fetch error:', err);
    return null;
  }
}

// Fetch contractor records from SharePoint list
async function fetchSharePointData(contractorName: string, listGuid: string, digest: string): Promise<any[]> {
  try {
    const escapedName = contractorName.replace(/'/g, "''");
    const filter = `Service_x0020_Provider eq '${escapedName}'`;
    const encodedFilter = encodeURIComponent(filter);
    const url = `${SP_BASE_URL}/_api/web/lists(guid'${listGuid}')/items?$filter=${encodedFilter}&$top=5000&$orderby=Modified desc`;

    const auth = btoa(`${SP_USERNAME}:${SP_PASSWORD}`);
    const res = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json; odata=verbose',
        'X-RequestDigest': digest
      }
    });

    if (!res.ok) {
      console.error(`SharePoint list fetch error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    return data.d?.results || [];
  } catch (err) {
    console.error('SharePoint fetch error:', err);
    return [];
  }
}

// Combine results from all three lists
async function fetchAllLists(contractorName: string, digest: string): Promise<any[]> {
  const results = await Promise.all([
    fetchSharePointData(contractorName, SP_LISTS.ONWCOD, digest),
    fetchSharePointData(contractorName, SP_LISTS.OFFWCOD_WSD, digest),
    fetchSharePointData(contractorName, SP_LISTS.ONWSD, digest)
  ]);
  return results.flat();
}

// Extract contract terms and renewal date from SharePoint data
function parseContractData(items: any[]): { terms: string; renewalDate: string | null } {
  if (!items.length) {
    return { terms: 'No contracts found in SharePoint', renewalDate: null };
  }

  const latest = items[0];
  const terms = `Status: ${latest.Status || 'Unknown'} · Type: ${latest.Assessment_x0020_Type || 'N/A'}`;
  // Note: renewal_date would need to be extracted from contract details in SharePoint
  // For now, using Modified date as reference
  const renewalDate = latest.Modified ? new Date(latest.Modified).toISOString().split('T')[0] : null;

  return { terms, renewalDate };
}

Deno.serve(async (req) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { contractorName } = await req.json();

    if (!contractorName) {
      return new Response(JSON.stringify({ error: 'contractorName is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check cache first (data less than 6 hours old)
    const { data: cached } = await supabase
      .from('sharepoint_cache')
      .select('*')
      .eq('contractor_name', contractorName)
      .gt('cached_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .order('cached_at', { ascending: false })
      .limit(1);

    if (cached && cached.length > 0) {
      return new Response(JSON.stringify({
        success: true,
        data: cached[0],
        source: 'cache'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get Form Digest for authentication
    const digest = await getFormDigest();
    if (!digest) {
      // Return cached data if available, even if stale
      const { data: staleCached } = await supabase
        .from('sharepoint_cache')
        .select('*')
        .eq('contractor_name', contractorName)
        .order('cached_at', { ascending: false })
        .limit(1);

      if (staleCached && staleCached.length > 0) {
        return new Response(JSON.stringify({
          success: true,
          data: staleCached[0],
          source: 'stale_cache',
          error: 'Could not authenticate with SharePoint, using cached data'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to authenticate with SharePoint',
        data: null
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch data from SharePoint
    const spData = await fetchAllLists(contractorName, digest);
    if (!spData.length) {
      // Return cached data if no results from SharePoint
      const { data: fallbackCached } = await supabase
        .from('sharepoint_cache')
        .select('*')
        .eq('contractor_name', contractorName)
        .order('cached_at', { ascending: false })
        .limit(1);

      if (fallbackCached && fallbackCached.length > 0) {
        return new Response(JSON.stringify({
          success: true,
          data: fallbackCached[0],
          source: 'fallback_cache',
          error: 'No data found in SharePoint, using cached data'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: false,
        error: 'No contracts found in SharePoint',
        data: null
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse contract data
    const { terms, renewalDate } = parseContractData(spData);
    const latest = spData[0];

    // Cache the result
    const cacheData = {
      contractor_name: contractorName,
      sharepoint_id: latest.ID,
      title: latest.Title,
      status: latest.Status,
      service_type: latest.Service_x0020_Type,
      contract_terms: terms,
      renewal_date: renewalDate,
      modified_at: latest.Modified
    };

    await supabase
      .from('sharepoint_cache')
      .upsert(cacheData, { onConflict: 'sharepoint_id' });

    return new Response(JSON.stringify({
      success: true,
      data: cacheData,
      source: 'sharepoint',
      cached_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Edge Function error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
