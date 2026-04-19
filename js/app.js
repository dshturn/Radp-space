// ═══════════════════ ROUTING ═══════════════════

const PAGE_ORDER = { home: 0, login: 1, register: 2, 'admin-login': 3, contractor: 4, assessment: 5, operations: 6, 'admin-dashboard': 7 };
const PAGE_URLS  = { home: '/', login: '/login', register: '/register', 'admin-login': '/admin', contractor: '/contractor', assessment: '/assessment', operations: '/operations', 'admin-dashboard': '/admin/dashboard' };
const NAV_PAGES  = new Set(['contractor', 'assessment', 'operations']);

// Role → landing page after login, and which nav tabs are visible
const ROLE_LANDING = { contractor: 'contractor', operations: 'operations', assessor: 'assessment' };
const ROLE_NAV     = {
  contractor: new Set(['contractor', 'assessment', 'operations']),
  operations: new Set(['operations']),
  assessor:   new Set(['assessment']),
};

function roleOf(user) {
  return (user && user.role) || 'contractor';
}

// Home → login, remembering the role the user picked so we can show the right subtitle
// and reject mismatches after auth.
function selectRole(role) {
  sessionStorage.setItem('radp_intent', role);
  const sub = document.getElementById('loginRoleSubtitle');
  if (sub) {
    sub.textContent = role === 'operations' ? 'Operations portal'
                    : role === 'assessor'   ? 'Assessments portal'
                    : 'Contractor portal';
  }
  const link = document.getElementById('loginRegisterLink');
  if (link) {
    link.textContent = role === 'contractor'
      ? 'New contractor? Register here'
      : 'New user? Register here';
  }
  showPage('login');
}

// Swap register form between contractor variant (company + service line)
// and operations/assessor variant (Aramco username only). Source of truth is
// sessionStorage.radp_intent, set when the user picks a tile on the home page.
function configureRegisterForm() {
  const intent = sessionStorage.getItem('radp_intent') || 'contractor';
  const isContractor = intent === 'contractor';

  const contractorFields = document.getElementById('regContractorFields');
  if (contractorFields) contractorFields.style.display = isContractor ? '' : 'none';

  const aramcoWrap = document.getElementById('regAramcoUsernameWrap');
  if (aramcoWrap) aramcoWrap.style.display = isContractor ? 'none' : 'block';

  const subtitle = document.getElementById('regRoleSubtitle');
  if (subtitle) {
    subtitle.textContent = intent === 'operations' ? 'Create your Operations account'
                         : intent === 'assessor'   ? 'Create your Assessments account'
                         :                           'Create your contractor account';
  }

  const emailLabel = document.getElementById('regEmailLabel');
  const emailInput = document.getElementById('regEmail');
  if (emailLabel) emailLabel.textContent = isContractor ? 'Email' : 'Aramco Email';
  if (emailInput) emailInput.placeholder = isContractor ? 'you@company.com' : 'you@aramco.com';
}

let currentPage  = null;

function showPage(name, replace = false) {
  const isInitial  = currentPage === null;
  const goingRight = !isInitial && PAGE_ORDER[name] > PAGE_ORDER[currentPage];
  const animClass  = isInitial ? 'entering' : (goingRight ? 'slide-in-right' : 'slide-in-left');
  currentPage = name;

  document.querySelectorAll('.page').forEach(p =>
    p.classList.remove('active', 'entering', 'slide-in-right', 'slide-in-left'));
  const page = document.getElementById(name + '-page');
  page.classList.add('active', animClass);
  page.addEventListener('animationend', () => page.classList.remove(animClass), { once: true });

  const nav = document.getElementById('mainNav');
  nav.style.display = NAV_PAGES.has(name) ? 'flex' : 'none';
  if (NAV_PAGES.has(name)) {
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const navMap = { contractor: 'navContractor', assessment: 'navAssessment', operations: 'navOperations' };
    document.getElementById(navMap[name])?.classList.add('active');
    const u = getUser();
    document.getElementById('navUser').textContent = u.email || '';

    // Role-based tab visibility: operations users see only Operations, assessors only Assessments.
    const allowed = ROLE_NAV[roleOf(u)] || ROLE_NAV.contractor;
    Object.entries(navMap).forEach(([page, linkId]) => {
      const link = document.getElementById(linkId);
      if (link) link.style.display = allowed.has(page) ? '' : 'none';
    });

    if (name === 'contractor') {
      document.getElementById('welcomeMsg').textContent  = `Welcome, ${u.full_name || 'Contractor'}`;
      document.getElementById('companyInfo').textContent = `${u.company || ''} · ${u.service_line || ''}`;
    }
  }

  replace
    ? history.replaceState({ page: name }, '', PAGE_URLS[name])
    : history.pushState({ page: name }, '', PAGE_URLS[name]);

  if (name === 'contractor') { loadEquipment(); loadPersonnel(); loadDashAssessments(); }
  if (name === 'assessment') { loadAssessments(); }
  if (name === 'operations') { loadOperations(); }
  if (name === 'register')   { loadRegisterOptions(); }
}

window.addEventListener('popstate', e => { if (e.state?.page) showPage(e.state.page, true); });

// ═══════════════════ DEBOUNCED SEARCH ═══════════════════

document.addEventListener('DOMContentLoaded', () => {
  const persSearch  = document.getElementById('personnelSearch');
  const equipSearch = document.getElementById('equipmentSearch');

  if (persSearch) {
    const debouncedPersSearch = debounce(q => { _persSearch = q.trim(); _persPage = 0; loadPersonnel(); }, 300);
    persSearch.addEventListener('input', e => debouncedPersSearch(e.target.value));
    persSearch.removeAttribute('oninput');
  }
  if (equipSearch) {
    const debouncedEquipSearch = debounce(q => { _equipSearch = q.trim(); _equipPage = 0; loadEquipment(); }, 300);
    equipSearch.addEventListener('input', e => debouncedEquipSearch(e.target.value));
    equipSearch.removeAttribute('oninput');
  }
});

// ═══════════════════ CONTRACTOR TABS ═══════════════════

const CT_ORDER = { personnel: 0, equipment: 1 };

function showContractorTab(tab, el) {
  const current    = document.querySelector('#contractor-page .ct-section.active')?.id?.replace('ct-', '') || 'equipment';
  const goingRight = CT_ORDER[tab] > CT_ORDER[current];
  const animClass  = goingRight ? 'slide-in-right' : 'slide-in-left';
  document.querySelectorAll('#contractor-page .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#contractor-page .ct-section').forEach(s => s.classList.remove('active', 'slide-in-right', 'slide-in-left'));
  el.classList.add('active');
  const section = document.getElementById('ct-' + tab);
  section.classList.add('active', animClass);
  section.addEventListener('animationend', () => section.classList.remove(animClass), { once: true });
}

// ═══════════════════ PWA ═══════════════════

let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').style.display = 'block';
});
window.addEventListener('appinstalled', () => {
  document.getElementById('installBtn').style.display = 'none';
});

function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => {
    deferredPrompt = null;
    document.getElementById('installBtn').style.display = 'none';
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

const isStandalone = window.matchMedia('(display-mode: fullscreen)').matches
  || window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone;
if (isStandalone && document.documentElement.requestFullscreen) {
  document.addEventListener('click', function enterFS() {
    document.documentElement.requestFullscreen().catch(() => {});
    document.removeEventListener('click', enterFS);
  }, { once: true });
}

// ═══════════════════ INIT ═══════════════════

const _path = window.location.pathname;
if (_path.includes('admin')) {
  showPage('admin-login', true);
} else if (getToken()) {
  const _role    = roleOf(getUser());
  const _allowed = ROLE_NAV[_role] || ROLE_NAV.contractor;
  const _landing = ROLE_LANDING[_role] || 'contractor';
  // Respect the URL only if the role is permitted to view it; otherwise redirect to role landing.
  let _target;
  if      (_path.includes('assessment') && _allowed.has('assessment')) _target = 'assessment';
  else if (_path.includes('operations') && _allowed.has('operations')) _target = 'operations';
  else if (_path.includes('contractor') && _allowed.has('contractor')) _target = 'contractor';
  else                                                                 _target = _landing;
  showPage(_target, true);
} else {
  if (_path.includes('register'))                                        showPage('register', true);
  else if (_path.includes('login'))                                      showPage('login', true);
  else if (_path.includes('contractor') || _path.includes('assessment') || _path.includes('operations')) showPage('login', true);
  else                                                                   showPage('home', true);
}
