// js/core/ui.js — UI helpers (toast, modal, utilities)

const toastContainer = document.getElementById('toastContainer') || (() => {
  const div = document.createElement('div');
  div.id = 'toastContainer';
  div.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
  document.body.appendChild(div);
  return div;
})();

function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;color:#fff;background:var(--surface-2,#1e293b);box-shadow:0 4px 16px rgba(0,0,0,0.4);opacity:0;transform:translateX(24px);transition:opacity 0.22s ease,transform 0.22s ease;max-width:320px;line-height:1.4;pointer-events:auto;`;

  if (type === 'success') toast.style.background = '#16a34a';
  if (type === 'error') toast.style.background = '#dc2626';
  if (type === 'warn') toast.style.background = '#d97706';
  if (type === 'info') toast.style.background = '#2563eb';

  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(24px)';
    setTimeout(() => toast.remove(), 220);
  }, duration);

  // Limit to 5 toasts
  while (toastContainer.children.length > 5) {
    toastContainer.firstChild.remove();
  }
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// Close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.open').forEach(m => {
      m.classList.remove('open');
    });
    document.body.style.overflow = '';
  }
});

// Utility: Debounce
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// Utility: Escape HTML
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Utility: Format date
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB');
}

// Utility: Days until expiry
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Utility: Status color
function statusColor(days) {
  if (days === null) return 'missing';
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'valid';
}
