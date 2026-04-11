// ═══════════════════ ROUTING ═══════════════════

const PAGE_ORDER = { home: 0, login: 1, register: 2, 'admin-login': 3, contractor: 4, assessment: 5, 'admin-dashboard': 6 };
const PAGE_URLS  = { home: '/', login: '/login', register: '/register', 'admin-login': '/admin', contractor: '/contractor', assessment: '/assessment', 'admin-dashboard': '/admin/dashboard' };
const NAV_PAGES  = new Set(['contractor', 'assessment']);
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
    document.getElementById(name === 'contractor' ? 'navContractor' : 'navAssessment').classList.add('active');
    const u = getUser();
    document.getElementById('navUser').textContent     = u.email || '';
    document.getElementById('welcomeMsg').textContent  = `Welcome, ${u.full_name || 'Contractor'}`;
    document.getElementById('companyInfo').textContent = `${u.company || ''} · ${u.service_line || ''}`;
  }

  replace
    ? history.replaceState({ page: name }, '', PAGE_URLS[name])
    : history.pushState({ page: name }, '', PAGE_URLS[name]);

  if (name === 'contractor') { loadEquipment(); loadPersonnel(); loadDashAssessments(); }
  if (name === 'assessment') { loadAssessments(); }
  if (name === 'register')   { loadRegisterOptions(); }
}

window.addEventListener('popstate', e => { if (e.state?.page) showPage(e.state.page, true); });

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
  if (_path.includes('assessment')) showPage('assessment', true);
  else showPage('contractor', true);
} else {
  if (_path.includes('register'))                                        showPage('register', true);
  else if (_path.includes('login'))                                      showPage('login', true);
  else if (_path.includes('contractor') || _path.includes('assessment')) showPage('login', true);
  else                                                                   showPage('home', true);
}
