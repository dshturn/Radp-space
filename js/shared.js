// ═══════════════════ SHARED CONFIG & UTILITIES ═══════════════════

const SUPABASE_URL = 'https://fslleuedqlxpjnerruzt.supabase.co';
// SECURITY: Replace this with your ANON (public) key from Supabase dashboard.
// NEVER use the service_role key in client-side code — rotate it immediately at supabase.com.
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGxldWVkcWx4cGpuZXJydXp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk5MzExOSwiZXhwIjoyMDkwNTY5MTE5fQ.oY_dihwgMimesUsvHSuKNoJEXTb3c7vuqWKzeH2pwg4';

const getToken   = () => localStorage.getItem('radp_token');
const getUser    = () => JSON.parse(localStorage.getItem('radp_user') || '{}');
const getHeaders = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

// Escapes a value for safe insertion into HTML to prevent XSS.
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── API fetch with 401 guard and error surfacing ───
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (res.status === 401) {
      localStorage.removeItem('radp_token');
      localStorage.removeItem('radp_user');
      showPage('login');
      return null;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data?.message || data?.error || `Request failed (${res.status})`;
      showToast(msg, 'error');
      return null;
    }
    return Array.isArray(data) ? data : (data ? [data] : []);
  } catch {
    showToast('Network error — check your connection and try again.', 'error');
    return null;
  }
}


// ─── Modal open with focus management ───
function openModal(id) {
  const el = document.getElementById(id);
  el._triggerEl = document.activeElement;
  el.classList.add('open');
  // Move focus to first focusable element
  const focusable = () => [...el.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
  )];
  setTimeout(() => { const items = focusable(); if (items.length) items[0].focus(); }, 60);
  // Focus trap + Escape to close
  el._trapFocus = function(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeModal(id); return; }
    if (e.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  el.addEventListener('keydown', el._trapFocus);
}

// ─── Modal close with animation + focus return ───
function closeModal(id) {
  const el  = document.getElementById(id);
  if (el._trapFocus) { el.removeEventListener('keydown', el._trapFocus); el._trapFocus = null; }
  const box = el.querySelector('.modal-box, .modal-scroll');
  const trigger = el._triggerEl;
  el._triggerEl = null;
  if (box) {
    box.style.animation = 'modalOut 0.2s cubic-bezier(0.22,1,0.36,1) both';
    setTimeout(() => { el.classList.remove('open'); box.style.animation = ''; if (trigger) trigger.focus(); }, 200);
  } else {
    el.classList.remove('open');
    if (trigger) trigger.focus();
  }
}

// ─── List filtering ───
function filterCards(listId, query) {
  const q = query.toLowerCase();
  const list = document.getElementById(listId);
  if (!list) return;

  if (!q) {
    list.querySelectorAll('.eq-group').forEach(g => { g.classList.add('collapsed'); g.style.display = ''; });
    list.querySelectorAll('.app-card').forEach(c => c.style.display = '');
    return;
  }

  list.querySelectorAll('.app-card').forEach(card => {
    card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
  });

  list.querySelectorAll('.eq-group').forEach(group => {
    const hasMatch = [...group.querySelectorAll('.app-card')].some(c => c.style.display !== 'none');
    group.classList.toggle('collapsed', !hasMatch);
    group.style.display = hasMatch ? '' : 'none';
  });
}

function filterCheckboxList(listId, query) {
  const q = query.toLowerCase();
  document.querySelectorAll(`#${listId} .checkbox-item, #${listId} .item-row`).forEach(item => {
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
function grpBadges(expired, expiring, ok, missing = 0, review = 0) {
  return [
    missing  > 0 ? `<span class="gbadge gbadge-missing">${missing} MISSING</span>`   : '',
    review   > 0 ? `<span class="gbadge gbadge-awaiting">${review} AWAITING</span>`  : '',
    expired  > 0 ? `<span class="gbadge gbadge-expired">${expired} EXPIRED</span>`   : '',
    expiring > 0 ? `<span class="gbadge gbadge-expiring">${expiring} EXPIRING</span>` : '',
    ok       > 0 ? `<span class="gbadge gbadge-ready">${ok} READY</span>`            : '',
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
  el.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
  el.style.opacity = '0';
  el.style.transform = 'scale(0.95)';
  setTimeout(fn, 240);
}

// ─── Toast notifications ───
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast-show')));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── File upload validation ───
const UPLOAD_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function validateUploadFile(file) {
  if (!file) return false;
  if (!UPLOAD_ALLOWED_TYPES.includes(file.type)) {
    showToast('Only PDF, JPEG, PNG, or WebP files are allowed', 'warn');
    return false;
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    showToast('File must be smaller than 10 MB', 'warn');
    return false;
  }
  return true;
}

// ─── Confirm dialog ───
function showConfirm(message) {
  return new Promise(resolve => {
    document.getElementById('confirmMsgText').textContent = message;
    const modal = document.getElementById('confirmModal');
    openModal('confirmModal');
    const ok  = document.getElementById('confirmOk');
    const can = document.getElementById('confirmCancel');
    function finish(result) {
      if (modal._trapFocus) { modal.removeEventListener('keydown', modal._trapFocus); modal._trapFocus = null; }
      modal.classList.remove('open');
      if (modal._triggerEl) { modal._triggerEl.focus(); modal._triggerEl = null; }
      ok.onclick = null;
      can.onclick = null;
      resolve(result);
    }
    ok.onclick  = () => finish(true);
    can.onclick = () => finish(false);
  });
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
  const modal = document.getElementById('docViewerModal');
  modal.style.display = 'block';
  modal._dvEscHandler = (e) => { if (e.key === 'Escape') closeDocViewer(); };
  document.addEventListener('keydown', modal._dvEscHandler);
  body.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-2);">Loading…</div>`;
  try {
    const res     = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${getToken()}` } });
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
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = '/pdf.min.js'; s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      _currentPdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
      _pdfScale   = body.clientWidth / (await _currentPdf.getPage(1)).getViewport({ scale: 1 }).width;
      await _renderPdf();
      document.getElementById('docZoomIn').style.display    = 'block';
      document.getElementById('docZoomOut').style.display   = 'block';
      document.getElementById('docZoomLevel').style.display = 'block';
    } else {
      body.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-2);">Preview not available.<br><br><a href="${blobUrl}" target="_blank" style="color:var(--accent);">Open in new tab</a></div>`;
    }
  } catch(e) {
    body.innerHTML = `<div style="padding:32px;text-align:center;color:var(--bad);">Failed to load file.</div>`;
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
  const modal = document.getElementById('docViewerModal');
  modal.style.display = 'none';
  document.getElementById('docViewerBody').innerHTML = '';
  _currentPdf = null;
  if (modal._dvEscHandler) {
    document.removeEventListener('keydown', modal._dvEscHandler);
    modal._dvEscHandler = null;
  }
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
