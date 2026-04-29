// ═══════════════════ ADMIN ═══════════════════

const _adminUserMap = new Map();

async function loadUsers() {
  let url = `${SUPABASE_URL}/rest/v1/user_profiles?select=*&order=status.asc,created_at.desc`;
  const roleFilter = document.getElementById('usersRoleFilter')?.value;
  if (roleFilter) url += `&role=eq.${encodeURIComponent(roleFilter)}`;

  const rows = await apiFetch(url, { headers: getHeaders() });
  if (!rows) return;

  const q = (document.getElementById('usersSearch')?.value || '').toLowerCase();
  const users = q ? rows.filter(u =>
    (u.full_name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q) ||
    (u.company || '').toLowerCase().includes(q)
  ) : rows;

  const pending  = users.filter(u => u.status === 'pending');
  const approved = users.filter(u => u.status === 'approved');
  const rejected = users.filter(u => u.status === 'rejected');

  const pendingSection = document.getElementById('pendingSection');
  if (pendingSection) pendingSection.style.display = pending.length ? '' : 'none';

  document.getElementById('pendingList').innerHTML = pending.length ? pending.map(adminUserCard).join('') : '';
  document.getElementById('approvedList').innerHTML = approved.length
    ? approved.map(adminUserCard).join('')
    : '<div class="empty">No active users</div>';

  const rejectedSection = document.getElementById('rejectedSection');
  if (rejectedSection) rejectedSection.style.display = rejected.length ? '' : 'none';
  document.getElementById('rejectedList').innerHTML = rejected.length ? rejected.map(adminUserCard).join('') : '';

  document.querySelectorAll('.admin-card').forEach((el, i) => { el.style.animationDelay = `${i * 40}ms`; });
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

  const h = getHeaders();
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
    headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ full_name, email, company, service_line, role })
  });
  if (!res.ok) { showToast('Save failed: ' + res.status, 'error'); return; }
  closeModal('adminEditModal');
  loadUsers();
}

async function updateStatus(id, status) {
  await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ status })
  });
  logAudit('user', id, status === 'approved' ? 'approved' : 'rejected', `User ${status}`);
  loadUsers();
}

async function deleteUser(id) {
  if (!await showConfirm('Delete this user?')) return;
  const _delRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${id}`, {
    method: 'DELETE',
    headers: { ...getHeaders(), Prefer: 'return=minimal' }
  });
  if (_delRes.ok) {
    logAudit('user', id, 'deleted', 'User account deleted');
  }
  loadUsers();
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

  let path = `/audit_log?order=created_at.desc&offset=${_auditPage * _AUDIT_PAGE_SIZE}&limit=${_AUDIT_PAGE_SIZE}`;
  if (entityFilter) path += `&entity_type=eq.${encodeURIComponent(entityFilter)}`;
  if (dateFrom)     path += `&created_at=gte.${encodeURIComponent(dateFrom)}T00:00:00Z`;
  if (dateTo)       path += `&created_at=lte.${encodeURIComponent(dateTo)}T23:59:59Z`;

  try {
    const rows = await apiCall(path, { headers: { Prefer: 'count=exact' } });
    if (!rows) { showToast('Failed to load audit log', 'error'); return; }
    const total = rows.length; // Note: actual total should come from Prefer header, this is simplified

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
          ${rows.map(r => {
            const isDocument = r.entity_type === 'document' && r.entity_id;
            const labelHtml = isDocument
              ? `<a href="javascript:openAuditFile('${esc(r.entity_id)}', '${esc(r.label || '')}')" style="color:var(--primary);text-decoration:underline;cursor:pointer;">${esc(r.label || '—')}</a>`
              : `<span style="color:var(--text-2);">${esc(r.label || '—')}</span>`;
            return `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:8px 10px;color:var(--text-3);white-space:nowrap;">${new Date(r.created_at).toLocaleString()}</td>
              <td style="padding:8px 10px;"><span style="font-size:11px;padding:2px 6px;border-radius:4px;background:var(--surface-3,#334155);color:var(--text-2);">${esc(r.entity_type)}</span></td>
              <td style="padding:8px 10px;color:var(--text-1);">${esc(r.action)}</td>
              <td style="padding:8px 10px;">${labelHtml}</td>
            </tr>`;
          }).join('')}
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
  } catch (err) {
    showToast('Failed to load audit log: ' + err.message, 'error');
  }
}

async function openAuditFile(documentId, entityType) {
  try {
    const doc = await apiCall(`/documents?id=eq.${documentId}&select=file_url`);
    if (doc && doc[0] && doc[0].file_url) {
      window.open(doc[0].file_url, '_blank');
    } else {
      showToast('Document not found', 'error');
    }
  } catch (err) {
    showToast('Failed to open document: ' + err.message, 'error');
  }
}

// Page initialization - called when admin page is shown
async function adminInit() {
  await loadUsers();
  await loadAuditLog();
}

// Audit page initialization
async function auditInit() {
  await loadAuditLog();
}
