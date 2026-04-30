const express = require('express');
const axios = require('axios');
const cors = require('cors');
const PDFDocument = require('pdfkit');
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
    if (path.startsWith('/auth/') || path.startsWith('/storage/') || path.startsWith('/functions/')) {
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

// ── LoR PDF Generation (must be before /api catch-all) ──
app.post('/api/generate-lor-pdf', async (req, res) => {
  try {
    const { assessmentId } = req.body;
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: req.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`,
    };

    // Fetch assessment + personnel + equipment data (same as generateLoR)
    const [aRes, eRes, pRes, pDocsRes] = await Promise.all([
      axios.get(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${assessmentId}`, { headers }),
      axios.get(`${SUPABASE_URL}/rest/v1/assessment_equipment?assessment_id=eq.${assessmentId}&select=*,equipment_items(id,serial_number,model,name,parent_id,equipment_templates(name),documents(*,document_types(document_name)))`, { headers }),
      axios.get(`${SUPABASE_URL}/rest/v1/assessment_personnel?assessment_id=eq.${assessmentId}&select=*,personnel(*)`, { headers }),
      axios.get(`${SUPABASE_URL}/rest/v1/personnel_documents?select=*`, { headers })
    ]);

    const assessment = aRes.data[0];
    const equipment = eRes.data;
    const personnel = pRes.data;
    const allPersonnelDocs = pDocsRes.data || [];

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Fetch equipment sub-components
    const rootItems = equipment.map(e => e.equipment_items).filter(Boolean);
    const rootIds = rootItems.map(i => i.id);
    let childItems = [];
    if (rootIds.length) {
      const cRes = await axios.get(
        `${SUPABASE_URL}/rest/v1/equipment_items?dismissed=is.false&parent_id=in.(${rootIds.join(',')})&select=id,parent_id,serial_number,model,name,equipment_templates(name),documents(*,document_types(document_name))`,
        { headers }
      );
      childItems = cRes.data;
    }
    const childIds = childItems.map(i => i.id);
    let grandItems = [];
    if (childIds.length) {
      const gcRes = await axios.get(
        `${SUPABASE_URL}/rest/v1/equipment_items?dismissed=is.false&parent_id=in.(${childIds.join(',')})&select=id,parent_id,serial_number,model,name,equipment_templates(name),documents(*,document_types(document_name))`,
        { headers }
      );
      grandItems = gcRes.data;
    }

    // Build document map by person/equipment
    const docsByPersonnel = {};
    allPersonnelDocs.forEach(d => {
      if (!docsByPersonnel[d.personnel_id]) docsByPersonnel[d.personnel_id] = [];
      docsByPersonnel[d.personnel_id].push(d);
    });

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 16 });
    const pdfStream = res;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="LoR_${assessment.field_well || 'Assessment'}_${new Date().toISOString().split('T')[0]}.pdf"`);
    doc.pipe(pdfStream);

    // ── TOC placeholders (will update later) ──
    const tocEntries = [];

    // ── Title ──
    doc.fontSize(18).font('Helvetica-Bold').text('List of Readiness (LoR)', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Attachment to SMS Process 07.01', { align: 'center' });
    doc.moveDown(0.5);

    // ── Assessment Info ──
    doc.fontSize(11).font('Helvetica-Bold').text('Assessment Details', { underline: true });
    doc.fontSize(10).font('Helvetica');
    doc.text(`Service Provider: ${assessment.company_name || '—'}`);
    doc.text(`Field / Well: ${assessment.field_well || '—'}`);
    doc.text(`Type of Job: ${assessment.type_of_job || '—'}`);
    doc.text(`Date Issued: ${new Date().toLocaleDateString('en-GB')}`);
    doc.moveDown(1);

    // ── Personnel Section ──
    const perPage = doc.y;
    tocEntries.push({ title: 'Personnel', page: null }); // Will update
    doc.fontSize(12).font('Helvetica-Bold').text('Personnel Roster', { underline: true });
    doc.moveDown(0.3);

    const byRole = {};
    personnel.forEach(p => {
      const role = p.personnel?.position || 'Unassigned';
      if (!byRole[role]) byRole[role] = [];
      byRole[role].push(p);
    });

    const roles = Object.keys(byRole).sort();
    doc.fontSize(9);
    roles.forEach(role => {
      doc.font('Helvetica-Bold').text(`● ${role}`, { underline: true });
      byRole[role].forEach(p => {
        const per = p.personnel;
        const docs = docsByPersonnel[per.id] || [];
        doc.font('Helvetica');
        doc.text(`${per?.full_name || '—'} (${per?.position || '—'}, ${per?.years_experience || 0} yrs)`);
        if (docs.length) {
          docs.forEach(d => {
            doc.text(`  • ${d.doc_type_name || '—'} (expires: ${d.expiry_date || '—'})`, { indent: 20 });
          });
        } else {
          doc.text('  (no documents)', { indent: 20, color: '#666' });
        }
      });
      doc.moveDown(0.2);
    });
    doc.moveDown(0.5);

    // ── Equipment Section ──
    tocEntries.push({ title: 'Equipment', page: null });
    doc.fontSize(12).font('Helvetica-Bold').text('Equipment Roster', { underline: true });
    doc.moveDown(0.3);

    const kidsByParent = {};
    [...childItems, ...grandItems].forEach(c => {
      (kidsByParent[c.parent_id] = kidsByParent[c.parent_id] || []).push(c);
    });

    const byType = {};
    rootItems.forEach(item => {
      const type = item.equipment_templates?.name || 'Equipment';
      if (!byType[type]) byType[type] = [];
      byType[type].push(item);
    });

    const types = Object.keys(byType).sort();
    doc.fontSize(9);
    types.forEach(type => {
      doc.font('Helvetica-Bold').text(`● ${type}`, { underline: true });
      byType[type].forEach(item => {
        const renderItem = (it, depth) => {
          const indent = depth * 15;
          const docs = it?.documents || [];
          const name = it?.equipment_templates?.name || it?.name || it?.model || '—';
          doc.font('Helvetica').text(`${name} (S/N: ${it?.serial_number || '—'})`, { indent });
          if (docs.length) {
            docs.forEach(d => {
              doc.text(`  • ${d.document_types?.document_name || d.doc_type_name || '—'} (expires: ${d.expiry_date || '—'})`, { indent: indent + 20 });
            });
          }
          (kidsByParent[it.id] || []).forEach(child => renderItem(child, depth + 1));
        };
        renderItem(item, 0);
      });
      doc.moveDown(0.2);
    });
    doc.moveDown(1);

    // ── Documents Section ──
    tocEntries.push({ title: 'Certificate Documents', page: null });
    doc.addPage();
    doc.fontSize(12).font('Helvetica-Bold').text('Certificate Documents', { underline: true });
    doc.moveDown(0.5);

    // Collect all documents
    const allDocs = [];
    personnel.forEach(p => {
      const per = p.personnel;
      const docs = docsByPersonnel[per.id] || [];
      docs.forEach(d => {
        allDocs.push({
          type: 'personnel',
          ownerName: per.full_name,
          docName: d.doc_type_name,
          fileUrl: d.file_url,
          id: d.id
        });
      });
    });

    rootItems.forEach(item => {
      const renderItem = (it) => {
        const docs = it?.documents || [];
        const name = it?.equipment_templates?.name || it?.name || it?.model || '—';
        docs.forEach(d => {
          allDocs.push({
            type: 'equipment',
            ownerName: name,
            docName: d.document_types?.document_name || d.doc_type_name || '—',
            fileUrl: d.file_url,
            id: d.id
          });
        });
        (kidsByParent[it.id] || []).forEach(child => renderItem(child));
      };
      renderItem(item);
    });

    // List documents with links (embedded or referenced)
    if (allDocs.length) {
      doc.fontSize(9).font('Helvetica');
      allDocs.forEach((d, idx) => {
        const docLabel = `${idx + 1}. [${d.type.toUpperCase()}] ${d.ownerName} — ${d.docName}`;
        if (d.fileUrl) {
          doc.fillColor('blue').text(docLabel, { link: d.fileUrl, underline: true });
          doc.fillColor('black');
        } else {
          doc.text(docLabel);
        }
      });
    } else {
      doc.fontSize(9).text('No documents attached.', { color: '#666' });
    }

    // Finalize PDF
    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate PDF' });
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
