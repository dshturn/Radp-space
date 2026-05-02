const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const SUPABASE_URL = 'https://fslleuedqlxpjnerruzt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGxldWVkcWx4cGpuZXJydXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTMxMTksImV4cCI6MjA5MDU2OTExOX0.H1narO5BF5uF2KwlKtKvioz3mun2ecxb1Lg_xVDLdt4';

const PUBLIC_DIR = path.join(__dirname, 'public');
const JS_DIR = path.join(__dirname, 'js');
const PORT = 3000;

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle proxy endpoint
  if (req.url.startsWith('/api/proxy')) {
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const path = parsedUrl.searchParams.get('path');
    const method = parsedUrl.searchParams.get('method') || 'GET';

    if (!path) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing path parameter' }));
      return;
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      };

      if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
      }

      if (req.headers.prefer) {
        headers['Prefer'] = req.headers.prefer;
      }

      const restUrl = `${SUPABASE_URL}/rest/v1${path}`;
      let body = '';

      if (method !== 'GET' && method !== 'HEAD') {
        body = await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', chunk => data += chunk);
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
      }

      const fetchRes = await fetch(restUrl, {
        method,
        headers,
        body: body || undefined,
      });

      const responseBody = await fetchRes.text();
      res.writeHead(fetchRes.status, { 'Content-Type': 'application/json' });
      res.end(responseBody);
    } catch (error) {
      console.error('Proxy error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // Serve static files from public or js directory
  let filePath;
  if (req.url.startsWith('/js/')) {
    filePath = path.join(JS_DIR, req.url.slice(4));
  } else {
    filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  }

  // Remove query parameters from the file path
  filePath = filePath.split('?')[0];

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Try index.html for directory requests
      if (req.url.endsWith('/') || !path.extname(filePath)) {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data2);
          }
        });
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Local server running at http://localhost:${PORT}`);
  console.log(`Serving files from: ${PUBLIC_DIR}`);
  console.log(`Proxying API calls to Supabase via /api/proxy`);
});
