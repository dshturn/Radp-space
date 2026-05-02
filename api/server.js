const express = require('express');
const axios = require('axios');
const cors = require('cors');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
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
  origin: ['https://sharek.aramco.com.sa', 'https://www.radp.space', 'https://radp.space', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:5000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Prefer'],
  exposedHeaders: ['Content-Range']
}));
app.use(express.json({ limit: '5mb' }));

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
      console.error('[API] Missing endpoint parameter');
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    let fullEndpoint = req.query.endpoint;
    console.log('[API] GET request:', fullEndpoint);

    // Split endpoint into path and query parts
    const [path, ...queryParts] = fullEndpoint.split('?');
    const endpointQuery = queryParts.length > 0 ? '?' + queryParts.join('?') : '';

    // Get other query parameters (from the main URL, not embedded in endpoint)
    const { endpoint, ...otherParams } = req.query;
    const otherQuery = new URLSearchParams(otherParams).toString();
    const finalQuery = endpointQuery + (otherQuery ? (endpointQuery ? '&' : '?') + otherQuery : '');

    // Determine full URL based on path format
    let url;
    if (path.startsWith('/auth/') || path.startsWith('/storage/') || path.startsWith('/functions/')) {
      url = `${SUPABASE_URL}${path}${finalQuery}`;
    } else if (path.startsWith('/rest/v1/')) {
      url = `${SUPABASE_URL}${path}${finalQuery}`;
    } else {
      url = `${SUPABASE_URL}/rest/v1/${path}${finalQuery}`;
    }

    console.log('[API] Final URL:', url);
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
    console.log('[API] URL:', url);

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
    console.error('[API] GET error:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      url: err.config?.url
    });
    res.status(err.response?.status || 500).json({ error: err.message, details: err.response?.data });
  }
});

// ── Proxy: DELETE request to Supabase ──
app.delete('/api', async (req, res) => {
  try {
    if (!req.query.endpoint) {
      console.error('[API] Missing endpoint parameter');
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    let fullEndpoint = req.query.endpoint;
    console.log('[API] DELETE request:', fullEndpoint);

    // Split endpoint into path and query parts
    const [path, ...queryParts] = fullEndpoint.split('?');
    const endpointQuery = queryParts.length > 0 ? '?' + queryParts.join('?') : '';

    // Get other query parameters
    const { endpoint, ...otherParams } = req.query;
    const otherQuery = new URLSearchParams(otherParams).toString();
    const finalQuery = endpointQuery + (otherQuery ? (endpointQuery ? '&' : '?') + otherQuery : '');

    // Determine full URL
    let url;
    if (path.startsWith('/auth/') || path.startsWith('/storage/') || path.startsWith('/functions/')) {
      url = `${SUPABASE_URL}${path}${finalQuery}`;
    } else if (path.startsWith('/rest/v1/')) {
      url = `${SUPABASE_URL}${path}${finalQuery}`;
    } else {
      url = `${SUPABASE_URL}/rest/v1/${path}${finalQuery}`;
    }

    console.log('[API] DELETE Final URL:', url);
    const response = await axios.delete(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: req.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: req.headers.prefer || '',
      },
    });
    res.status(response.status).json(response.data || {});
  } catch (err) {
    console.error('[API] DELETE error:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      url: err.config?.url
    });
    res.status(err.response?.status || 500).json({ error: err.message, details: err.response?.data });
  }
});

app.delete('/api/*', async (req, res) => {
  try {
    let path = req.params[0];
    let query = new URLSearchParams(req.query).toString();

    if (req.query.endpoint) {
      path = req.query.endpoint;
      const { endpoint, ...otherParams } = req.query;
      query = new URLSearchParams(otherParams).toString();
    }

    const url = `${SUPABASE_URL}/rest/v1/${path}${query ? '?' + query : ''}`;
    console.log('[API] DELETE URL:', url);

    const response = await axios.delete(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: req.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: req.headers.prefer || '',
      },
    });
    res.status(response.status).json(response.data || {});
  } catch (err) {
    console.error('[API] DELETE error:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      url: err.config?.url
    });
    res.status(err.response?.status || 500).json({ error: err.message, details: err.response?.data });
  }
});

// ── Proxy: POST request to Supabase (for mutations other than assessment_personnel) ──
app.post('/api', async (req, res) => {
  try {
    if (!req.query.endpoint) {
      console.error('[API] Missing endpoint parameter');
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    let fullEndpoint = req.query.endpoint;
    console.log('[API] POST request:', fullEndpoint);

    // Split endpoint into path and query parts
    const [path, ...queryParts] = fullEndpoint.split('?');
    const endpointQuery = queryParts.length > 0 ? '?' + queryParts.join('?') : '';

    // Get other query parameters
    const { endpoint, ...otherParams } = req.query;
    const otherQuery = new URLSearchParams(otherParams).toString();
    const finalQuery = endpointQuery + (otherQuery ? (endpointQuery ? '&' : '?') + otherQuery : '');

    // Determine full URL
    let url;
    if (path.startsWith('/auth/') || path.startsWith('/storage/') || path.startsWith('/functions/')) {
      url = `${SUPABASE_URL}${path}${finalQuery}`;
    } else if (path.startsWith('/rest/v1/')) {
      url = `${SUPABASE_URL}${path}${finalQuery}`;
    } else {
      url = `${SUPABASE_URL}/rest/v1/${path}${finalQuery}`;
    }

    console.log('[API] POST Final URL:', url);
    const response = await axios.post(url, req.body, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: req.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: req.headers.prefer || '',
        'Content-Type': 'application/json',
      },
    });
    if (response.status >= 400) {
      console.warn(`[API] POST returned ${response.status}:`, fullEndpoint, response.data);
    }
    res.status(response.status).json(response.data || {});
  } catch (err) {
    const status = err.response?.status;
    console.error('[API] POST error:', {
      path: fullEndpoint,
      message: err.message,
      status,
      data: err.response?.data,
    });
    res.status(status || 500).json({ error: err.message, details: err.response?.data });
  }
});

// ── HTML to PDF conversion (for Generate LoR) ──
app.post('/api/generate-html-pdf', async (req, res) => {
  try {
    const { html } = req.body;
    if (!html) {
      console.error('[PDF] Missing HTML content in request body');
      return res.status(400).json({ error: 'Missing HTML content' });
    }

    console.log('[PDF] Converting HTML to PDF, size:', html.length, 'bytes');
    pdf.create(html, { format: 'A4', orientation: 'landscape' }).toBuffer((err, buffer) => {
      if (err) {
        console.error('[PDF] PDF generation error:', err.message, err.stack);
        return res.status(500).json({ error: err.message });
      }
      console.log('[PDF] Generated PDF', buffer.length, 'bytes');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="LoR_${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(buffer);
    });
  } catch (err) {
    console.error('[PDF] Error in /api/generate-html-pdf:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

// ── LoR PDF Generation (must be before /api catch-all) ──
app.post('/api/generate-lor-pdf', async (req, res) => {
  try {
    const { assessmentId, docType = 'both' } = req.body;
    console.log(`[PDF] Starting generation for assessment ${assessmentId}, type: ${docType}`);
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: req.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`,
    };

    // Fetch data
    console.log('[PDF] Fetching assessment data...');
    const [aRes, eRes, pRes] = await Promise.all([
      axios.get(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${assessmentId}`, { headers }),
      axios.get(`${SUPABASE_URL}/rest/v1/assessment_equipment?assessment_id=eq.${assessmentId}&select=*,equipment_items(id,serial_number,model,name,parent_id,equipment_templates(name),documents(*,document_types(document_name)))`, { headers }),
      axios.get(`${SUPABASE_URL}/rest/v1/assessment_personnel?assessment_id=eq.${assessmentId}&select=*,personnel(*)`, { headers })
    ]);

    const assessment = aRes.data[0];
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const equipment = eRes.data;
    const personnel = pRes.data;

    // Fetch documents only for personnel in this assessment
    let allPersonnelDocs = [];
    if (personnel.length) {
      const personnelIds = personnel.map(p => p.personnel.id).filter(Boolean);
      const pDocsRes = await axios.get(`${SUPABASE_URL}/rest/v1/personnel_documents?personnel_id=in.(${personnelIds.join(',')})&select=*`, { headers });
      allPersonnelDocs = pDocsRes.data || [];
    }

    console.log(`[PDF] Data: assessment=${assessment?.id}, personnel=${personnel.length}, equipment=${equipment.length}, docs=${allPersonnelDocs.length}`);

    // Deduplicate documents (remove exact duplicates)
    const seenDocs = new Set();
    const uniqueDocs = allPersonnelDocs.filter(d => {
      const key = `${d.personnel_id}:${d.doc_type_name}`;
      if (seenDocs.has(key)) return false;
      seenDocs.add(key);
      return true;
    });

    // Build document lookup
    const docsByPersonnel = {};
    uniqueDocs.forEach(d => {
      if (!docsByPersonnel[d.personnel_id]) docsByPersonnel[d.personnel_id] = [];
      docsByPersonnel[d.personnel_id].push(d);
    });

    // Deduplicate personnel by ID
    const seenPersonnelIds = new Set();
    const uniquePersonnel = personnel.filter(p => {
      const id = p.personnel?.id;
      if (seenPersonnelIds.has(id)) return false;
      seenPersonnelIds.add(id);
      return true;
    });

    const rootItems = equipment.map(e => e.equipment_items).filter(Boolean);
    const rootIds = rootItems.map(i => i.id);
    let childItems = [];
    if (rootIds.length) {
      const cRes = await axios.get(`${SUPABASE_URL}/rest/v1/equipment_items?dismissed=is.false&parent_id=in.(${rootIds.join(',')})&select=id,parent_id,serial_number,model,name,equipment_templates(name),documents(*,document_types(document_name))`, { headers });
      childItems = cRes.data;
    }
    const childIds = childItems.map(i => i.id);
    let grandItems = [];
    if (childIds.length) {
      const gcRes = await axios.get(`${SUPABASE_URL}/rest/v1/equipment_items?dismissed=is.false&parent_id=in.(${childIds.join(',')})&select=id,parent_id,serial_number,model,name,equipment_templates(name),documents(*,document_types(document_name))`, { headers });
      grandItems = gcRes.data;
    }

    const kidsByParent = {};
    [...childItems, ...grandItems].forEach(c => { (kidsByParent[c.parent_id] = kidsByParent[c.parent_id] || []).push(c); });

    const today = new Date().toLocaleDateString('en-GB');
    const esc = s => (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

    // Build personnel rows with document links
    let persRows = '';
    uniquePersonnel.forEach((p, idx) => {
      const per = p.personnel;
      const docs = docsByPersonnel[per.id] || [];
      if (!docs.length) {
        persRows += `<tr><td>${idx + 1}</td><td>${esc(per?.full_name||'—')}</td><td>${esc(per?.position||'—')}</td><td>—</td></tr>`;
      } else {
        docs.forEach((d, dIdx) => {
          const docName = d.doc_type_name || '—';
          const docLink = d.file_url ? `<a href="${d.file_url}" style="color:#0066cc;text-decoration:underline;">${esc(docName)}</a>` : esc(docName);
          persRows += `<tr><td>${dIdx === 0 ? idx + 1 : ''}</td><td>${dIdx === 0 ? esc(per?.full_name||'—') : ''}</td><td>${dIdx === 0 ? esc(per?.position||'—') : ''}</td><td>${docLink}</td></tr>`;
        });
      }
    });

    // Build equipment rows with document links
    let equipRows = '';
    const indentFor = depth => depth === 0 ? '' : '&nbsp;'.repeat(depth * 3) + '└ ';
    function renderEquipment(item, depth, idx) {
      const docs = item?.documents || [];
      const label = indentFor(depth) + esc(item?.equipment_templates?.name || item?.name || item?.model || '—');
      if (!docs.length) {
        equipRows += `<tr><td>${depth === 0 ? idx : ''}</td><td>${label}</td><td>—</td></tr>`;
      } else {
        docs.forEach((d, dIdx) => {
          const docName = d.document_types?.document_name || d.doc_type_name || '—';
          const docLink = d.file_url ? `<a href="${d.file_url}" style="color:#0066cc;text-decoration:underline;">${esc(docName)}</a>` : esc(docName);
          equipRows += `<tr><td>${dIdx === 0 && depth === 0 ? idx : ''}</td><td>${dIdx === 0 ? label : ''}</td><td>${docLink}</td></tr>`;
        });
      }
      (kidsByParent[item.id] || []).forEach(child => renderEquipment(child, depth + 1, idx));
    }
    rootItems.forEach((item, idx) => renderEquipment(item, 0, idx + 1));

    // Generate HTML LoR with document links
    const lorHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:11px;margin:16px;color:#000}h1{font-size:14px;margin:0 0 5px 0;font-weight:bold}p{margin:5px 0;font-size:10px}h2{font-size:11px;margin:10px 0 5px 0;background:#1e3a5f;color:white;padding:5px;font-weight:bold}table{width:100%;border-collapse:collapse;margin-bottom:10px}th{padding:4px;text-align:left;font-size:10px;border:1px solid #999;background:#e8e8e8;font-weight:bold}td{padding:4px;border:1px solid #ccc;font-size:10px}a{color:#0066cc;text-decoration:underline;cursor:pointer}</style></head><body><h1>List of Readiness</h1><p>Assessment: ${assessment.id} | ${assessment.company_name || '—'} | ${today}</p><h2>Personnel</h2><table><thead><tr><th>#</th><th>Name</th><th>Position</th><th>Document</th></tr></thead><tbody>${persRows || '<tr><td colspan="4" style="text-align:center;color:#999;">No personnel</td></tr>'}</tbody></table><h2>Equipment</h2><table><thead><tr><th>#</th><th>Equipment</th><th>Document</th></tr></thead><tbody>${equipRows || '<tr><td colspan="3" style="text-align:center;color:#999;">No equipment</td></tr>'}</tbody></table></body></html>`;

    console.log('[PDF] Generating LoR PDF from HTML...');
    pdf.create(lorHtml, { format: 'A4' }).toBuffer((err, buffer) => {
      if (err) {
        console.error('[PDF] Error:', err.message);
        return res.status(500).json({ error: err.message });
      }
      console.log('[PDF] Generated', buffer.length, 'bytes');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="LoR_${assessment.field_well || 'Assessment'}_${today}.pdf"`);
      res.send(buffer);
      console.log('[PDF] PDF sent');
    });

  } catch (err) {
    console.error('[PDF] Error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
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
    if (path.startsWith('/auth/') || path.startsWith('/storage/') || path.startsWith('/functions/')) {
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

// ── Proxy: PATCH request to Supabase ──
app.patch('/api', async (req, res) => {
  try {
    if (!req.query.endpoint) {
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    let fullEndpoint = req.query.endpoint;
    const [path, ...queryParts] = fullEndpoint.split('?');
    const endpointQuery = queryParts.length > 0 ? '?' + queryParts.join('?') : '';
    const { endpoint, ...otherParams } = req.query;
    const otherQuery = new URLSearchParams(otherParams).toString();
    const finalQuery = endpointQuery + (otherQuery ? (endpointQuery ? '&' : '?') + otherQuery : '');

    let url;
    if (path.startsWith('/auth/') || path.startsWith('/storage/') || path.startsWith('/functions/')) {
      url = `${SUPABASE_URL}${path}${finalQuery}`;
    } else if (path.startsWith('/rest/v1/')) {
      url = `${SUPABASE_URL}${path}${finalQuery}`;
    } else {
      url = `${SUPABASE_URL}/rest/v1/${path}${finalQuery}`;
    }

    console.log('[API] PATCH URL:', url);
    const response = await axios.patch(url, req.body, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: req.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: req.headers.prefer || '',
        'Content-Type': 'application/json',
      },
    });
    res.status(response.status).json(response.data || {});
  } catch (err) {
    console.error('[API] PATCH error:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      url: err.config?.url
    });
    res.status(err.response?.status || 500).json({ error: err.message, details: err.response?.data });
  }
});

app.patch('/api/*', async (req, res) => {
  try {
    let path = req.params[0];
    let query = new URLSearchParams(req.query).toString();

    if (req.query.endpoint) {
      path = req.query.endpoint;
      const { endpoint, ...otherParams } = req.query;
      query = new URLSearchParams(otherParams).toString();
    }

    const url = `${SUPABASE_URL}/rest/v1/${path}${query ? '?' + query : ''}`;
    console.log('[API] PATCH URL:', url);

    const response = await axios.patch(url, req.body, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: req.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: req.headers.prefer || '',
        'Content-Type': 'application/json',
      },
    });
    res.status(response.status).json(response.data || {});
  } catch (err) {
    console.error('[API] PATCH error:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      url: err.config?.url
    });
    res.status(err.response?.status || 500).json({ error: err.message, details: err.response?.data });
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
