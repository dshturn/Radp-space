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
  origin: ['https://sharek.aramco.com.sa', 'http://localhost:3000', 'http://localhost:5000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey']
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
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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
app.get('/api/*', async (req, res) => {
  try {
    const path = req.params[0];
    const query = new URLSearchParams(req.query).toString();
    const url = `${SUPABASE_URL}/rest/v1/${path}${query ? '?' + query : ''}`;

    const response = await axios.get(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    res.json(response.data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

// ── Proxy: POST request to Supabase ──
app.post('/api/*', async (req, res) => {
  try {
    const path = req.params[0];
    const query = new URLSearchParams(req.query).toString();
    const url = `${SUPABASE_URL}/rest/v1/${path}${query ? '?' + query : ''}`;

    const response = await axios.post(url, req.body, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });
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
