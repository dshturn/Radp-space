// ═══════════════════ SHARED CONFIG & UTILITIES ═══════════════════

const SUPABASE_URL = 'https://fslleuedqlxpjnerruzt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGxldWVkcWx4cGpuZXJydXp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk5MzExOSwiZXhwIjoyMDkwNTY5MTE5fQ.oY_dihwgMimesUsvHSuKNoJEXTb3c7vuqWKzeH2pwg4';

const getToken   = () => localStorage.getItem('radp_token');
const getUser    = () => JSON.parse(localStorage.getItem('radp_user') || '{}');
const getHeaders = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

// ─── API fetch with 401 guard ───
async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    localStorage.removeItem('radp_token');
    localStorage.removeItem('radp_user');
    showPage('login');
    return null;
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ─── Modal close with animation ───
function closeModal(id) {
  const el  = document.getElementById(id);
  const box = el.querySelector('.modal-box, .modal-scroll');
  if (box) {
    box.style.animation = 'modalOut 0.2s cubic-bezier(0.22,1,0.36,1) both';
    setTimeout(() => { el.classList.remove('open'); box.style.animation = ''; }, 200);
  } else {
    el.classList.remove('open');
  }
}

// ─── List filtering ───
function filterCards(listId, query) {
  const q = query.toLowerCase();
  document.querySelectorAll(`#${listId} .app-card`).forEach(card => {
    card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function filterCheckboxList(listId, query) {
  const q = query.toLowerCase();
  document.querySelectorAll(`#${listId} .checkbox-item`).forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ─── Toggle helpers ───
function toggleCard(btn) {
  btn.closest('.app-card').classList.toggle('expanded');
}

function toggleSubCard(card) {
  card.classList.toggle('expanded');
}

function toggleGroup(header) {
  header.closest('.eq-group').classList.toggle('collapsed');
}

function toggleDocGroup(header) {
  header.closest('.doc-group').classList.toggle('collapsed');
}

// ─── Group status badges ───
function grpBadges(expired, expiring, ok) {
  const s = 'font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;';
  return [
    expired  > 0 ? `<span style="${s}background:#4c0519;color:#fda4af;">${expired} EXPIRED</span>`   : '',
    expiring > 0 ? `<span style="${s}background:#422006;color:#fbbf24;">${expiring} EXPIRING</span>` : '',
    ok       > 0 ? `<span style="${s}background:#14532d;color:#86efac;">${ok} READY</span>`          : '',
  ].join('');
}

// ─── Card animations ───
function animateNewEl(el) {
  if (!el) return;
  el.closest('.eq-group')?.classList.remove('collapsed');
  el.closest('.app-card, .sub-card, .sub-child-card')?.classList.add('expanded');
  el.closest('.doc-group')?.classList.remove('collapsed');
  el.classList.add('card-new');
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
}

function animateRemoveEl(el, fn) {
  if (!el) { fn(); return; }
  el.classList.add('card-removing');
  const h = el.getBoundingClientRect().height;
  el.style.height   = h + 'px';
  el.style.overflow = 'hidden';
  el.style.transition = [
    'height 0.32s cubic-bezier(0.22,1,0.36,1) 0.15s',
    'margin-top 0.32s cubic-bezier(0.22,1,0.36,1) 0.15s',
    'margin-bottom 0.32s cubic-bezier(0.22,1,0.36,1) 0.15s',
    'padding-top 0.32s cubic-bezier(0.22,1,0.36,1) 0.15s',
    'padding-bottom 0.32s cubic-bezier(0.22,1,0.36,1) 0.15s'
  ].join(', ');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.height        = '0';
    el.style.marginTop     = '0';
    el.style.marginBottom  = '0';
    el.style.paddingTop    = '0';
    el.style.paddingBottom = '0';
  }));
  setTimeout(fn, 500);
}

// ─── Document viewer ───
let _currentPdf = null, _pdfScale = 1;

async function openDoc(url) {
  const isImage = /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(url);
  const isPdf   = /\.pdf(\?|$)/i.test(url);
  const body    = document.getElementById('docViewerBody');
  const title   = document.getElementById('docViewerTitle');
  const dl      = document.getElementById('docViewerDownload');
  const box     = document.getElementById('docViewerBox');
  title.textContent = decodeURIComponent(url.split('/').pop().split('?')[0]);
  dl.href = url;
  box.style.top = '2.5vh'; box.style.left = '2.5vw';
  box.style.width = '95vw'; box.style.height = '95vh';
  document.getElementById('docViewerModal').style.display = 'block';
  body.innerHTML = `<div style="padding:32px;text-align:center;color:#94a3b8;">Loading…</div>`;
  try {
    const res     = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
    const blob    = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    dl.href = blobUrl; dl.download = title.textContent;
    document.getElementById('docZoomIn').style.display    = 'none';
    document.getElementById('docZoomOut').style.display   = 'none';
    document.getElementById('docZoomLevel').style.display = 'none';
    if (isImage) {
      body.innerHTML = `<img src="${blobUrl}" style="max-width:100%;display:block;margin:auto;padding:16px;">`;
    } else if (isPdf) {
      body.innerHTML = `<div id="pdfCanvas" style="padding:0;"></div>`;
      const arrayBuf = await blob.arrayBuffer();
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      _currentPdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
      _pdfScale   = body.clientWidth / (await _currentPdf.getPage(1)).getViewport({ scale: 1 }).width;
      await _renderPdf();
      document.getElementById('docZoomIn').style.display    = 'block';
      document.getElementById('docZoomOut').style.display   = 'block';
      document.getElementById('docZoomLevel').style.display = 'block';
    } else {
      body.innerHTML = `<div style="padding:32px;text-align:center;color:#94a3b8;">Preview not available.<br><br><a href="${blobUrl}" target="_blank" style="color:#38bdf8;">Open in new tab</a></div>`;
    }
  } catch(e) {
    body.innerHTML = `<div style="padding:32px;text-align:center;color:#fda4af;">Failed to load file.</div>`;
  }
}

async function _renderPdf() {
  const container = document.getElementById('pdfCanvas');
  if (!container || !_currentPdf) return;
  container.innerHTML = '';
  document.getElementById('docZoomLevel').textContent = Math.round(_pdfScale * 100) + '%';
  for (let i = 1; i <= _currentPdf.numPages; i++) {
    const page   = await _currentPdf.getPage(i);
    const vp     = page.getViewport({ scale: _pdfScale });
    const canvas = document.createElement('canvas');
    canvas.width  = vp.width;
    canvas.height = vp.height;
    canvas.style.cssText = 'display:block;margin:0 auto 4px;';
    container.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d', { willReadFrequently: true }), viewport: vp }).promise;
  }
}

async function zoomPdf(delta) {
  _pdfScale = Math.max(0.4, Math.min(5, _pdfScale + delta));
  await _renderPdf();
}

function closeDocViewer() {
  document.getElementById('docViewerModal').style.display = 'none';
  document.getElementById('docViewerBody').innerHTML = '';
  _currentPdf = null;
}

// ─── Doc viewer drag + resize ───
(function() {
  let mode = null, startX, startY, startL, startT, startW, startH;
  const MIN_W = 320, MIN_H = 240;

  document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('docViewerHeader');
    const box    = document.getElementById('docViewerBox');

    function getRect() {
      return { l: box.offsetLeft, t: box.offsetTop, w: box.offsetWidth, h: box.offsetHeight };
    }

    header.addEventListener('mousedown', e => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
      mode = 'drag';
      const r = getRect();
      startX = e.clientX; startY = e.clientY;
      startL = r.l; startT = r.t;
      header.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.querySelectorAll('.dv-resize').forEach(handle => {
      handle.addEventListener('mousedown', e => {
        mode = handle.dataset.dir;
        const r = getRect();
        startX = e.clientX; startY = e.clientY;
        startL = r.l; startT = r.t; startW = r.w; startH = r.h;
        e.preventDefault();
      });
    });

    document.addEventListener('mousemove', e => {
      if (!mode) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (mode === 'drag') {
        box.style.left = Math.max(0, startL + dx) + 'px';
        box.style.top  = Math.max(0, startT + dy) + 'px';
        return;
      }
      let l = startL, t = startT, w = startW, h = startH;
      if (mode.includes('e')) w = Math.max(MIN_W, startW + dx);
      if (mode.includes('s')) h = Math.max(MIN_H, startH + dy);
      if (mode.includes('w')) { w = Math.max(MIN_W, startW - dx); l = startL + startW - w; }
      if (mode.includes('n')) { h = Math.max(MIN_H, startH - dy); t = startT + startH - h; }
      box.style.left = l + 'px'; box.style.top = t + 'px';
      box.style.width = w + 'px'; box.style.height = h + 'px';
    });

    document.addEventListener('mouseup', () => {
      mode = null;
      header.style.cursor = 'grab';
    });
  });
})();
