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

// Update status in a SharePoint list
async function updateSharePointStatus(
  listGuid: string,
  itemId: number,
  newStatus: string,
  digest: string
): Promise<boolean> {
  try {
    const url = `${SP_BASE_URL}/_api/web/lists(guid'${listGuid}')/items(${itemId})`;
    const auth = btoa(`${SP_USERNAME}:${SP_PASSWORD}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json; odata=verbose',
        'Content-Type': 'application/json; odata=verbose',
        'X-HTTP-Method': 'MERGE',
        'If-Match': '*',
        'X-RequestDigest': digest
      },
      body: JSON.stringify({
        __metadata: { type: 'SP.ListItem' },
        Status: newStatus
      })
    });

    if (!res.ok) {
      console.error(`Update failed: ${res.status} - ${res.statusText}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Update error:', err);
    return false;
  }
}

// Try updating in all lists until one succeeds
async function updateStatusAllLists(
  itemId: number,
  newStatus: string,
  digest: string
): Promise<{ success: boolean; listUsed?: string }> {
  const listNames = Object.entries(SP_LISTS);
  for (const [name, guid] of listNames) {
    const success = await updateSharePointStatus(guid, itemId, newStatus, digest);
    if (success) {
      return { success: true, listUsed: name };
    }
  }
  return { success: false };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { assessmentId, sharepointId, newStatus } = await req.json();

    if (!assessmentId || !sharepointId || !newStatus) {
      return new Response(
        JSON.stringify({
          error: 'assessmentId, sharepointId, and newStatus are required'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get Form Digest
    const digest = await getFormDigest();
    if (!digest) {
      await supabase
        .from('assessments')
        .update({
          sharepoint_sync_status: 'failed',
          sharepoint_sync_error: 'Failed to get SharePoint Form Digest'
        })
        .eq('id', assessmentId);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to authenticate with SharePoint'
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Try updating in all lists
    const updateResult = await updateStatusAllLists(sharepointId, newStatus, digest);

    if (updateResult.success) {
      // Update assessment record with sync status
      await supabase
        .from('assessments')
        .update({
          sharepoint_sync_status: 'synced',
          sharepoint_sync_at: new Date().toISOString(),
          sharepoint_sync_error: null
        })
        .eq('id', assessmentId);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Status updated in SharePoint (list: ${updateResult.listUsed})`,
          data: { assessmentId, sharepointId, newStatus }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // Update assessment with error
      const errorMsg = 'Failed to update status in any SharePoint list';
      await supabase
        .from('assessments')
        .update({
          sharepoint_sync_status: 'failed',
          sharepoint_sync_error: errorMsg
        })
        .eq('id', assessmentId);

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
          retryable: true
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (err) {
    console.error('Edge Function error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
