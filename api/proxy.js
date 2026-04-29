export default async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  const { path, method } = req.query;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!path || !supabaseUrl || !supabaseKey) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

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

    const restUrl = `${supabaseUrl}/rest/v1${path}`;
    const body = method !== 'GET' && method !== 'HEAD' ? JSON.stringify(req.body) : undefined;

    const response = await fetch(restUrl, {
      method: method || 'GET',
      headers,
      body,
    });

    const responseBody = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    return res.status(response.status).send(responseBody);
  } catch (error) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
};
