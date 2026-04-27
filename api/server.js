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
app.use(cors());
app.use(express.json());

// ── Health Check ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Test DB Connection ──
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'connected',
      timestamp: result.rows[0].now,
    });
  } catch (err) {
    console.error('DB connection error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── API Endpoints (Placeholder for now) ──
app.get('/api/assessments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assessments LIMIT 10');
    res.json(result.rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/check-expiries', async (req, res) => {
  try {
    // Placeholder: Check expiries logic
    res.json({ message: 'Check expiries endpoint', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
