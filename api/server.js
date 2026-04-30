const express = require('express');
const axios = require('axios');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const { PDFDocument: PdfLibDocument } = require('pdf-lib');
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
    res.status(response.status).json(response.data || {});
  } catch (err) {
    console.error('[API] POST error:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      url: err.config?.url
    });
    res.status(err.response?.status || 500).json({ error: err.message, details: err.response?.data });
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
    const [aRes, eRes, pRes, pDocsRes] = await Promise.all([
      axios.get(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${assessmentId}`, { headers }),
      axios.get(`${SUPABASE_URL}/rest/v1/assessment_equipment?assessment_id=eq.${assessmentId}&select=*,equipment_items(id,serial_number,model,name,parent_id,equipment_templates(name),documents(*,document_types(document_name)))`, { headers }),
      axios.get(`${SUPABASE_URL}/rest/v1/assessment_personnel?assessment_id=eq.${assessmentId}&select=*,personnel(*)`, { headers }),
      axios.get(`${SUPABASE_URL}/rest/v1/personnel_documents?select=*`, { headers })
    ]);

    const assessment = aRes.data[0];
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const equipment = eRes.data;
    const personnel = pRes.data;
    const allPersonnelDocs = pDocsRes.data || [];

    console.log(`[PDF] Data: assessment=${assessment?.id}, personnel=${personnel.length}, equipment=${equipment.length}, docs=${allPersonnelDocs.length}`);

    // Build document lookup
    const docsByPersonnel = {};
    allPersonnelDocs.forEach(d => {
      if (!docsByPersonnel[d.personnel_id]) docsByPersonnel[d.personnel_id] = [];
      docsByPersonnel[d.personnel_id].push(d);
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

    // Create PDF with pdfkit
    const doc = new PDFDocument({ size: 'A4', margin: 20 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    const today = new Date().toLocaleDateString('en-GB');

    // LoR Header
    doc.fontSize(16).font('Helvetica-Bold').text('List of Readiness', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Assessment: ${assessment.id} | ${assessment.company_name || '—'} | Field: ${assessment.field_well || '—'} | ${today}`, { align: 'left' });
    doc.moveDown(0.3);

    // Personnel section
    doc.fontSize(12).font('Helvetica-Bold').text('Personnel');
    doc.moveDown(0.2);

    const roles = {};
    personnel.forEach(p => {
      const role = p.personnel?.position || 'Unassigned';
      if (!roles[role]) roles[role] = [];
      roles[role].push(p);
    });

    let pNum = 1;
    Object.keys(roles).sort().forEach(role => {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a5f').text(`● ${role}`, { underline: false });
      doc.fillColor('black').fontSize(9).font('Helvetica');

      roles[role].forEach(p => {
        const per = p.personnel;
        const docs = docsByPersonnel[per.id] || [];
        const docText = docs.length ? docs.map(d => d.doc_type_name).join(', ') : '—';
        doc.text(`${pNum++}. ${per.full_name} (${per.position}) — ${docText}`);
      });
      doc.moveDown(0.2);
    });

    doc.moveDown(0.3);

    // Equipment section
    doc.fontSize(12).font('Helvetica-Bold').text('Equipment');
    doc.moveDown(0.2);

    const types = {};
    rootItems.forEach(item => {
      const type = item.equipment_templates?.name || 'Equipment';
      if (!types[type]) types[type] = [];
      types[type].push(item);
    });

    let eNum = 1;
    Object.keys(types).sort().forEach(type => {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2d4a1e').text(`● ${type}`, { underline: false });
      doc.fillColor('black').fontSize(9).font('Helvetica');

      const renderItem = (it, depth) => {
        const docs = it?.documents || [];
        const name = it?.equipment_templates?.name || it?.name || it?.model || '—';
        const indent = '  '.repeat(depth);
        const docText = docs.length ? docs.map(d => d.document_types?.document_name || d.doc_type_name).join(', ') : '—';
        doc.text(`${indent}${depth === 0 ? eNum++ + '. ' : ''}${name} (${it?.serial_number || '—'}) — ${docText}`);
        (kidsByParent[it.id] || []).forEach(child => renderItem(child, depth + 1));
      };
      types[type].forEach(item => renderItem(item, 0));
      doc.moveDown(0.2);
    });

    // Note: Document pages not added yet (future enhancement)
    // For now, just return the LoR table
    console.log('[PDF] LoR table complete, finalizing...');

    doc.end();

    doc.on('finish', () => {
      const finalBuffer = Buffer.concat(buffers);
      console.log(`[PDF] Generated ${finalBuffer.length} bytes`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="LoR_${assessment.field_well || 'Assessment'}_${today}.pdf"`);
      res.send(finalBuffer);
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
