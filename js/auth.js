// ═══════════════════ AUTH ═══════════════════

// Initialize Supabase client on first use
function getSupabaseClient() {
  if (!window._sbClient && window.supabase?.createClient) {
    window._sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return window._sbClient;
}

async function login() {
  const email    = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const msg      = document.getElementById('loginMsg');
  msg.className  = 'auth-msg';

  const sb = getSupabaseClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    msg.className = 'auth-msg error';
    msg.textContent = 'Invalid email or password.';
    return;
  }

  const { data: profiles, error: profileError } = await sb
    .from('user_profiles')
    .select('status,role,full_name,company,service_line')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profiles) {
    msg.className = 'auth-msg error';
    msg.textContent = 'Profile not found.';
    return;
  }

  if (profiles.status === 'pending') {
    msg.className = 'auth-msg warning';
    msg.textContent = 'Your account is pending admin approval.';
    return;
  }
  if (profiles.status === 'rejected') {
    msg.className = 'auth-msg error';
    msg.textContent = 'Your account has been rejected. Contact admin.';
    return;
  }

  const role = profiles.role || 'contractor';
  localStorage.setItem('radp_token', data.session.access_token);
  localStorage.setItem('radp_user', JSON.stringify({ id: data.user.id, email: data.user.email, ...profiles }));
  showPage(ROLE_LANDING[role] || 'contractor');
  startNotifPolling();
}

async function logout() {
  stopNotifPolling();
  await window.supabase.auth.signOut();
  localStorage.removeItem('radp_token');
  localStorage.removeItem('radp_user');
  showPage('login');
}

async function loadRegisterOptions() {
  const role         = sessionStorage.getItem('radp_reg_role') || 'contractor';
  const isContractor = role === 'contractor';

  const [companiesResult, optionsResult] = await Promise.all([
    window.supabase.from('companies').select('name').order('name'),
    isContractor
      ? window.supabase.from('service_lines').select('name').order('name')
      : window.supabase.from('aramco_departments').select('name').order('name')
  ]);

  const companies = companiesResult.data || [];
  const options = optionsResult.data || [];

  const cSel = document.getElementById('regCompany');
  const current = cSel.value;
  cSel.innerHTML = '<option value="">Select company...</option>'
    + companies.map(x => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('')
    + '<option value="__new__">+ Add new company...</option>';
  if (current) cSel.value = current;

  const svcSel = document.getElementById('regServiceLine');
  const placeholder = isContractor ? 'Select service line...' : 'Select department...';
  let svcHtml = `<option value="">${placeholder}</option>`
    + options.map(x => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('');
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
  try {
    const { error } = await window.supabase.from('companies').insert({ name });
    if (error) throw error;
    msg.style.color = '#6ee7b7'; msg.textContent = `"${name}" added!`;
    document.getElementById('newCompanyName').value = '';
    await loadRegisterOptions();
    document.getElementById('regCompany').value = name;
    document.getElementById('newCompanyWrap').style.display = 'none';
    msg.textContent = '';
  } catch (e) {
    msg.style.color = '#fda4af'; msg.textContent = 'Failed to add. It may already exist.';
  }
}

async function addNewServiceLine() {
  const name = document.getElementById('newServiceLineName').value.trim();
  const msg  = document.getElementById('newServiceLineMsg');
  const label = 'department';
  if (!name) { msg.style.color = '#fda4af'; msg.textContent = `Please enter a ${label} name.`; return; }
  msg.style.color = '#94a3b8'; msg.textContent = 'Adding...';
  try {
    const { error } = await window.supabase.from('aramco_departments').insert({ name });
    if (error) throw error;
    msg.style.color = '#6ee7b7'; msg.textContent = `"${name}" added!`;
    document.getElementById('newServiceLineName').value = '';
    await loadRegisterOptions();
    document.getElementById('regServiceLine').value = name;
    document.getElementById('newServiceLineWrap').style.display = 'none';
    msg.textContent = '';
  } catch (e) {
    msg.style.color = '#fda4af'; msg.textContent = 'Failed to add. It may already exist.';
  }
}

async function register() {
  const role         = sessionStorage.getItem('radp_reg_role') || 'contractor';
  const isContractor = role === 'contractor';
  const fullName     = document.getElementById('regFullName').value.trim();
  const email        = document.getElementById('regEmail').value.trim();
  const password     = document.getElementById('regPassword').value;
  const choice       = document.getElementById('regServiceLine').value;
  const msg          = document.getElementById('registerMsg');

  const company = isContractor ? document.getElementById('regCompany').value : 'Aramco';

  const needsServiceLine = !choice || choice === '__new__';
  if (!fullName || !email || !password || !company || company === '__new__' || (isContractor && needsServiceLine)) {
    msg.className = 'auth-msg error';
    msg.textContent = company === '__new__' ? 'Please finish adding your company first.'
                    : needsServiceLine && isContractor ? 'Please finish adding your service line first.'
                    :                         'Please fill all fields.';
    return;
  }

  const { data, error } = await window.supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        company,
        ...(isContractor ? { service_line: choice } : { aramco_department: choice })
      }
    }
  });

  if (error || !data.user) {
    msg.className = 'auth-msg error'; msg.textContent = 'Registration failed. Try again.';
    return;
  }

  const profile = isContractor
    ? { id: data.user.id, email, full_name: fullName, company, service_line: choice, role }
    : { id: data.user.id, email, full_name: fullName, company, ...(choice ? { aramco_department: choice } : {}), role };

  const { error: profileError } = await window.supabase.from('user_profiles').upsert(profile);
  if (profileError) {
    msg.className = 'auth-msg error'; msg.textContent = 'Profile creation failed.';
    return;
  }

  sessionStorage.removeItem('radp_reg_role');
  msg.className = 'auth-msg success'; msg.textContent = 'Account created! Waiting for admin approval.';
}
