// ═══════════════════ AUTH ═══════════════════

async function login() {
  const email    = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const msg      = document.getElementById('loginMsg');
  msg.className  = 'auth-msg';

  const endpoint = '/auth/v1/token?grant_type=password';
  const url = window.location.hostname === 'localhost'
    ? `http://localhost:5000/api?endpoint=${encodeURIComponent(endpoint)}`
    : `/api?endpoint=${encodeURIComponent(endpoint)}`;

  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();

  if (!data.access_token) {
    msg.className = 'auth-msg error';
    msg.textContent = 'Invalid email or password.';
    return;
  }

  let profile;
  try {
    const profileRes = await fetch((window.location.hostname === 'localhost' ? 'http://localhost:5000' : '') + `/api?endpoint=${encodeURIComponent(`/rest/v1/user_profiles?id=eq.${data.user.id}&select=status,full_name,company,service_line,role`)}`, {
      headers: { Authorization: `Bearer ${data.access_token}` }
    });
    if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.status}`);
    const profiles = await profileRes.json();
    profile = profiles[0];
  } catch (err) {
    msg.className = 'auth-msg error';
    msg.textContent = 'Failed to load profile. Try again.';
    console.error('Profile fetch error:', err);
    return;
  }

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

  localStorage.setItem('radp_token', data.access_token);
  localStorage.setItem('radp_user', JSON.stringify({ id: data.user.id, email: data.user.email, ...profile }));
  logAudit('user', data.user.id, 'logged_in', email);
  showPage('contractor');
}

function logout() {
  stopNotifPolling();
  localStorage.removeItem('radp_token');
  localStorage.removeItem('radp_user');
  showPage('login');
}

async function loadRegisterOptions() {
  try {
    const [cRes, sRes] = await Promise.all([
      fetch((window.location.hostname === 'localhost' ? 'http://localhost:5000' : '') + `/api?endpoint=${encodeURIComponent('/rest/v1/companies?select=name&order=name')}`),
      fetch((window.location.hostname === 'localhost' ? 'http://localhost:5000' : '') + `/api?endpoint=${encodeURIComponent('/rest/v1/service_lines?select=name&order=name')}`)
    ]);
    if (!cRes.ok || !sRes.ok) throw new Error('Failed to load options');
    const c = await cRes.json();
    const s = await sRes.json();
    const sel     = document.getElementById('regCompany');
    const current = sel.value;
    sel.innerHTML = '<option value="">Select company...</option>'
      + c.map(x => `<option value="${x.name}">${x.name}</option>`).join('')
      + '<option value="__new__">+ Add new company...</option>';
    if (current) sel.value = current;
    const svcSel = document.getElementById('regServiceLine');
    svcSel.innerHTML = '<option value="">Select service line...</option>'
      + s.map(x => `<option value="${x.name}">${x.name}</option>`).join('');
  } catch (err) {
    console.error('Failed to load register options:', err);
  }
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
  const res = await fetch((window.location.hostname === 'localhost' ? 'http://localhost:5000' : '') + `/api?endpoint=${encodeURIComponent('/rest/v1/companies')}&Prefer=return=minimal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch((window.location.hostname === 'localhost' ? 'http://localhost:5000' : '') + `/api?endpoint=${encodeURIComponent('/rest/v1/service_lines')}&Prefer=return=minimal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
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
  const fullName    = document.getElementById('regFullName').value;
  const email       = document.getElementById('regEmail').value;
  const password    = document.getElementById('regPassword').value;
  const company     = document.getElementById('regCompany').value;
  const serviceLine = document.getElementById('regServiceLine').value;
  const msg         = document.getElementById('registerMsg');
  if (!fullName || !email || !password || !company || !serviceLine || company === '__new__') {
    msg.className = 'auth-msg error';
    msg.textContent = company === '__new__' ? 'Please finish adding your company first.' : 'Please fill all fields.';
    return;
  }
  const res  = await fetch((window.location.hostname === 'localhost' ? 'http://localhost:5000' : '') + `/api?endpoint=${encodeURIComponent('/auth/v1/signup')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, options: { data: { full_name: fullName, company, service_line: serviceLine } } })
  });
  const data = await res.json();
  if (data.user) {
    await fetch((window.location.hostname === 'localhost' ? 'http://localhost:5000' : '') + `/api?endpoint=${encodeURIComponent('/rest/v1/user_profiles')}&Prefer=resolution=merge-duplicates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: data.user.id, email, full_name: fullName, company, service_line: serviceLine })
    });
    msg.className = 'auth-msg success'; msg.textContent = 'Account created! Waiting for admin approval.';
    logAudit('user', data.user.id, 'registered', `${fullName} (${email})`, { company, service_line: serviceLine });
  } else {
    msg.className = 'auth-msg error'; msg.textContent = 'Registration failed. Try again.';
  }
}
