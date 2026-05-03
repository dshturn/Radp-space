// ═══════════════════ ROUTING ═══════════════════

const PAGE_ORDER = { login: 0, register: 1, contractor: 2, assessment: 3, operations: 4, admin: 5, notifications: 6, audit: 7 };
const PAGE_URLS  = { login: '/', register: '/register', contractor: '/contractor', assessment: '/assessment', operations: '/operations', admin: '/admin', notifications: '/notifications', audit: '/audit' };
const NAV_PAGES  = new Set(['contractor', 'assessment', 'operations', 'admin', 'notifications', 'audit']);

// Role → landing page after login, and which nav tabs are visible
const ROLE_LANDING = { contractor: 'contractor', operations: 'operations', assessor: 'assessment', admin: 'admin' };
const ROLE_NAV     = {
  contractor: new Set(['contractor', 'assessment', 'operations', 'audit']),
  operations: new Set(['operations']),
  assessor:   new Set(['assessment']),
  admin:      new Set(['contractor', 'assessment', 'operations', 'admin', 'notifications', 'audit']),
};

function roleOf(user) {
  return (user && user.role) || 'contractor';
}

// Role picker: opens before the register form so the user self-declares
// their role, which shapes the fields they see.
function openRolePicker() {
  openModal('rolePickerModal');
}

function pickRegistrationRole(role) {
  sessionStorage.setItem('radp_reg_role', role);
  closeModal('rolePickerModal');
  showPage('register');
}

// Shape the register form based on the declared role from the picker.
// Direct URL hit on /register with no prior pick defaults to contractor.
// Aramco users (operations/assessor) have company auto-set to 'Aramco' on
// submit, so the company picker is hidden for them.
function configureRegisterForm() {
  const role = sessionStorage.getItem('radp_reg_role') || 'contractor';
  const isContractor = role === 'contractor';
  const isAssessor = role === 'assessor';

  const companyWrap = document.getElementById('regCompanyWrap');
  if (companyWrap) companyWrap.style.display = isContractor ? '' : 'none';

  const subtitle = document.getElementById('regRoleSubtitle');
  if (subtitle) {
    subtitle.textContent = role === 'operations' ? 'Create your Operations account'
                         : role === 'assessor'   ? 'Create your Assessments account'
                         :                         'Create your contractor account';
  }

  const emailLabel = document.getElementById('regEmailLabel');
  const emailInput = document.getElementById('regEmail');
  if (emailLabel) emailLabel.textContent = isContractor ? 'Email' : 'Aramco Email';
  if (emailInput) emailInput.placeholder = isContractor ? 'you@company.com' : 'you@aramco.com';

  // Service line/department field: hidden for assessors, visible for contractors & operations
  const slWrap = document.getElementById('regServiceLineWrap');
  const slLabel = document.getElementById('regServiceLineLabel');
  if (slWrap) slWrap.style.display = isAssessor ? 'none' : '';
  if (slLabel) slLabel.textContent = isContractor ? 'Service Line' : 'Aramco Department';

  const newSLName = document.getElementById('newServiceLineName');
  if (newSLName) {
    newSLName.placeholder = isContractor ? 'Enter service line name' : 'Enter department name';
    newSLName.value = '';
  }

  // Update button text in the new service line wrapper
  const addBtn = document.querySelector('#newServiceLineWrap .btn-success');
  if (addBtn) {
    addBtn.textContent = isContractor ? 'Add' : 'Add';
  }

  // Clear any lingering custom-entry state on form re-entry.
  const newSLWrap = document.getElementById('newServiceLineWrap');
  if (newSLWrap) newSLWrap.style.display = 'none';
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

  // Load notification count on every page
  if (typeof loadNotifUnreadCount === 'function') loadNotifUnreadCount();

  const nav = document.getElementById('mainNav');
  nav.style.display = NAV_PAGES.has(name) ? 'flex' : 'none';
  if (NAV_PAGES.has(name)) {
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const navMap = { contractor: 'navContractor', assessment: 'navAssessment', operations: 'navOperations', admin: 'navUsers', notifications: 'navNotifications', audit: 'navAudit' };
    document.getElementById(navMap[name])?.classList.add('active');
    const u = getUser();
    document.getElementById('navUser').textContent = u.email || '';

    // Role-based tab visibility: operations users see only Operations, assessors only Assessments, admin sees all.
    const allowed = ROLE_NAV[roleOf(u)] || ROLE_NAV.contractor;
    Object.entries(navMap).forEach(([page, linkId]) => {
      const link = document.getElementById(linkId);
      if (link) link.style.display = allowed.has(page) ? '' : 'none';
    });

    if (name === 'contractor') {
      document.getElementById('welcomeMsg').textContent  = `Welcome, ${u.full_name || 'Contractor'}`;
      document.getElementById('companyInfo').textContent = u.role === 'admin' ? 'Admin' : `${u.company || ''} · ${u.service_line || ''}`;
      // Reset to Personnel tab when returning to Contractor page
      document.querySelectorAll('#contractor-page .tab').forEach(t => t.classList.remove('active'));
      document.getElementById('personCtractorTab')?.classList.add('active');
      document.querySelectorAll('#contractor-page .ct-section').forEach(s => s.classList.remove('active'));
      document.getElementById('ct-personnel')?.classList.add('active');
    }
  }

  replace
    ? history.replaceState({ page: name }, '', PAGE_URLS[name])
    : history.pushState({ page: name }, '', PAGE_URLS[name]);

  if (name === 'contractor') { loadEquipment(); loadPersonnel(); loadDashAssessments(); }
  if (name === 'assessment') { assessmentInit?.(); loadAssessments(); }
  if (name === 'operations') { operationsInit?.(); loadOperations(); }
  if (name === 'admin')      { adminInit(); }
  if (name === 'notifications') { notificationsInit?.(); }
  if (name === 'audit')      { console.log('[APP] Showing audit page, calling auditInit'); auditInit?.(); loadAuditLog(); }
  if (name === 'register')   { configureRegisterForm(); loadRegisterOptions(); }
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
  document.querySelectorAll('#contractor-page .tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('#contractor-page .ct-section').forEach(s => s.classList.remove('active', 'slide-in-right', 'slide-in-left'));
  el.classList.add('active');
  el.setAttribute('aria-selected', 'true');
  const section = document.getElementById('ct-' + tab);
  section.classList.add('active', animClass);
  section.addEventListener('animationend', () => section.classList.remove(animClass), { once: true });
  // Exit bulk mode when switching tabs
  if (_persBulkMode) { _persBulkMode = false; document.getElementById('persBulkBar').style.display = 'none'; document.getElementById('persBulkToggleBtn').textContent = 'Select'; document.querySelectorAll('#personnelList .bulk-check').forEach(cb => { cb.style.display = 'none'; cb.checked = false; }); }
  if (_equipBulkMode) { _equipBulkMode = false; document.getElementById('equipBulkBar').style.display = 'none'; document.getElementById('equipBulkToggleBtn').textContent = 'Select'; document.querySelectorAll('#equipmentList .bulk-check').forEach(cb => { cb.style.display = 'none'; cb.checked = false; }); }
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
if (getToken()) {
  const _role    = roleOf(getUser());
  const _allowed = ROLE_NAV[_role] || ROLE_NAV.contractor;
  const _landing = ROLE_LANDING[_role] || 'contractor';
  // Respect the URL only if the role is permitted to view it; otherwise redirect to role landing.
  let _target;
  if      (_path.includes('assessment') && _allowed.has('assessment')) _target = 'assessment';
  else if (_path.includes('operations') && _allowed.has('operations')) _target = 'operations';
  else if (_path.includes('contractor') && _allowed.has('contractor')) _target = 'contractor';
  else if (_path.includes('admin') && _allowed.has('admin'))           _target = 'admin';
  else if (_path.includes('audit') && _allowed.has('audit'))           _target = 'audit';
  else if (_path.includes('notifications') && _allowed.has('notifications')) _target = 'notifications';
  else                                                                 _target = _landing;
  showPage(_target, true);
} else {
  // No token → login is the entry point. Register URL is the only exception.
  if (_path.includes('register')) showPage('register', true);
  else                            showPage('login', true);
}
