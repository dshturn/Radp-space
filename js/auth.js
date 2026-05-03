// ═══════════════════ AUTH ═══════════════════

async function login() {
  const email    = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const msg      = document.getElementById('loginMsg');
  msg.className  = 'auth-msg';

  const supabaseUrl = 'https://fslleuedqlxpjnerruzt.supabase.co';
  const url = `${supabaseUrl}/auth/v1/token`;

  const res  = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'sb_publishable_O_f8pz1TnglyqJlO6z2EEA_J3EcJbwV'
    },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();

  if (!data.access_token) {
    msg.className = 'auth-msg error';
    if (data.error_description?.includes('Invalid login credentials')) {
      msg.textContent = 'Invalid email or password. Please try again.';
    } else if (data.error_description) {
      msg.textContent = data.error_description;
    } else {
      msg.textContent = 'Login failed. Please check your email and password.';
    }
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
    const role = sessionStorage.getItem('radp_reg_role') || 'contractor';
    const isContractor = role === 'contractor';

    // For contractors: load companies + service_lines
    // For assessors/operations: load companies + aramco_departments
    const endpoint1 = isContractor
      ? '/rest/v1/service_lines?select=name&order=name'
      : '/rest/v1/aramco_departments?select=name&order=name';

    const [cRes, sRes] = await Promise.all([
      fetch((window.location.hostname === 'localhost' ? 'http://localhost:5000' : '') + `/api?endpoint=${encodeURIComponent('/rest/v1/companies?select=name&order=name')}`),
      fetch((window.location.hostname === 'localhost' ? 'http://localhost:5000' : '') + `/api?endpoint=${encodeURIComponent(endpoint1)}`)
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
    const placeholder = isContractor ? 'Select service line...' : 'Select department...';
    const addNewOption = isContractor ? '+ Add new service line...' : '+ Add new department...';
    svcSel.innerHTML = `<option value="">${placeholder}</option>`
      + s.map(x => `<option value="${x.name}">${x.name}</option>`).join('')
      + `<option value="__new__">${addNewOption}</option>`;
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
  const role = sessionStorage.getItem('radp_reg_role') || 'contractor';
  const isContractor = role === 'contractor';
  const endpoint = isContractor ? '/rest/v1/service_lines' : '/rest/v1/aramco_departments';
  const type = isContractor ? 'service line' : 'department';

  const name = document.getElementById('newServiceLineName').value.trim();
  const msg  = document.getElementById('newServiceLineMsg');
  if (!name) { msg.style.color = '#fda4af'; msg.textContent = `Please enter a ${type} name.`; return; }
  msg.style.color = '#94a3b8'; msg.textContent = 'Adding...';
  const res = await fetch((window.location.hostname === 'localhost' ? 'http://localhost:5000' : '') + `/api?endpoint=${encodeURIComponent(endpoint)}&Prefer=return=minimal`, {
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
  const role        = sessionStorage.getItem('radp_reg_role') || 'contractor';
  const isContractor = role === 'contractor';
  const isAramco    = ['assessor', 'operations', 'admin'].includes(role);

  let company       = document.getElementById('regCompany').value;
  const serviceLine = document.getElementById('regServiceLine').value;
  const msg         = document.getElementById('registerMsg');

  // Validation
  if (!fullName || !email || !password) {
    msg.className = 'auth-msg error';
    msg.textContent = 'Please fill all required fields.';
    return;
  }
  if (isContractor && !company) {
    msg.className = 'auth-msg error';
    msg.textContent = 'Please select a company.';
    return;
  }
  if (company === '__new__') {
    msg.className = 'auth-msg error';
    msg.textContent = 'Please finish adding your company first.';
    return;
  }
  if (isContractor && !serviceLine) {
    msg.className = 'auth-msg error';
    msg.textContent = 'Please select a service line.';
    return;
  }

  // Aramco users: auto-set company to 'Aramco'
  if (isAramco) company = 'Aramco';

  // Signup only needs email + password; profile data goes to user_profiles table
  const signupData = { email, password };

  const res  = await fetch((window.location.hostname === 'localhost' ? 'http://localhost:5000' : '') + `/api?endpoint=${encodeURIComponent('/auth/v1/signup')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signupData)
  });
  const data = await res.json();

  if (data.error || data.details?.error_code) {
    msg.className = 'auth-msg error';
    const errorCode = data.details?.error_code || data.error_code;

    if (errorCode === 'user_already_exists' || errorCode === 'user_already_registered') {
      msg.textContent = `Email "${email}" is already registered. Please use a different email or login with this account.`;
    } else if (data.error?.includes('password')) {
      msg.textContent = 'Password must be at least 6 characters long.';
    } else if (data.error?.includes('email')) {
      msg.textContent = 'Please enter a valid email address.';
    } else {
      msg.textContent = `Registration failed: ${data.details?.msg || data.error_description || 'Please try again'}`;
    }
    return;
  }

  if (data.user) {
    const profileData = { id: data.user.id, email, full_name: fullName, company, role, status: 'pending' };
    if (isContractor) {
      profileData.service_line = serviceLine;
    } else {
      profileData.aramco_department = serviceLine;
    }
    const profileRes = await fetch((window.location.hostname === 'localhost' ? 'http://localhost:5000' : '') + `/api?endpoint=${encodeURIComponent('/rest/v1/user_profiles')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(profileData)
    });
    if (profileRes.ok || profileRes.status === 201) {
      msg.className = 'auth-msg success'; msg.textContent = 'Account created! Waiting for admin approval.';
      logAudit('user', data.user.id, 'registered', `${fullName} (${email})`, { company, role, department_or_service_line: serviceLine });
    } else {
      const errData = await profileRes.json().catch(() => ({}));
      console.error('Profile creation failed:', profileRes.status, errData);
      msg.className = 'auth-msg error';
      if (errData.details?.message?.includes('filter')) {
        msg.textContent = 'Error creating profile. Please try again.';
      } else if (errData.error) {
        msg.textContent = `Profile error: ${errData.error}`;
      } else {
        msg.textContent = 'Failed to create your profile. Please contact support.';
      }
    }
  } else {
    msg.className = 'auth-msg error'; msg.textContent = 'Registration failed. Try again.';
  }
}
