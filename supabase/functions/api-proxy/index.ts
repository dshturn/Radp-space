import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Prefer',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const url = new URL(req.url);

  // Extract the REST API path from the proxy URL
  const pathMatch = url.searchParams.get('path');
  const method = url.searchParams.get('method') || 'GET';

  if (!pathMatch) {
    return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  try {
    // Get authorization header from original request
    const authHeader = req.headers.get('Authorization');
    const preferHeader = req.headers.get('Prefer');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    if (preferHeader) {
      headers['Prefer'] = preferHeader;
    }

    // Build the full Supabase REST API URL
    const restUrl = `${SUPABASE_URL}/rest/v1${pathMatch}`;

    // Forward the request
    const forwardReq = new Request(restUrl, {
      method: method,
      headers: headers,
      body: method !== 'GET' && method !== 'HEAD' ? await req.text() : undefined,
    });

    const response = await fetch(forwardReq);
    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
