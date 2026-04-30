const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Supabase Configuration ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// ── Middleware ──
app.use(cors({
  origin: ['https://sharek.aramco.com.sa', 'https://www.radp.space', 'https://radp.space', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:5000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Prefer'],
  exposedHeaders: ['Content-Range']
}));
app.use(express.json());

// ── Health Check ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Test Supabase Connection ──
app.get('/test-db', async (req, res) => {
  try {
    const response = await axios.get(`${SUPABASE_URL}/rest/v1/assessments?limit=1`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: req.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    res.json({
      status: 'connected',
      supabaseUrl: SUPABASE_URL,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Supabase connection error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Proxy: GET request to Supabase ──
app.get('/api', async (req, res) => {
  try {
    // Query parameter format: ?endpoint=/path?query=value
    if (!req.query.endpoint) {
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    let fullEndpoint = req.query.endpoint;

    // Split endpoint into path and query parts
    const [path, ...queryParts] = fullEndpoint.split('?');
    const endpointQuery = queryParts.length > 0 ? '?' + queryParts.join('?') : '';

    // Get other query parameters (from the main URL, not embedded in endpoint)
    const { endpoint, ...otherParams } = req.query;
    const otherQuery = new URLSearchParams(otherParams).toString();
    const finalQuery = endpointQuery + (otherQuery ? (endpointQuery ? '&' : '?') + otherQuery : '');

    // Determine full URL based on path format
    let url;
    if (path.startsWith('/auth/') || path.startsWith('/storage/')) {
      url = `${SUPABASE_URL}${path}${finalQuery}`;
    } else if (path.startsWith('/rest/v1/')) {
      url = `${SUPABASE_URL}${path}${finalQuery}`;
    } else {
      url = `${SUPABASE_URL}/rest/v1/${path}${finalQuery}`;
    }

    const response = await axios.get(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: req.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: req.headers.prefer || '',
      },
      responseType: path.startsWith('/storage/') ? 'arraybuffer' : 'json',
    });
    // Forward critical response headers (check both cases)
    const contentRange = response.headers['content-range'] || response.headers['Content-Range'];
    if (contentRange) {
      res.set('Content-Range', contentRange);
    }
    // Forward Content-Type for files
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    // Send binary data as-is for storage, JSON for REST
    if (path.startsWith('/storage/')) {
      res.send(response.data);
    } else {
      res.json(response.data);
    }
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

app.get('/api/*', async (req, res) => {
  try {
    let path = req.params[0];
    let query = new URLSearchParams(req.query).toString();

    // Handle query parameter format: ?endpoint=/assessments?...
    if (req.query.endpoint) {
      path = req.query.endpoint;
      // Remove 'endpoint' from query params
      const { endpoint, ...otherParams } = req.query;
      query = new URLSearchParams(otherParams).toString();
    }

    const url = `${SUPABASE_URL}/rest/v1/${path}${query ? '?' + query : ''}`;

    const response = await axios.get(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: req.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: req.headers.prefer || '',
      },
      responseType: path.startsWith('/storage/') ? 'arraybuffer' : 'json',
    });
    // Forward critical response headers (check both cases)
    const contentRange = response.headers['content-range'] || response.headers['Content-Range'];
    if (contentRange) {
      res.set('Content-Range', contentRange);
    }
    // Forward Content-Type for files
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    // Send binary data as-is for storage, JSON for REST
    if (path.startsWith('/storage/')) {
      res.send(response.data);
    } else {
      res.json(response.data);
    }
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

// ── Proxy: POST request to Supabase ──
app.post('/api', async (req, res) => {
  try {
    // Query parameter format: ?endpoint=/path?query=value
    if (!req.query.endpoint) {
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    let fullEndpoint = req.query.endpoint;

    // Split endpoint into path and query parts
    const [path, ...queryParts] = fullEndpoint.split('?');
    const endpointQuery = queryParts.length > 0 ? '?' + queryParts.join('?') : '';

    // Get other query parameters (from the main URL, not embedded in endpoint)
    const { endpoint, ...otherParams } = req.query;
    const otherQuery = new URLSearchParams(otherParams).toString();
    const finalQuery = endpointQuery + (otherQuery ? (endpointQuery ? '&' : '?') + otherQuery : '');

    // Determine full URL based on path format
    let url;
    if (path.startsWith('/auth/') || path.startsWith('/storage/')) {
      url = `${SUPABASE_URL}${path}${finalQuery}`;
    } else if (path.startsWith('/rest/v1/')) {
      url = `${SUPABASE_URL}${path}${finalQuery}`;
    } else {
      url = `${SUPABASE_URL}/rest/v1/${path}${finalQuery}`;
    }

    console.log('POST URL:', url);
    const response = await axios.post(url, req.body, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: req.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: req.headers.prefer || '',
      },
    });
    // Forward critical response headers (check both cases)
    const contentRange = response.headers['content-range'] || response.headers['Content-Range'];
    if (contentRange) {
      res.set('Content-Range', contentRange);
    }
    res.json(response.data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

app.post('/api/*', async (req, res) => {
  try {
    let path = req.params[0];
    let query = new URLSearchParams(req.query).toString();

    // Handle query parameter format: ?endpoint=/assessments?...
    if (req.query.endpoint) {
      path = req.query.endpoint;
      // Remove 'endpoint' from query params
      const { endpoint, ...otherParams } = req.query;
      query = new URLSearchParams(otherParams).toString();
    }

    const url = `${SUPABASE_URL}/rest/v1/${path}${query ? '?' + query : ''}`;

    const response = await axios.post(url, req.body, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: req.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: req.headers.prefer || '',
      },
    });
    // Forward critical response headers (check both cases)
    const contentRange = response.headers['content-range'] || response.headers['Content-Range'];
    if (contentRange) {
      res.set('Content-Range', contentRange);
    }
    res.json(response.data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

// ── Error Handler ──
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ──
app.listen(PORT, () => {
  console.log(`RADP API running on port ${PORT}`);
  console.log(`Database host: ${process.env.AZURE_DB_HOST}`);
});

module.exports = app;
