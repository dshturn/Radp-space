// ═══════════════════ ADMIN ═══════════════════

let adminToken = '';
const _adminUserMap = new Map();

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
  if (!data.access_token) {
    msg.className = 'auth-msg error';
    msg.textContent = 'Invalid credentials';
    return;
  }
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${data.user.id}&select=role`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${data.access_token}` }
  });
  const profiles = await profileRes.json();
  if (!profiles[0] || profiles[0].role !== 'admin') {
    msg.className = 'auth-msg error';
    msg.textContent = 'Access denied. Admin privileges required.';
    return;
  }
  adminToken = data.access_token;
  showPage('admin-dashboard');
  loadUsers();
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
  _adminUserMap.set(u.id, u);
  const safeId  = esc(u.id);
  const editBtn = `<button class="btn-edit" onclick="openEditUser('${safeId}')" aria-label="Edit ${esc(u.full_name)}">✏</button>`;
  const validStatuses = new Set(['pending', 'approved', 'rejected']);
  const safeStatus = validStatuses.has(u.status) ? u.status : 'pending';
  const actions = u.status === 'pending' ? `
    <div class="admin-actions">
      ${editBtn}
      <button class="btn-approve" onclick="updateStatus('${safeId}', 'approved')">Approve</button>
      <button class="btn-reject"  onclick="updateStatus('${safeId}', 'rejected')">Reject</button>
    </div>` : `
    <div class="admin-actions">
      ${editBtn}
      <span class="badge ${safeStatus}">${safeStatus}</span>
      <button class="btn-delete" onclick="deleteUser('${safeId}')">Delete</button>
    </div>`;
  const roleLabel = esc(u.role || 'contractor');
  return `<div class="admin-card">
    <div class="admin-info">
      <div class="name">${esc(u.full_name)}</div>
      <div class="detail">${esc(u.email)} · ${esc(u.company || '—')} · ${esc(u.aramco_department || u.service_line || '—')} · role: ${roleLabel}</div>
    </div>
    ${actions}
  </div>`;
}

async function openEditUser(userId) {
  const u = _adminUserMap.get(userId);
  if (!u) return;
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
    + companies.map(c => `<option value="${esc(c.name)}"${c.name === u.company ? ' selected' : ''}>${esc(c.name)}</option>`).join('');

  const sSel = document.getElementById('editServiceLine');
  sSel.innerHTML = '<option value="">Select service line...</option>'
    + serviceLines.map(s => `<option value="${esc(s.name)}"${s.name === u.service_line ? ' selected' : ''}>${esc(s.name)}</option>`).join('');

  const rSel = document.getElementById('editRole');
  if (rSel) rSel.value = u.role || 'contractor';

  openModal('adminEditModal');
}

async function saveEditUser() {
  const id          = document.getElementById('editUserId').value;
  const full_name   = document.getElementById('editFullName').value.trim();
  const email       = document.getElementById('editEmail').value.trim();
  const company     = document.getElementById('editCompany').value;
  const service_line = document.getElementById('editServiceLine').value;
  const role        = document.getElementById('editRole')?.value || 'contractor';
  if (!full_name || !email) { showToast('Name and email are required', 'warn'); return; }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, Prefer: 'return=minimal' },
    body: JSON.stringify({ full_name, email, company, service_line, role })
  });
  if (!res.ok) { showToast('Save failed: ' + res.status, 'error'); return; }
  closeModal('adminEditModal');
  loadUsers();
}

async function updateStatus(id, status) {
  await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, Prefer: 'return=minimal' },
    body: JSON.stringify({ status })
  });
  // Audit log using admin token (logAudit() uses contractor JWT, doesn't apply here)
  fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, Prefer: 'return=minimal' },
    body: JSON.stringify({ actor_id: null, entity_type: 'user', entity_id: String(id), action: status === 'approved' ? 'approved' : 'rejected', label: `User ${status}` })
  }).catch(() => {});
  loadUsers();
}

async function deleteUser(id) {
  if (!await showConfirm('Delete this user?')) return;
  const _delRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${id}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, Prefer: 'return=minimal' }
  });
  if (_delRes.ok) {
    // Audit log using admin token (logAudit() uses contractor JWT, doesn't apply here)
    fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, Prefer: 'return=minimal' },
      body: JSON.stringify({ actor_id: null, entity_type: 'user', entity_id: String(id), action: 'deleted', label: 'User account deleted' })
    }).catch(() => {});
  }
  loadUsers();
}

function adminLogout() {
  adminToken = '';
  showPage('login');
}

function showAdminTab(tab, el) {
  ['usersTab','pendingTab','auditLogTab'].forEach(id => {
    const panel = document.getElementById(id);
    if (panel) panel.style.display = 'none';
  });
  document.querySelectorAll('#adminPage .tab').forEach(t => t.classList.remove('active'));
  const target = document.getElementById(tab + 'Tab');
  if (target) target.style.display = 'block';
  if (el) el.classList.add('active');
  if (tab === 'auditLog') loadAuditLog();
}

let _auditPage = 0;
const _AUDIT_PAGE_SIZE = 50;

async function loadAuditLog() {
  _auditPage = 0;
  await _renderAuditLog();
}

async function _renderAuditLog() {
  const entityFilter = document.getElementById('auditEntityFilter')?.value || '';
  const dateFrom     = document.getElementById('auditDateFrom')?.value || '';
  const dateTo       = document.getElementById('auditDateTo')?.value || '';

  let url = `${SUPABASE_URL}/rest/v1/audit_log?order=created_at.desc&offset=${_auditPage * _AUDIT_PAGE_SIZE}&limit=${_AUDIT_PAGE_SIZE}`;
  if (entityFilter) url += `&entity_type=eq.${entityFilter}`;
  if (dateFrom)     url += `&created_at=gte.${dateFrom}T00:00:00Z`;
  if (dateTo)       url += `&created_at=lte.${dateTo}T23:59:59Z`;

  const adminH = { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const res = await fetch(url, { headers: { ...adminH, Prefer: 'count=exact' } });
  if (!res.ok) { showToast('Failed to load audit log', 'error'); return; }
  const rows = await res.json();
  const total = parseInt(res.headers.get('Content-Range')?.split('/')[1] || '0', 10);

  const list = document.getElementById('auditLogList');
  if (!rows.length) { list.innerHTML = '<div class="empty">No audit entries found</div>'; document.getElementById('auditLogPagination').innerHTML = ''; return; }

  list.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="border-bottom:1px solid var(--border);text-align:left;">
          <th style="padding:8px 10px;color:var(--text-3);font-weight:500;">Time</th>
          <th style="padding:8px 10px;color:var(--text-3);font-weight:500;">Type</th>
          <th style="padding:8px 10px;color:var(--text-3);font-weight:500;">Action</th>
          <th style="padding:8px 10px;color:var(--text-3);font-weight:500;">Label</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px 10px;color:var(--text-3);white-space:nowrap;">${new Date(r.created_at).toLocaleString()}</td>
            <td style="padding:8px 10px;"><span style="font-size:11px;padding:2px 6px;border-radius:4px;background:var(--surface-3,#334155);color:var(--text-2);">${esc(r.entity_type)}</span></td>
            <td style="padding:8px 10px;color:var(--text-1);">${esc(r.action)}</td>
            <td style="padding:8px 10px;color:var(--text-2);">${esc(r.label || '—')}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  const totalPages = Math.ceil(total / _AUDIT_PAGE_SIZE);
  const pagEl = document.getElementById('auditLogPagination');
  if (totalPages <= 1) { pagEl.innerHTML = ''; return; }
  pagEl.innerHTML = `
    <div class="pagination">
      <button class="pag-btn" onclick="_auditPage=Math.max(0,_auditPage-1);_renderAuditLog()" ${_auditPage===0?'disabled':''}>← Prev</button>
      <span class="pag-info">Page ${_auditPage+1} of ${totalPages}</span>
      <button class="pag-btn" onclick="_auditPage=Math.min(${totalPages-1},_auditPage+1);_renderAuditLog()" ${_auditPage>=totalPages-1?'disabled':''}>Next →</button>
    </div>`;
}
