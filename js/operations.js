// ═══════════════════ OPERATIONS ═══════════════════

let currentSiteId = null;
let _sitesPage = 0;
const _SITES_PAGE_SIZE = 25;

// ── Helpers ──────────────────────────────────────────────

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today  = todayUTC();
  const target = parseUTC(dateStr);
  return target ? Math.round((target - today) / 86400000) : null;
}

function expiryStatusClass(days) {
  if (days === null) return 'info';
  if (days <= 0)    return 'bad';
  if (days <= 30)   return 'warn';
  return 'ok';
}

function daysBadge(days) {
  if (days === null) return '';
  if (days < 0)  return `<span class="ops-days-badge ops-days-bad">${Math.abs(days)}d OVERDUE</span>`;
  if (days === 0) return `<span class="ops-days-badge ops-days-bad">Expires TODAY</span>`;
  if (days <= 7)  return `<span class="ops-days-badge ops-days-bad">${days}d</span>`;
  if (days <= 30) return `<span class="ops-days-badge ops-days-warn">${days}d</span>`;
  return `<span class="ops-days-badge ops-days-ok">${days}d</span>`;
}

// ── View switching ────────────────────────────────────────

function showOpsList() {
  document.querySelectorAll('#operations-page .ops-view').forEach(v => v.classList.remove('active'));
  document.getElementById('opsListView').classList.add('active');
  loadOperations();
}

function showOpsDetail(id) {
  currentSiteId = id;
  document.querySelectorAll('#operations-page .ops-view').forEach(v => v.classList.remove('active'));
  document.getElementById('opsDetailView').classList.add('active');
  // Reset tabs to personnel
  document.querySelectorAll('#opsDetailTabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#opsDetailTabs .tab')[0].classList.add('active');
  document.getElementById('opsPersTab').style.display  = 'block';
  document.getElementById('opsEquipTab').style.display = 'none';
  loadSiteDetail(id);
}

const OPS_TAB_ORDER = { personnel: 0, equipment: 1 };
let _currentOpsTab  = 'personnel';

function showOpsDetailTab(tab, el) {
  const goingRight = OPS_TAB_ORDER[tab] > OPS_TAB_ORDER[_currentOpsTab];
  const animClass  = goingRight ? 'slide-in-right' : 'slide-in-left';
  _currentOpsTab = tab;
  document.querySelectorAll('#opsDetailTabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const target = document.getElementById(tab === 'personnel' ? 'opsPersTab'  : 'opsEquipTab');
  const other  = document.getElementById(tab === 'personnel' ? 'opsEquipTab' : 'opsPersTab');
  other.style.display = 'none';
  target.style.display = 'block';
  target.classList.remove('slide-in-right', 'slide-in-left');
  target.classList.add(animClass);
  target.addEventListener('animationend', () => target.classList.remove(animClass), { once: true });
}

// ── Load grid ─────────────────────────────────────────────

async function loadOperations() {
  const u    = getUser();
  const grid = document.getElementById('opsGrid');
  grid.innerHTML = '<div class="skel-card"><div class="skeleton skel-line medium"></div><div class="skeleton skel-line short"></div></div>'
                 + '<div class="skel-card"><div class="skeleton skel-line full"></div><div class="skeleton skel-line short"></div></div>'
                 + '<div class="skel-card"><div class="skeleton skel-line medium"></div><div class="skeleton skel-line full"></div></div>';

  const from = _sitesPage * _SITES_PAGE_SIZE;
  const res  = await fetch(
    `${SUPABASE_URL}/rest/v1/operation_sites`
    + `?contractor_id=eq.${u.id}&status=eq.active&order=created_at.desc`
    + `&select=*,operation_site_personnel(personnel_id,personnel(expiry_date))`
    + `,operation_site_equipment(equipment_item_id,equipment_items(documents(expiry_date)))`
    + `&offset=${from}&limit=${_SITES_PAGE_SIZE}`,
    { headers: { ...getHeaders(), Prefer: 'count=exact' } }
  );
  if (!res.ok) { showToast('Failed to load sites', 'error'); return; }
  const sites = await res.json();
  const totalCount = parseInt(res.headers.get('Content-Range')?.split('/')[1] || '0', 10);

  if (!sites.length) {
    grid.innerHTML = `
      <div class="ops-empty">
        <div class="ops-empty-icon">🏗</div>
        <div class="ops-empty-text">No operation sites yet</div>
        <div class="ops-empty-hint">Create a site and assign approved personnel and equipment to it.</div>
      </div>`;
    return;
  }

  grid.innerHTML = sites.map((site, idx) => {
    const persItems  = site.operation_site_personnel  || [];
    const equipItems = site.operation_site_equipment  || [];
    const persCount  = persItems.length;
    const equipCount = equipItems.length;

    // Collect all expiry dates
    const allDays = [];
    persItems.forEach(sp => {
      const d = daysUntil(sp.personnel?.expiry_date);
      if (d !== null) allDays.push(d);
    });
    equipItems.forEach(se => {
      (se.equipment_items?.documents || []).forEach(doc => {
        const d = daysUntil(doc.expiry_date);
        if (d !== null) allDays.push(d);
      });
    });

    const nearestDays = allDays.length ? Math.min(...allDays) : null;
    const cls         = expiryStatusClass(nearestDays);

    let expiryNum, expiryLbl;
    if (nearestDays === null)    { expiryNum = '—';  expiryLbl = 'No expiry data'; }
    else if (nearestDays < 0)   { expiryNum = `${Math.abs(nearestDays)}d`; expiryLbl = 'OVERDUE'; }
    else if (nearestDays === 0) { expiryNum = 'TODAY'; expiryLbl = 'Expires today'; }
    else                        { expiryNum = `${nearestDays}d`; expiryLbl = 'Until next expiry'; }

    const created = new Date(site.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    return `
    <div class="ops-tile ops-tile-${cls}" style="animation-delay:${idx * 50}ms"
         onclick="showOpsDetail(${parseInt(site.id)})" role="button" tabindex="0"
         aria-label="Open site: ${esc(site.title)}">
      <div class="ops-tile-head">
        <span class="ops-status-dot ops-dot-${cls}" aria-hidden="true"></span>
        <span class="ops-tile-date">${created}</span>
      </div>
      <div class="ops-tile-title">${esc(site.title)}</div>
      <div class="ops-tile-expiry-wrap">
        <div class="ops-tile-expiry ops-expiry-${cls}">${expiryNum}</div>
        <div class="ops-tile-expiry-label">${expiryLbl}</div>
      </div>
      <div class="ops-tile-footer">
        <span class="ops-tile-badge">👥 ${persCount} Personnel</span>
        <span class="ops-tile-badge">🔧 ${equipCount} Equipment</span>
      </div>
    </div>`;
  }).join('');

  // Keyboard enter/space for tiles
  grid.querySelectorAll('.ops-tile').forEach(tile => {
    tile.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tile.click(); }
    });
  });

  const totalPages = Math.ceil(totalCount / _SITES_PAGE_SIZE);
  const pagEl = document.getElementById('sitesPagination');
  if (pagEl) {
    if (totalPages <= 1) { pagEl.innerHTML = ''; }
    else {
      pagEl.innerHTML = `
        <div class="pagination">
          <button class="pag-btn" onclick="_sitesPage=Math.max(0,_sitesPage-1);loadOperations()" ${_sitesPage === 0 ? 'disabled' : ''}>← Prev</button>
          <span class="pag-info">Page ${_sitesPage + 1} of ${totalPages}</span>
          <button class="pag-btn" onclick="_sitesPage=Math.min(${totalPages-1},_sitesPage+1);loadOperations()" ${_sitesPage >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
        </div>`;
    }
  }
}

// ── Create site ───────────────────────────────────────────

function openCreateSite() {
  document.getElementById('newSiteTitle').value = '';
  openModal('opsCreateModal');
}

async function createSite() {
  const title = document.getElementById('newSiteTitle').value.trim();
  if (!title) { showToast('Enter a site name', 'warn'); return; }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/operation_sites`, {
    method: 'POST',
    headers: { ...getHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({ contractor_id: getUser().id, title })
  });
  if (!r.ok) { showToast('Failed to create site', 'error'); return; }
  const [newSite] = await r.json();
  logAudit('site', newSite.id, 'created', title);
  closeModal('opsCreateModal');
  showToast('Site created', 'success');
  loadOperations();
}

// ── Edit site title ───────────────────────────────────────

function openEditSite(id, currentTitle) {
  document.getElementById('editSiteId').value    = id;
  document.getElementById('editSiteTitle').value = currentTitle;
  openModal('opsEditModal');
}

async function saveEditSite() {
  const id    = parseInt(document.getElementById('editSiteId').value);
  const title = document.getElementById('editSiteTitle').value.trim();
  if (!title) { showToast('Title cannot be empty', 'warn'); return; }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/operation_sites?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ title })
  });
  if (!r.ok) { showToast('Failed to rename', 'error'); return; }
  logAudit('site', String(id), 'updated', title);
  closeModal('opsEditModal');
  showToast('Site renamed', 'success');
  document.getElementById('opsSiteTitle').textContent = title;
}

// ── Archive site ──────────────────────────────────────────

async function archiveSite(id) {
  const ok = await showConfirm('Archive this operation site? All personnel and equipment assignments will be removed.');
  if (!ok) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/operation_sites?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'archived' })
  });
  if (!r.ok) { showToast('Failed to archive', 'error'); return; }
  logAudit('site', id, 'archived', 'Site archived');
  showToast('Site archived', 'info');
  showOpsList();
}

// ── Site detail ───────────────────────────────────────────

async function loadSiteDetail(id) {
  const h = getHeaders();
  const [siteRes, persRes, equipRes] = await Promise.all([
    apiFetch(`${SUPABASE_URL}/rest/v1/operation_sites?id=eq.${id}`, { headers: h }),
    apiFetch(`${SUPABASE_URL}/rest/v1/operation_site_personnel?site_id=eq.${id}&select=*,personnel(id,full_name,position,national_id,expiry_date)`, { headers: h }),
    apiFetch(`${SUPABASE_URL}/rest/v1/operation_site_equipment?site_id=eq.${id}&select=*,equipment_items(id,serial_number,model,equipment_templates(name),documents(expiry_date))`, { headers: h })
  ]);

  if (!siteRes?.length) return;
  const site = siteRes[0];

  document.getElementById('opsSiteTitle').textContent = site.title;
  document.getElementById('opsEditBtn').onclick    = () => openEditSite(id, site.title);
  document.getElementById('opsArchiveBtn').onclick = () => archiveSite(id);

  // Stats
  const persItems  = persRes  || [];
  const equipItems = equipRes || [];
  const allDays    = [];
  persItems.forEach(item => { const d = daysUntil(item.personnel?.expiry_date); if (d !== null) allDays.push(d); });
  equipItems.forEach(item => {
    (item.equipment_items?.documents || []).forEach(doc => { const d = daysUntil(doc.expiry_date); if (d !== null) allDays.push(d); });
  });
  const nearestDays = allDays.length ? Math.min(...allDays) : null;
  const expCls      = expiryStatusClass(nearestDays);

  let expText = '—';
  if (nearestDays !== null) {
    if (nearestDays < 0)   expText = `${Math.abs(nearestDays)}d overdue`;
    else if (nearestDays === 0) expText = 'TODAY';
    else expText = `${nearestDays}d`;
  }

  document.getElementById('opsStatPers').textContent  = persItems.length;
  document.getElementById('opsStatEquip').textContent = equipItems.length;
  const expiryEl = document.getElementById('opsStatExpiry');
  expiryEl.textContent = expText;
  expiryEl.className   = `ops-stat-val ${expCls}`;

  renderSitePersonnel(persItems);
  renderSiteEquipment(equipItems);
}

function renderSitePersonnel(items) {
  const el = document.getElementById('opsSitePersonnel');
  if (!items.length) { el.innerHTML = '<div class="empty">No personnel assigned to this site.</div>'; return; }
  el.innerHTML = items.map(item => {
    const p    = item.personnel;
    const days = daysUntil(p?.expiry_date);
    const cls  = expiryStatusClass(days);
    const expiry = p?.expiry_date ? `Expires ${new Date(p.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No expiry date';
    return `
    <div class="ops-item-row ops-item-${cls}">
      <div class="item-info">
        <div class="item-name row-gap-xs">${esc(p?.full_name || '—')} ${daysBadge(days)}</div>
        <div class="item-detail">${esc(p?.position || '')} · ID: ${esc(p?.national_id || '—')} · ${expiry}</div>
      </div>
      <button class="btn-danger" onclick="removeSitePersonnel(${parseInt(item.id)})">Remove</button>
    </div>`;
  }).join('');
}

function renderSiteEquipment(items) {
  const el = document.getElementById('opsSiteEquipment');
  if (!items.length) { el.innerHTML = '<div class="empty">No equipment assigned to this site.</div>'; return; }
  el.innerHTML = items.map(item => {
    const eq      = item.equipment_items;
    const docs    = eq?.documents || [];
    const allDays = docs.filter(d => d.expiry_date).map(d => daysUntil(d.expiry_date));
    const minDays = allDays.length ? Math.min(...allDays) : null;
    const cls     = expiryStatusClass(minDays);
    const name    = esc(eq?.equipment_templates?.name || eq?.model || '—');
    return `
    <div class="ops-item-row ops-item-${cls}">
      <div class="item-info">
        <div class="item-name row-gap-xs">${name} ${daysBadge(minDays)}</div>
        <div class="item-detail">S/N: ${esc(eq?.serial_number || '—')} · ${docs.length} document${docs.length !== 1 ? 's' : ''}</div>
      </div>
      <button class="btn-danger" onclick="removeSiteEquipment(${parseInt(item.id)})">Remove</button>
    </div>`;
  }).join('');
}

// ── Personnel selector ────────────────────────────────────

async function openSitePersonnelSelector() {
  const h = getHeaders();
  const [peopleRes, assignedRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/personnel?assessed=eq.true&select=*&order=full_name`, { headers: h }),
    fetch(`${SUPABASE_URL}/rest/v1/operation_site_personnel?site_id=eq.${currentSiteId}&select=id,personnel_id`, { headers: h })
  ]);
  if (peopleRes.status === 401) { localStorage.removeItem('radp_token'); localStorage.removeItem('radp_user'); showPage('login'); return; }
  const people   = peopleRes.ok  ? await peopleRes.json()  : [];
  const assigned = assignedRes.ok ? await assignedRes.json() : [];
  const assignedMap = Object.fromEntries(assigned.map(a => [String(a.personnel_id), a.id]));

  const list = document.getElementById('opsPersSelList');
  list.innerHTML = people.map(p => {
    const rowId   = assignedMap[String(p.id)];
    const isAdded = !!rowId;
    const days    = daysUntil(p.expiry_date);
    const safePId = parseInt(p.id);
    const safeRId = parseInt(rowId);
    let badge = '';
    if (days !== null) {
      if (days < 0)     badge = `<span class="sbadge sbadge-expired">EXPIRED</span>`;
      else if (days <= 30) badge = `<span class="sbadge sbadge-expiring">${days}d</span>`;
      else                 badge = `<span class="sbadge sbadge-ready">✓ ${days}d</span>`;
    }
    if (isAdded) {
      return `<div class="item-row">
        <div class="item-info">
          <div class="item-name row-gap-xs">${esc(p.full_name)} ${badge}</div>
          <div class="item-detail">${esc(p.position || '')} · <em style="color:var(--text-4);">Already assigned</em></div>
        </div>
        <button class="btn-danger" onclick="removeSitePersonnel(${safeRId},true)">Remove</button>
      </div>`;
    }
    return `<div class="checkbox-item">
      <div class="row-gap-md"><input type="checkbox" id="ops_per_${safePId}" value="${safePId}">
      <label for="ops_per_${safePId}" class="label-row"><strong>${esc(p.full_name)}</strong>${badge}<span style="color:var(--text-3);font-size:12px;"> · ${esc(p.position || '')}</span></label></div>
      <button class="btn-success btn-success-sm" style="flex-shrink:0;" onclick="addPersonnelToSite(${safePId})">Add</button>
    </div>`;
  }).join('') || '<div class="empty">No approved personnel available. Personnel must pass an assessment first.</div>';

  openModal('opsPersModal');
  const q = document.getElementById('opsPersSelSearch').value;
  if (q) filterCheckboxList('opsPersSelList', q);
}

async function addPersonnelToSite(persId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/operation_site_personnel`, {
    method: 'POST',
    headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ site_id: currentSiteId, personnel_id: persId })
  });
  if (!r.ok) { showToast('Failed to add', 'error'); return; }
  const person = await apiFetch(`${SUPABASE_URL}/rest/v1/personnel?id=eq.${persId}&select=full_name`, { headers: getHeaders() });
  const persLabel = person?.[0]?.full_name || 'Personnel';
  logAudit('site', currentSiteId, 'added_personnel', persLabel);
  loadSiteDetail(currentSiteId);
  openSitePersonnelSelector();
}

async function addSelectedSitePersonnel() {
  const checked = [...document.querySelectorAll('#opsPersSelList input:checked')].map(c => parseInt(c.value));
  if (!checked.length) { showToast('Select at least one person', 'warn'); return; }
  for (const id of checked) {
    await fetch(`${SUPABASE_URL}/rest/v1/operation_site_personnel`, {
      method: 'POST',
      headers: { ...getHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ site_id: currentSiteId, personnel_id: id })
    });
    const person = await apiFetch(`${SUPABASE_URL}/rest/v1/personnel?id=eq.${id}&select=full_name`, { headers: getHeaders() });
    const persLabel = person?.[0]?.full_name || 'Personnel';
    logAudit('site', currentSiteId, 'added_personnel', persLabel);
  }
  closeModal('opsPersModal');
  loadSiteDetail(currentSiteId);
  showToast('Personnel assigned', 'success');
}

async function removeSitePersonnel(rowId, fromSelector = false) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/operation_site_personnel?id=eq.${rowId}`, {
    method: 'DELETE', headers: { ...getHeaders(), Prefer: 'return=minimal' }
  });
  if (!r.ok) { showToast('Failed to remove', 'error'); return; }
  logAudit('site', currentSiteId, 'removed_personnel', `Personnel entry ${rowId}`);
  if (fromSelector) { loadSiteDetail(currentSiteId); openSitePersonnelSelector(); }
  else loadSiteDetail(currentSiteId);
}

// ── Equipment selector ────────────────────────────────────

async function openSiteEquipmentSelector() {
  const h = getHeaders();
  const [itemsRes, assignedRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/equipment_items?assessed=eq.true&dismissed=is.false&parent_id=is.null&select=*,equipment_templates(name),documents(expiry_date)&order=created_at`, { headers: h }),
    fetch(`${SUPABASE_URL}/rest/v1/operation_site_equipment?site_id=eq.${currentSiteId}&select=id,equipment_item_id`, { headers: h })
  ]);
  if (itemsRes.status === 401) { localStorage.removeItem('radp_token'); localStorage.removeItem('radp_user'); showPage('login'); return; }
  const items    = itemsRes.ok  ? await itemsRes.json()  : [];
  const assigned = assignedRes.ok ? await assignedRes.json() : [];
  const assignedMap = Object.fromEntries(assigned.map(a => [String(a.equipment_item_id), a.id]));

  const list = document.getElementById('opsEquipSelList');
  list.innerHTML = items.map(i => {
    const rowId   = assignedMap[String(i.id)];
    const isAdded = !!rowId;
    const docs    = i.documents || [];
    const allDays = docs.filter(d => d.expiry_date).map(d => daysUntil(d.expiry_date));
    const minDays = allDays.length ? Math.min(...allDays) : null;
    const safeId  = parseInt(i.id);
    const safeRId = parseInt(rowId);
    const label   = esc(i.equipment_templates?.name || i.model || '—');
    const detail  = `S/N: ${esc(i.serial_number || '—')}`;
    let badge = '';
    if (minDays !== null) {
      if (minDays < 0)     badge = `<span class="sbadge sbadge-expired">EXPIRED</span>`;
      else if (minDays <= 30) badge = `<span class="sbadge sbadge-expiring">${minDays}d</span>`;
      else                    badge = `<span class="sbadge sbadge-ready">✓ ${minDays}d</span>`;
    }
    if (isAdded) {
      return `<div class="item-row">
        <div class="item-info">
          <div class="item-name row-gap-xs">${label} ${badge}</div>
          <div class="item-detail">${detail} · <em style="color:var(--text-4);">Already assigned</em></div>
        </div>
        <button class="btn-danger" onclick="removeSiteEquipment(${safeRId},true)">Remove</button>
      </div>`;
    }
    return `<div class="checkbox-item">
      <div class="row-gap-md"><input type="checkbox" id="ops_eq_${safeId}" value="${safeId}">
      <label for="ops_eq_${safeId}" class="label-row"><strong>${label}</strong>${badge}<span style="color:var(--text-3);font-size:12px;"> · ${detail}</span></label></div>
      <button class="btn-success btn-success-sm" style="flex-shrink:0;" onclick="addEquipmentToSite(${safeId})">Add</button>
    </div>`;
  }).join('') || '<div class="empty">No approved equipment available. Equipment must pass an assessment first.</div>';

  openModal('opsEquipModal');
  const q = document.getElementById('opsEquipSelSearch').value;
  if (q) filterCheckboxList('opsEquipSelList', q);
}

async function addEquipmentToSite(itemId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/operation_site_equipment`, {
    method: 'POST',
    headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ site_id: currentSiteId, equipment_item_id: itemId })
  });
  if (!r.ok) { showToast('Failed to add', 'error'); return; }
  const equip = await apiFetch(`${SUPABASE_URL}/rest/v1/equipment_items?id=eq.${itemId}&select=name,serial_number`, { headers: getHeaders() });
  const equipLabel = equip?.[0] ? `${equip[0].name || 'Equipment'} - ${equip[0].serial_number || ''}` : 'Equipment';
  logAudit('site', currentSiteId, 'added_equipment', equipLabel);
  loadSiteDetail(currentSiteId);
  openSiteEquipmentSelector();
}

async function addSelectedSiteEquipment() {
  const checked = [...document.querySelectorAll('#opsEquipSelList input:checked')].map(c => parseInt(c.value));
  if (!checked.length) { showToast('Select at least one item', 'warn'); return; }
  for (const id of checked) {
    await fetch(`${SUPABASE_URL}/rest/v1/operation_site_equipment`, {
      method: 'POST',
      headers: { ...getHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ site_id: currentSiteId, equipment_item_id: id })
    });
  }
  closeModal('opsEquipModal');
  loadSiteDetail(currentSiteId);
  showToast('Equipment assigned', 'success');
}

async function removeSiteEquipment(rowId, fromSelector = false) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/operation_site_equipment?id=eq.${rowId}`, {
    method: 'DELETE', headers: { ...getHeaders(), Prefer: 'return=minimal' }
  });
  if (!r.ok) { showToast('Failed to remove', 'error'); return; }
  if (fromSelector) { loadSiteDetail(currentSiteId); openSiteEquipmentSelector(); }
  else loadSiteDetail(currentSiteId);
}

async function printSiteSummary() {
  const h = getHeaders();
  const [siteRes, persRes, equipRes] = await Promise.all([
    apiFetch(`${SUPABASE_URL}/rest/v1/operation_sites?id=eq.${currentSiteId}`, { headers: h }),
    apiFetch(`${SUPABASE_URL}/rest/v1/operation_site_personnel?site_id=eq.${currentSiteId}&select=*,personnel(full_name,position,national_id)`, { headers: h }),
    apiFetch(`${SUPABASE_URL}/rest/v1/operation_site_equipment?site_id=eq.${currentSiteId}&select=*,equipment_items(serial_number,model,equipment_templates(name))`, { headers: h }),
  ]);
  if (!siteRes || !persRes || !equipRes) return;
  const site = siteRes[0];
  if (!site) { showToast('Site not found', 'error'); return; }
  const today = new Date().toLocaleDateString('en-GB');
  const persRows = persRes.map(r => `
    <tr>
      <td>${esc(r.personnel?.full_name || '—')}</td>
      <td>${esc(r.personnel?.position || '—')}</td>
      <td>${esc(r.personnel?.national_id || '—')}</td>
    </tr>`).join('');
  const equipRows = equipRes.map(r => `
    <tr>
      <td>${esc(r.equipment_items?.equipment_templates?.name || r.equipment_items?.model || '—')}</td>
      <td>${esc(r.equipment_items?.model || '—')}</td>
      <td>${esc(r.equipment_items?.serial_number || '—')}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Site Summary — ${esc(site.title)}</title>
    <style>
      body { font-family:Arial,sans-serif; font-size:12px; margin:20px; color:#000; }
      h1 { font-size:16px; margin-bottom:4px; }
      h2 { font-size:13px; margin:16px 0 6px; background:#1e3a5f; color:#fff; padding:5px 10px; }
      table { width:100%; border-collapse:collapse; margin-bottom:12px; }
      th { text-align:left; padding:5px 8px; font-size:11px; background:#e8edf2; border:1px solid #bbb; }
      td { padding:4px 8px; border:1px solid #ddd; font-size:11px; }
      .meta { color:#555; font-size:11px; margin-bottom:12px; }
      @media print { @page { size:A4; margin:12mm; } }
    </style>
  </head><body>
    <h1>Operation Site Summary</h1>
    <div class="meta"><strong>${esc(site.title)}</strong> · Printed ${today}</div>
    <h2>Personnel (${persRes.length})</h2>
    <table>
      <thead><tr><th>Name</th><th>Position</th><th>National ID</th></tr></thead>
      <tbody>${persRows || '<tr><td colspan="3">No personnel assigned</td></tr>'}</tbody>
    </table>
    <h2>Equipment (${equipRes.length})</h2>
    <table>
      <thead><tr><th>Description</th><th>Model</th><th>Serial No.</th></tr></thead>
      <tbody>${equipRows || '<tr><td colspan="3">No equipment assigned</td></tr>'}</tbody>
    </table>
    <div style="margin-top:16px;"><button onclick="window.print()" style="background:#1e3a5f;color:white;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;">Print / Save PDF</button></div>
  </body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
// Page initialization
async function operationsInit() {
  await loadOperations();
}
