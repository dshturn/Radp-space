// ═══════════════════ AUTH ═══════════════════

async function login() {
  const email    = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const msg      = document.getElementById('loginMsg');
  msg.className  = 'auth-msg';

  const res  = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();

  if (!data.access_token) {
    msg.className = 'auth-msg error';
    msg.textContent = 'Invalid email or password.';
    return;
  }

  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${data.user.id}&select=status,role,full_name,company,service_line`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${data.access_token}` }
  });
  const profiles = await profileRes.json();
  const profile  = profiles[0];

  if (!profile || profile.status === 'pending') {
    msg.className = 'auth-msg warning';
    msg.textContent = 'Your account is pending admin approval.';
    return;
  }
  if (profile.status === 'rejected') {
    msg.className = 'auth-msg error';
    msg.textContent = 'Your account has been rejected. Contact admin.';
    return;
  }

  // If the user clicked a role tile on home, validate it matches their assigned role.
  // Contractors have full access so they can enter via any tile.
  const intent = sessionStorage.getItem('radp_intent');
  const role   = profile.role || 'contractor';
  if (intent && intent !== role && role !== 'contractor') {
    msg.className = 'auth-msg error';
    msg.textContent = `Your account is a ${role} account — please use the ${role === 'operations' ? 'Operations' : 'Assessments'} tile.`;
    return;
  }
  sessionStorage.removeItem('radp_intent');

  localStorage.setItem('radp_token', data.access_token);
  localStorage.setItem('radp_user', JSON.stringify({ id: data.user.id, email: data.user.email, ...profile }));
  showPage(ROLE_LANDING[role] || 'contractor');
  startNotifPolling();
}

function logout() {
  stopNotifPolling();
  localStorage.removeItem('radp_token');
  localStorage.removeItem('radp_user');
  showPage('home');
}

async function loadRegisterOptions() {
  const [c, s] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=name&order=name`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }).then(r => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/service_lines?select=name&order=name`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }).then(r => r.json())
  ]);
  const sel     = document.getElementById('regCompany');
  const current = sel.value;
  sel.innerHTML = '<option value="">Select company...</option>'
    + c.map(x => `<option value="${x.name}">${x.name}</option>`).join('')
    + '<option value="__new__">+ Add new company...</option>';
  if (current) sel.value = current;
  const svcSel = document.getElementById('regServiceLine');
  svcSel.innerHTML = '<option value="">Select service line...</option>'
    + s.map(x => `<option value="${x.name}">${x.name}</option>`).join('');
}

function onCompanyChange(sel) {
  const wrap = document.getElementById('newCompanyWrap');
  if (sel.value === '__new__') {
    wrap.style.display = 'block';
    document.getElementById('newCompanyName').focus();
  } else {
    wrap.style.display = 'none';
  }
}

async function addNewCompany() {
  const name = document.getElementById('newCompanyName').value.trim();
  const msg  = document.getElementById('newCompanyMsg');
  if (!name) { msg.style.color = '#fda4af'; msg.textContent = 'Please enter a company name.'; return; }
  msg.style.color = '#94a3b8'; msg.textContent = 'Adding...';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'return=minimal' },
    body: JSON.stringify({ name })
  });
  if (res.ok || res.status === 201) {
    msg.style.color = '#6ee7b7'; msg.textContent = `"${name}" added!`;
    document.getElementById('newCompanyName').value = '';
    await loadRegisterOptions();
    document.getElementById('regCompany').value = name;
    document.getElementById('newCompanyWrap').style.display = 'none';
    msg.textContent = '';
  } else {
    msg.style.color = '#fda4af'; msg.textContent = 'Failed to add. It may already exist.';
  }
}

async function register() {
  const intent      = sessionStorage.getItem('radp_intent') || 'contractor';
  const fullName    = document.getElementById('regFullName').value.trim();
  const email       = document.getElementById('regEmail').value.trim();
  const password    = document.getElementById('regPassword').value;
  const msg         = document.getElementById('registerMsg');

  // Operations/assessor: only name, aramco email, aramco username, password.
  // Contractor keeps the original company + service-line flow.
  let profile;
  if (intent === 'contractor') {
    const company     = document.getElementById('regCompany').value;
    const serviceLine = document.getElementById('regServiceLine').value;
    if (!fullName || !email || !password || !company || !serviceLine || company === '__new__') {
      msg.className = 'auth-msg error';
      msg.textContent = company === '__new__' ? 'Please finish adding your company first.' : 'Please fill all fields.';
      return;
    }
    profile = { email, full_name: fullName, company, service_line: serviceLine, role: 'contractor' };
  } else {
    const aramcoUsername = document.getElementById('regAramcoUsername').value.trim();
    if (!fullName || !email || !aramcoUsername || !password) {
      msg.className = 'auth-msg error';
      msg.textContent = 'Please fill all fields.';
      return;
    }
    profile = { email, full_name: fullName, aramco_username: aramcoUsername, role: intent };
  }

  const res  = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, password, options: { data: { full_name: fullName } } })
  });
  const data = await res.json();
  if (data.user) {
    await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: data.user.id, ...profile })
    });
    msg.className = 'auth-msg success'; msg.textContent = 'Account created! Waiting for admin approval.';
  } else {
    msg.className = 'auth-msg error'; msg.textContent = 'Registration failed. Try again.';
  }
}
