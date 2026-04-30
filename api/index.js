export default async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer, apikey');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(400).json({ error: 'Missing Supabase configuration' });
  }

  // Support both ?endpoint= (frontend format) and ?path= (legacy format)
  let path = req.query.endpoint || req.query.path;
  const method = req.query.method || req.method;

  if (!path) {
    return res.status(400).json({ error: 'Missing endpoint or path parameter' });
  }

  console.log('[PROXY] Incoming request:', { method, path, bodyType: typeof req.body, body: req.body });

  try {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
    };

    // Copy Authorization header if present
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    // Copy Prefer header if present
    if (req.headers.prefer) {
      headers['Prefer'] = req.headers.prefer;
    }

    // Determine full URL based on path format
    let restUrl;
    if (path.startsWith('/auth/')) {
      restUrl = `${supabaseUrl}${path}`;
    } else if (path.startsWith('/rest/v1/')) {
      restUrl = `${supabaseUrl}${path}`;
    } else {
      restUrl = `${supabaseUrl}/rest/v1${path}`;
    }

    // Build request body
    let body;
    if (method !== 'GET' && method !== 'HEAD') {
      if (typeof req.body === 'string') {
        body = req.body;
      } else if (req.body) {
        body = JSON.stringify(req.body);
      } else {
        body = undefined;
      }
    }

    console.log('[PROXY] Forwarding request:', { method, path: restUrl.split('?')[0], hasAuth: !!headers['Authorization'] });
    const response = await fetch(restUrl, {
      method,
      headers,
      body,
    });

    const responseBody = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    return res.status(response.status).send(responseBody);
  } catch (error) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    console.error('Proxy error:', error);
    return res.status(500).json({ error: error.message });
  }
};
