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

  const role = profile.role || 'contractor';
  localStorage.setItem('radp_token', data.access_token);
  localStorage.setItem('radp_user', JSON.stringify({ id: data.user.id, email: data.user.email, ...profile }));
  showPage(ROLE_LANDING[role] || 'contractor');
  startNotifPolling();
}

function logout() {
  stopNotifPolling();
  localStorage.removeItem('radp_token');
  localStorage.removeItem('radp_user');
  showPage('login');
}

async function loadRegisterOptions() {
  const role         = sessionStorage.getItem('radp_reg_role') || 'contractor';
  const isContractor = role === 'contractor';
  const anonH        = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  // Contractors pick from service_lines; Aramco users pick from aramco_departments.
  const optionsUrl = isContractor
    ? `${SUPABASE_URL}/rest/v1/service_lines?select=name&order=name`
    : `${SUPABASE_URL}/rest/v1/aramco_departments?select=name&order=name`;

  const [companies, options] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=name&order=name`, { headers: anonH }).then(r => r.json()),
    fetch(optionsUrl, { headers: anonH }).then(r => r.json())
  ]);

  // Company dropdown: contractor variant is the only case that uses this
  // UI — Aramco users have company auto-set to 'Aramco' on submit.
  const cSel = document.getElementById('regCompany');
  const current = cSel.value;
  cSel.innerHTML = '<option value="">Select company...</option>'
    + companies.map(x => `<option value="${x.name}">${x.name}</option>`).join('')
    + '<option value="__new__">+ Add new company...</option>';
  if (current) cSel.value = current;

  // Aramco users get "+ Add custom" so the department list can grow over time.
  const svcSel = document.getElementById('regServiceLine');
  const placeholder = isContractor ? 'Select service line...' : 'Select department...';
  let svcHtml = `<option value="">${placeholder}</option>`
    + options.map(x => `<option value="${x.name}">${x.name}</option>`).join('');
  if (!isContractor) svcHtml += '<option value="__new__">+ Add custom...</option>';
  svcSel.innerHTML = svcHtml;
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

function onServiceLineChange(sel) {
  const wrap = document.getElementById('newServiceLineWrap');
  if (!wrap) return;
  if (sel.value === '__new__') {
    wrap.style.display = 'block';
    document.getElementById('newServiceLineName').focus();
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

async function addNewServiceLine() {
  const name = document.getElementById('newServiceLineName').value.trim();
  const msg  = document.getElementById('newServiceLineMsg');
  if (!name) { msg.style.color = '#fda4af'; msg.textContent = 'Please enter a service line name.'; return; }
  msg.style.color = '#94a3b8'; msg.textContent = 'Adding...';
  // Custom service lines added from the register form are Aramco-only — the
  // UI only exposes this flow to operations/assessor registrations.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/service_lines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'return=minimal' },
    body: JSON.stringify({ name, is_aramco: true })
  });
  if (res.ok || res.status === 201) {
    msg.style.color = '#6ee7b7'; msg.textContent = `"${name}" added!`;
    document.getElementById('newServiceLineName').value = '';
    await loadRegisterOptions();
    document.getElementById('regServiceLine').value = name;
    document.getElementById('newServiceLineWrap').style.display = 'none';
    msg.textContent = '';
  } else {
    msg.style.color = '#fda4af'; msg.textContent = 'Failed to add. It may already exist.';
  }
}

async function register() {
  const role        = sessionStorage.getItem('radp_reg_role') || 'contractor';
  const fullName    = document.getElementById('regFullName').value.trim();
  const email       = document.getElementById('regEmail').value.trim();
  const password    = document.getElementById('regPassword').value;
  const serviceLine = document.getElementById('regServiceLine').value;
  const msg         = document.getElementById('registerMsg');

  // Contractor picks their company; operations/assessor are always Aramco.
  const company = role === 'contractor' ? document.getElementById('regCompany').value : 'Aramco';

  if (!fullName || !email || !password || !company || !serviceLine
      || company === '__new__' || serviceLine === '__new__') {
    msg.className = 'auth-msg error';
    msg.textContent = company === '__new__'     ? 'Please finish adding your company first.'
                    : serviceLine === '__new__' ? 'Please finish adding your service line first.'
                    :                             'Please fill all fields.';
    return;
  }

  const profile = { email, full_name: fullName, company, service_line: serviceLine, role };

  const res  = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, password, options: { data: { full_name: fullName, company, service_line: serviceLine } } })
  });
  const data = await res.json();
  if (data.user) {
    await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: data.user.id, ...profile })
    });
    sessionStorage.removeItem('radp_reg_role');
    msg.className = 'auth-msg success'; msg.textContent = 'Account created! Waiting for admin approval.';
  } else {
    msg.className = 'auth-msg error'; msg.textContent = 'Registration failed. Try again.';
  }
}
