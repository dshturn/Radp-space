const express = require('express');
const axios = require('axios');
const cors = require('cors');
const pdf = require('html-pdf');
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
  let browser;
  try {
    const { assessmentId, docType = 'both' } = req.body;
    console.log(`[PDF] Starting generation for assessment ${assessmentId}, type: ${docType}`);
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: req.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`,
    };

    // Fetch all data
    console.log('[PDF] Fetching assessment data...');
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

    console.log(`[PDF] Data loaded: assessment=${assessment?.id}, personnel=${personnel.length}, equipment=${equipment.length}`);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    // Fetch equipment sub-components
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

    const docsByPersonnel = {};
    allPersonnelDocs.forEach(d => {
      if (!docsByPersonnel[d.personnel_id]) docsByPersonnel[d.personnel_id] = [];
      docsByPersonnel[d.personnel_id].push(d);
    });

    const kidsByParent = {};
    [...childItems, ...grandItems].forEach(c => { (kidsByParent[c.parent_id] = kidsByParent[c.parent_id] || []).push(c); });

    const today = new Date();
    const todayStr = today.toLocaleDateString('en-GB');
    const esc = s => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    // ── Build LoR HTML (same as frontend) ──
    const byRole = {};
    personnel.forEach(p => {
      const role = p.personnel?.position || 'Unassigned';
      if (!byRole[role]) byRole[role] = [];
      byRole[role].push(p);
    });

    let persRows = '';
    let pNum = 1;
    const roles = Object.keys(byRole).sort();
    roles.forEach(role => {
      persRows += `<tr><td colspan="11" style="background:#1e3a5f;color:white;font-weight:bold;padding:5px 4px;border:1px solid #bbb;">● ${esc(role)}</td></tr>`;
      byRole[role].forEach(p => {
        const per = p.personnel;
        const docs = docsByPersonnel[per.id] || [];
        if (!docs.length) {
          persRows += `<tr><td>${pNum++}</td><td>${esc(per?.full_name||'—')}</td><td>${esc(String(per?.years_experience||'—'))}</td><td>${esc(per?.position||'—')}</td><td>—</td><td>—</td><td class="ac"></td><td class="ac"></td><td class="ac"></td><td class="ac"></td><td class="ac"></td></tr>`;
        } else {
          docs.forEach((d, idx) => {
            persRows += `<tr><td>${idx === 0 ? pNum++ : ''}</td><td>${idx === 0 ? esc(per?.full_name||'—') : ''}</td><td>${idx === 0 ? esc(String(per?.years_experience||'—')) : ''}</td><td>${idx === 0 ? esc(per?.position||'—') : ''}</td><td>${esc(d.doc_type_name || '—')}</td><td>${esc(d.expiry_date || '—')}</td><td class="ac"></td><td class="ac"></td><td class="ac"></td><td class="ac"></td><td class="ac"></td></tr>`;
          });
        }
      });
    });

    const byType = {};
    rootItems.forEach(item => {
      const type = item.equipment_templates?.name || 'Equipment';
      if (!byType[type]) byType[type] = [];
      byType[type].push(item);
    });

    let equipRows = '';
    let eNum = 1;
    const itemName = it => esc(it?.equipment_templates?.name || it?.name || it?.model || '—');
    const itemType = it => esc(it?.equipment_templates?.name || 'Uncategorized');
    const types = Object.keys(byType).sort();
    types.forEach(type => {
      equipRows += `<tr><td colspan="11" style="background:#2d4a1e;color:white;font-weight:bold;padding:5px 4px;border:1px solid #bbb;">● ${type}</td></tr>`;
      byType[type].forEach(item => {
        const renderItem = (it, depth) => {
          const docs = it?.documents || [];
          const indent = depth === 0 ? '' : '&nbsp;'.repeat(depth * 4) + '└─ ';
          const label = indent + itemName(it);
          const numCell = depth === 0 ? String(eNum++) : '';
          const sn = esc(it?.serial_number || '—');
          if (!docs.length) {
            equipRows += `<tr><td>${numCell}</td><td>${sn}</td><td>${label}</td><td>—</td><td>—</td><td>—</td><td></td><td></td><td></td><td></td><td></td></tr>`;
          } else {
            docs.forEach((d, idx) => {
              equipRows += `<tr><td>${idx === 0 ? numCell : ''}</td><td>${idx === 0 ? sn : ''}</td><td>${idx === 0 ? label : ''}</td><td>${esc(d.document_types?.document_name || d.doc_type_name || '—')}</td><td>${esc(d.issue_date || '—')}</td><td>${esc(d.expiry_date || '—')}</td><td></td><td></td><td></td><td></td><td></td></tr>`;
            });
          }
          (kidsByParent[it.id] || []).forEach(child => renderItem(child, depth + 1));
        };
        renderItem(item, 0);
      });
    });

    // Collect documents based on docType filter
    const allDocs = [];
    if (docType === 'personnel' || docType === 'both') {
      personnel.forEach(p => {
        const per = p.personnel;
        const docs = docsByPersonnel[per.id] || [];
        docs.forEach(d => {
          allDocs.push({ type: 'personnel', ownerName: per.full_name, docName: d.doc_type_name, fileUrl: d.file_url, id: d.id });
        });
      });
    }
    if (docType === 'equipment' || docType === 'both') {
      rootItems.forEach(item => {
        const renderItem = (it) => {
          const docs = it?.documents || [];
          const name = it?.equipment_templates?.name || it?.name || it?.model || '—';
          docs.forEach(d => {
            allDocs.push({ type: 'equipment', ownerName: name, docName: d.document_types?.document_name || d.doc_type_name || '—', fileUrl: d.file_url, id: d.id });
          });
          (kidsByParent[it.id] || []).forEach(child => renderItem(child));
        };
        renderItem(item);
      });
    }

    const lorHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>LoR</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:16px;color:#000}h1{font-size:15px;text-align:center;margin-bottom:2px}.subtitle{text-align:center;font-size:10px;color:#444;margin-bottom:10px}h2{font-size:13px;margin:12px 0 8px;background:#1e3a5f;color:white;padding:8px 10px}.info-table{width:100%;border-collapse:collapse;margin-bottom:10px}.info-table td{padding:4px 8px;border:1px solid #bbb;font-size:11px}.info-table .lbl{font-weight:bold;background:#e8edf2;width:130px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th{padding:5px 4px;text-align:left;font-size:10px;border:1px solid #bbb}th.sp{background:#1e3a5f;color:white}th.as{background:#2d4a1e;color:white}td{padding:4px 4px;border:1px solid #ddd;font-size:10px}tr:nth-child(even) td{background:#f7f9f7}.ac{background:#f0f7ee}img{max-width:95%;height:auto;}@media print{body{margin:0}@page{size:A4 landscape;margin:8mm}}</style></head><body><h1>List of Readiness (LoR)</h1><div class="subtitle">Attachment to SMS Process 07.01</div><table class="info-table"><tr><td class="lbl">Service Provider</td><td><strong>${esc(assessment.company_name||'—')}</strong></td><td class="lbl">Date</td><td>${todayStr}</td></tr><tr><td class="lbl">Field/Well</td><td colspan="3">${esc(assessment.field_well||'—')}</td></tr><tr><td class="lbl">Type of Job</td><td colspan="3">${esc(assessment.type_of_job||'—')}</td></tr></table><table><thead><tr><th class="sp" colspan="6">Manpower</th><th class="as" colspan="5">Assessor</th></tr><tr><th class="sp">#</th><th class="sp">Name</th><th class="sp">Yrs Exp</th><th class="sp">Role</th><th class="sp">Doc</th><th class="sp">Expiry</th><th class="as">Unit</th><th class="as">Auditor</th><th class="as">Date</th><th class="as">Ready</th><th class="as">Comment</th></tr></thead><tbody>${persRows}<tr><th class="sp" colspan="6">Equipment</th><th class="as" colspan="5">Assessor</th></tr><tr><th class="sp">#</th><th class="sp">S/N</th><th class="sp">Description</th><th class="sp">Type</th><th class="sp">Issue</th><th class="sp">Expiry</th><th class="as">Unit</th><th class="as">Auditor</th><th class="as">Date</th><th class="as">Ready</th><th class="as">Comment</th></tr>${equipRows}</tbody></table></body></html>`;

    // Generate LoR PDF from HTML
    console.log('[PDF] Generating HTML to PDF...');
    const lorPdfPromise = new Promise((resolve, reject) => {
      const pdfOptions = {
        format: 'A4',
        orientation: 'landscape',
        margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' }
      };
      pdf.create(lorHtml, pdfOptions).toBuffer((err, buffer) => {
        if (err) return reject(err);
        resolve(buffer);
      });
    });

    const lorPdfBuffer = await lorPdfPromise;
    console.log(`[PDF] LoR PDF generated (${lorPdfBuffer.length} bytes), loading into pdf-lib...`);

    // Load LoR PDF into pdf-lib
    const mergedPdf = await PDFDocument.load(lorPdfBuffer);
    const lorPageCount = mergedPdf.getPageCount();
    let currentPageNum = lorPageCount + 1;
    console.log(`[PDF] LoR occupies ${lorPageCount} pages. Documents start at page ${currentPageNum}`);
    console.log(`[PDF] Processing ${allDocs.length} documents...`);

    // Track which document goes to which page
    const docPageMap = {};

    // Add document pages (images and PDFs)
    for (const doc of allDocs) {
      console.log(`[PDF] Processing: ${doc.type} - ${doc.ownerName} - ${doc.docName} (page ${currentPageNum})`);
      if (!doc.fileUrl) continue;
      docPageMap[doc.id] = currentPageNum;

      try {
        const docResponse = await axios.get(doc.fileUrl, { responseType: 'arraybuffer', timeout: 10000 });
        const docBuffer = Buffer.from(docResponse.data);

        if (doc.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          // Embed image
          let embeddedImage;
          if (doc.fileUrl.match(/\.png$/i)) {
            embeddedImage = await mergedPdf.embedPng(docBuffer);
          } else {
            embeddedImage = await mergedPdf.embedJpg(docBuffer);
          }

          const page = mergedPdf.addPage([595, 842]); // A4 portrait
          const { width, height } = embeddedImage.scale(1);
          const imgWidth = Math.min(width, 550);
          const imgHeight = (height * imgWidth) / width;
          page.drawImage(embeddedImage, {
            x: 20,
            y: Math.max(20, 842 - imgHeight - 20),
            width: imgWidth,
            height: imgHeight
          });

          // Add label with page number
          page.drawText(`[${doc.type.toUpperCase()}] ${doc.ownerName} — ${doc.docName}`, {
            x: 20,
            y: 800,
            size: 10,
            color: { r: 0, g: 0, b: 0 }
          });
          currentPageNum++;
        } else if (doc.fileUrl.match(/\.pdf$/i)) {
          // Merge PDF pages
          try {
            const srcPdf = await PDFDocument.load(docBuffer);
            const pageIndices = srcPdf.getPageIndices();
            const srcPages = await mergedPdf.copyPages(srcPdf, pageIndices);
            srcPages.forEach(page => mergedPdf.addPage(page));
            currentPageNum += pageIndices.length;
          } catch (pdfErr) {
            console.warn(`Failed to merge PDF ${doc.fileUrl}:`, pdfErr.message);
          }
        }
      } catch (fetchErr) {
        console.warn(`Failed to fetch document ${doc.fileUrl}:`, fetchErr.message);
      }
    }

    // Save merged PDF and send
    console.log('[PDF] Saving merged PDF...');
    const finalPdfBytes = await mergedPdf.save();
    console.log(`[PDF] Final PDF size: ${finalPdfBytes.length} bytes`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="LoR_${assessment.field_well || 'Assessment'}_${todayStr}.pdf"`);
    res.send(Buffer.from(finalPdfBytes));
    console.log('[PDF] PDF sent successfully');

  } catch (err) {
    console.error('PDF generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate PDF: ' + err.message });
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
