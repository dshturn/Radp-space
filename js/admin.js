// ═══════════════════ ADMIN ═══════════════════

let adminToken = '';

async function adminLogin() {
  const email    = document.getElementById('adminEmail').value;
  const password = document.getElementById('adminPassword').value;
  const msg      = document.getElementById('adminLoginMsg');
  msg.className  = 'auth-msg';
  const res  = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (data.access_token) {
    adminToken = data.access_token;
    showPage('admin-dashboard');
    loadUsers();
  } else {
    msg.className = 'auth-msg error';
    msg.textContent = 'Invalid credentials';
  }
}

async function loadUsers() {
  const res   = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?select=*&order=created_at.desc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}` }
  });
  const users   = await res.json();
  const pending  = users.filter(u => u.status === 'pending');
  const approved = users.filter(u => u.status === 'approved');
  document.getElementById('pendingList').innerHTML  = pending.length  ? pending.map(adminUserCard).join('')  : '<div class="empty">No pending users</div>';
  document.getElementById('approvedList').innerHTML = approved.length ? approved.map(adminUserCard).join('') : '<div class="empty">No approved users</div>';
  document.querySelectorAll('.admin-card').forEach((el, i) => { el.style.animationDelay = `${i * 50}ms`; });
}

function adminUserCard(u) {
  const editBtn = `<button class="btn-edit" onclick='openEditUser(${JSON.stringify(u)})' title="Edit user">✏️</button>`;
  const actions = u.status === 'pending' ? `
    <div class="admin-actions">
      ${editBtn}
      <button class="btn-approve" onclick="updateStatus('${u.id}', 'approved')">Approve</button>
      <button class="btn-reject"  onclick="updateStatus('${u.id}', 'rejected')">Reject</button>
    </div>` : `
    <div class="admin-actions">
      ${editBtn}
      <span class="badge ${u.status}">${u.status}</span>
      <button class="btn-delete" onclick="deleteUser('${u.id}')">Delete</button>
    </div>`;
  return `<div class="admin-card">
    <div class="admin-info">
      <div class="name">${u.full_name}</div>
      <div class="detail">${u.email} · ${u.company || '—'} · ${u.service_line || '—'}</div>
    </div>
    ${actions}
  </div>`;
}

async function openEditUser(u) {
  document.getElementById('editUserId').value    = u.id;
  document.getElementById('editFullName').value  = u.full_name  || '';
  document.getElementById('editEmail').value     = u.email      || '';

  const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}` };
  const [companies, serviceLines] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=name&order=name`, { headers: h }).then(r => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/service_lines?select=name&order=name`, { headers: h }).then(r => r.json())
  ]);

  const cSel = document.getElementById('editCompany');
  cSel.innerHTML = '<option value="">Select company...</option>'
    + companies.map(c => `<option value="${c.name}"${c.name === u.company ? ' selected' : ''}>${c.name}</option>`).join('');

  const sSel = document.getElementById('editServiceLine');
  sSel.innerHTML = '<option value="">Select service line...</option>'
    + serviceLines.map(s => `<option value="${s.name}"${s.name === u.service_line ? ' selected' : ''}>${s.name}</option>`).join('');

  document.getElementById('adminEditModal').classList.add('open');
}

async function saveEditUser() {
  const id          = document.getElementById('editUserId').value;
  const full_name   = document.getElementById('editFullName').value.trim();
  const email       = document.getElementById('editEmail').value.trim();
  const company     = document.getElementById('editCompany').value;
  const service_line = document.getElementById('editServiceLine').value;
  if (!full_name || !email) { alert('Name and email are required'); return; }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, Prefer: 'return=minimal' },
    body: JSON.stringify({ full_name, email, company, service_line })
  });
  if (!res.ok) { alert('Save failed: ' + res.status); return; }
  closeModal('adminEditModal');
  loadUsers();
}

async function updateStatus(id, status) {
  await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, Prefer: 'return=minimal' },
    body: JSON.stringify({ status })
  });
  loadUsers();
}

async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${id}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, Prefer: 'return=minimal' }
  });
  loadUsers();
}

function adminLogout() {
  adminToken = '';
  showPage('home');
}
