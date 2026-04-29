// js/core/app.js — Router with lazy loading & error handling

const PAGE_ORDER = {
  login: 0,
  register: 1,
  contractor: 2,
  assessment: 3,
  operations: 4,
  admin: 5,
  audit: 6
};

const ROLE_LANDING = {
  contractor: 'contractor',
  operations: 'operations',
  assessor: 'assessment',
  admin: 'admin'
};

const ROLE_NAV = {
  contractor: new Set(['contractor', 'assessment', 'operations', 'audit']),
  operations: new Set(['operations', 'audit']),
  assessor: new Set(['assessment', 'audit']),
  admin: new Set(['contractor', 'assessment', 'operations', 'admin', 'audit'])
};

const NAV_PAGES = new Set(['contractor', 'assessment', 'operations', 'admin', 'audit']);

// Page HTML cache
const pageHtmlCache = new Map();

// Page module loaders (lazy)
const pageModules = {
  login: () => import('../pages/login.js'),
  register: () => import('../pages/register.js'),
  contractor: () => import('../pages/contractor.js'),
  assessment: () => import('../pages/assessment.js'),
  operations: () => import('../pages/operations.js'),
  admin: () => import('../pages/admin.js')
};

let currentPage = null;

async function showPage(name, replace = false) {
  try {
    const isInitial = currentPage === null;
    const goingRight = !isInitial && PAGE_ORDER[name] > PAGE_ORDER[currentPage];
    const animClass = isInitial ? 'entering' : (goingRight ? 'slide-in-right' : 'slide-in-left');

    currentPage = name;

    // Hide all pages and show the current one
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(`${name}-page`);
    if (!pageEl) throw new Error(`Page #${name}-page not found`);
    pageEl.classList.add('active');

    // Add animation class
    pageEl.classList.remove('entering', 'slide-in-right', 'slide-in-left');
    pageEl.classList.add(animClass);

    // Remove animation class after completion
    const removeAnim = () => pageEl.classList.remove(animClass);
    pageEl.addEventListener('animationend', removeAnim, { once: true });

    // JS module loading disabled (pages are embedded; modules not needed yet)

    // Update navigation
    const nav = document.getElementById('mainNav');
    nav.style.display = NAV_PAGES.has(name) ? 'flex' : 'none';

    if (NAV_PAGES.has(name)) {
      updateNav(name);
      startRealtime();
    } else {
      stopRealtime();
    }

    // Call page-specific init function
    const initFn = window[`${name}Init`];
    if (typeof initFn === 'function') {
      try {
        await initFn();
      } catch (err) {
        console.warn(`Page init error for ${name}:`, err);
      }
    }

    // Update URL
    const paths = {
      login: '/',
      register: '/register',
      contractor: '/contractor',
      assessment: '/assessment',
      operations: '/operations',
      admin: '/admin',
      audit: '/audit'
    };

    replace
      ? history.replaceState({ page: name }, '', paths[name] || '/')
      : history.pushState({ page: name }, '', paths[name] || '/');

  } catch (err) {
    console.error('Error showing page:', err);
    showToast('Failed to load page', 'error');
  }
}

function updateNav(activePage) {
  const navMap = {
    contractor: 'navContractor',
    assessment: 'navAssessment',
    operations: 'navOperations',
    admin: 'navUsers',
    audit: 'navAudit'
  };

  // Update active state
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  document.getElementById(navMap[activePage])?.classList.add('active');

  // Update user info
  const u = state.getUser();
  document.getElementById('navUser').textContent = u?.email || '';

  // Role-based visibility
  const allowed = ROLE_NAV[state.roleOf()] || ROLE_NAV.contractor;
  Object.entries(navMap).forEach(([page, linkId]) => {
    const link = document.getElementById(linkId);
    if (link) link.style.display = allowed.has(page) ? '' : 'none';
  });
}

// Popstate handler (browser back/forward)
window.addEventListener('popstate', e => {
  if (e.state?.page) showPage(e.state.page, true);
});

// Role picker for registration
function openRolePicker() {
  const modal = document.getElementById('rolePickerModal');
  if (modal) modal.classList.add('open');
}

function closeRolePicker() {
  const modal = document.getElementById('rolePickerModal');
  if (modal) modal.classList.remove('open');
}

function pickRegistrationRole(role) {
  sessionStorage.setItem('radp_reg_role', role);
  closeRolePicker();
  showPage('register');
}

// PWA Install
let deferredPrompt;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'block';
});

window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'none';
});

function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => {
    deferredPrompt = null;
    const btn = document.getElementById('installBtn');
    if (btn) btn.style.display = 'none';
  });
}

// Auth handlers
async function login() {
  const email = document.getElementById('loginEmail')?.value;
  const password = document.getElementById('loginPassword')?.value;
  const msg = document.getElementById('loginMsg');

  if (!email || !password) {
    if (msg) {
      msg.className = 'auth-msg error';
      msg.textContent = 'Please fill all fields.';
    }
    return;
  }

  try {
    if (msg) msg.className = 'auth-msg';

    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!data.access_token) {
      if (msg) {
        msg.className = 'auth-msg error';
        msg.textContent = 'Invalid email or password.';
      }
      return;
    }

    // Get user profile
    const profiles = await apiCall(`/user_profiles?id=eq.${data.user.id}&select=*`, {
      headers: { Authorization: `Bearer ${data.access_token}` }
    });
    const profile = profiles[0];

    if (!profile || profile.status === 'pending') {
      if (msg) {
        msg.className = 'auth-msg warning';
        msg.textContent = 'Your account is pending admin approval.';
      }
      return;
    }

    if (profile.status === 'rejected') {
      if (msg) {
        msg.className = 'auth-msg error';
        msg.textContent = 'Your account has been rejected. Contact admin.';
      }
      return;
    }

    // Success
    const role = profile.role || 'contractor';
    state.setUser({ id: data.user.id, email: data.user.email, ...profile }, data.access_token);
    showPage(ROLE_LANDING[role] || 'contractor');

  } catch (err) {
    console.error('Login error:', err);
    if (msg) {
      msg.className = 'auth-msg error';
      msg.textContent = err.message || 'Login failed. Try again.';
    }
  }
}

function logout() {
  stopRealtime();
  state.clearUser();
  showPage('login', true);
}

// Initialization
function init() {
  const path = window.location.pathname;

  if (state.getToken()) {
    const role = state.roleOf();
    const allowed = ROLE_NAV[role] || ROLE_NAV.contractor;
    let target;

    if (path.includes('assessment') && allowed.has('assessment')) target = 'assessment';
    else if (path.includes('operations') && allowed.has('operations')) target = 'operations';
    else if (path.includes('contractor') && allowed.has('contractor')) target = 'contractor';
    else if (path.includes('admin') && allowed.has('admin')) target = 'admin';
    else target = ROLE_LANDING[role] || 'contractor';

    showPage(target, true);
  } else {
    if (path.includes('register')) showPage('register', true);
    else showPage('login', true);
  }
}

// Start when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
