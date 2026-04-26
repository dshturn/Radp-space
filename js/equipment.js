// ═══════════════════ EQUIPMENT ═══════════════════
let _equipPage = 0;
let _equipSearch = '';
const _EQUIP_PAGE_SIZE = 25;
let _equipBulkMode = false;

async function openAddEquipment() {
  const u = getUser(), h = getHeaders();
  const templates = await apiFetch(`${SUPABASE_URL}/rest/v1/equipment_templates?service_line=eq.${encodeURIComponent(u.service_line)}&order=name`, { headers: h }) || [];
  document.getElementById('equipSelect').innerHTML =
    '<option value="">Select equipment type...</option>'
    + templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
    + '<option value="__new__">+ Add new equipment type...</option>';
  document.getElementById('newEquipNameWrap').style.display = 'none';
  document.getElementById('equipName').value  = '';
  document.getElementById('equipSerial').value = '';
  openModal('ctEquipModal');
}

function onEquipSelectChange(sel) {
  document.getElementById('newEquipNameWrap').style.display = sel.value === '__new__' ? 'block' : 'none';
}

async function loadEquipment(preserveState = false) {
  let expandedIds = new Set(), expandedGroups = new Set(), scrollY = 0;
  if (preserveState) {
    document.querySelectorAll('.app-card.expanded, .sub-card.expanded, .sub-child-card.expanded').forEach(c => { if (c.dataset.id) expandedIds.add(c.dataset.id); });
    document.querySelectorAll('#equipmentList .eq-group:not(.collapsed)').forEach(g => {
      const title = g.querySelector('.group-title');
      if (title) expandedGroups.add(title.textContent.trim());
    });
  }
  const h = getHeaders();

  const from = _equipPage * _EQUIP_PAGE_SIZE;
  const isAdmin = roleOf(getUser()) === 'admin';
  const res  = await fetch(
    `${SUPABASE_URL}/rest/v1/equipment_items?dismissed=is.false&parent_id=is.null&select=*,equipment_templates(name)&order=created_at${_equipSearch ? `&equipment_templates.name=ilike.*${encodeURIComponent(_equipSearch)}*` : ''}&offset=${from}&limit=${_EQUIP_PAGE_SIZE}`,
    { headers: { ...h, Prefer: 'count=exact' } }
  );
  if (res.status === 401) { localStorage.removeItem('radp_token'); localStorage.removeItem('radp_user'); showPage('login'); return; }
  if (!res.ok) { showToast('Failed to load equipment', 'error'); return; }
  const items = await res.json();
  const totalCount = parseInt(res.headers.get('Content-Range')?.split('/')[1] || '0', 10);

  // For admin: load company names for all contractors
  if (isAdmin && items.length > 0) {
    const contractorIds = [...new Set(items.map(i => i.contractor_id))].join(',');
    const contractors = await apiFetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=in.(${contractorIds})&select=id,company`, { headers: h }) || [];
    const companyMap = Object.fromEntries(contractors.map(c => [c.id, c.company]));
    items.forEach(i => { if (!i.contractor_id_obj) i.contractor_id_obj = {}; i.contractor_id_obj.company = companyMap[i.contractor_id]; });
  }

  // Fetch sub-components for the current page's items
  const rootIds = items.map(i => i.id).join(',');
  let allSubs = [];
  if (rootIds) {
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/equipment_items?dismissed=is.false&parent_id=in.(${rootIds})&select=*&order=created_at`,
      { headers: h }
    );
    if (subsRes.ok) {
      const directSubs = await subsRes.json();
      // Also fetch grandchildren (sub-children) for those subs
      const subIds = directSubs.map(s => s.id).join(',');
      let grandChildren = [];
      if (subIds) {
        const gcRes = await fetch(
          `${SUPABASE_URL}/rest/v1/equipment_items?dismissed=is.false&parent_id=in.(${subIds})&select=*&order=created_at`,
          { headers: h }
        );
        if (gcRes.ok) grandChildren = await gcRes.json();
      }
      allSubs = [...directSubs, ...grandChildren];
    }
  }

  const activeItems = items;
  const topLevel = items;
  const subsByParent = {};
  allSubs.forEach(s => {
    if (!subsByParent[s.parent_id]) subsByParent[s.parent_id] = [];
    subsByParent[s.parent_id].push(s);
  });

  // Load docs for active items
  const itemIds = activeItems.map(i => i.id).join(',');
  let docs = [];
  if (itemIds) docs = await apiFetch(`${SUPABASE_URL}/rest/v1/documents?equipment_item_id=in.(${itemIds})&select=*&order=uploaded_at.desc`, { headers: h }) || [];
  const docsByItem = {};
  docs.forEach(d => { if (!docsByItem[d.equipment_item_id]) docsByItem[d.equipment_item_id] = []; docsByItem[d.equipment_item_id].push(d); });

  // Group top-level items by type name
  const eqGroups = {};
  topLevel.forEach(i => {
    const key = i.name || 'Other';
    if (!eqGroups[key]) eqGroups[key] = [];
    eqGroups[key].push(i);
  });
  if (preserveState) scrollY = window.scrollY;
  document.getElementById('equipmentList').innerHTML = topLevel.length
    ? Object.entries(eqGroups).sort(([a],[b]) => a.localeCompare(b)).map(([type, items]) => {
        const cardsHtml = items.map(i => equipItemCard(i, i.name || 'Equipment', docsByItem[i.id] || [], subsByParent[i.id] || [], docsByItem, subsByParent, isAdmin)).join('');
        const _t = todayUTC();
        const _i30 = new Date(_t); _i30.setDate(_t.getDate() + 30);
        let [_exp, _expir, _ok, _missing, _review] = [0, 0, 0, 0, 0];
        items.forEach(i => {
          const allD = [...(docsByItem[i.id]||[]), ...(subsByParent[i.id]||[]).flatMap(s => [...(docsByItem[s.id]||[]), ...(subsByParent[s.id]||[]).flatMap(sc => docsByItem[sc.id]||[])])];
          if      (allD.length === 0)                                                                                         _missing++;
          else if (!i.assessed)                                                                                               _review++;
          else if (allD.some(d => d.expiry_date && new Date(d.expiry_date) < _t))                                            _exp++;
          else if (allD.some(d => d.expiry_date && new Date(d.expiry_date) >= _t && new Date(d.expiry_date) <= _i30))        _expir++;
          else                                                                                                                _ok++;
        });
        return `<div class="eq-group collapsed">
          <div class="group-header" onclick="toggleGroup(this)">
            <span class="group-title">${esc(type)}</span>
            ${grpBadges(_exp, _expir, _ok, _missing, _review)}
            <span class="group-toggle">▾</span>
          </div>
          <div class="group-body"><div class="group-body-inner">${cardsHtml}</div></div>
        </div>`;
      }).join('')
    : '<div class="empty">No equipment yet. Click "+ Add Equipment" to start.</div>';
  if (_equipBulkMode) updateEquipBulkCount();

  const totalPages = Math.ceil(totalCount / _EQUIP_PAGE_SIZE);
  const pagEl = document.getElementById('equipmentPagination');
  if (pagEl) {
    if (totalPages <= 1) { pagEl.innerHTML = ''; }
    else {
      pagEl.innerHTML = `
        <div class="pagination">
          <button class="pag-btn" onclick="_equipPage=Math.max(0,_equipPage-1);loadEquipment()" ${_equipPage === 0 ? 'disabled' : ''}>← Prev</button>
          <span class="pag-info">Page ${_equipPage + 1} of ${totalPages}</span>
          <button class="pag-btn" onclick="_equipPage=Math.min(${totalPages-1},_equipPage+1);loadEquipment()" ${_equipPage >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
        </div>`;
    }
  }

  if (preserveState) {
    // Suppress transitions so state restoration is instant (no animate-open flash)
    const noTrans = document.createElement('style');
    noTrans.id = '_equipNoTrans';
    noTrans.textContent = '#equipmentList .group-body,#equipmentList .card-body,#equipmentList .sub-card-body,#equipmentList .sub-child-body{transition:none!important;opacity:1!important;grid-template-rows:unset!important}';
    document.head.appendChild(noTrans);

    expandedIds.forEach(id => { const el = document.querySelector(`[data-id="${id}"]`); if (el) el.classList.add('expanded'); });
    document.querySelectorAll('#equipmentList .eq-group').forEach(g => {
      const title = g.querySelector('.group-title');
      if (title && expandedGroups.has(title.textContent.trim())) g.classList.remove('collapsed');
    });
    window.scrollTo({ top: scrollY, behavior: 'instant' });

    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById('_equipNoTrans')?.remove();
    }));
  }

  // Animate newly added card or doc
  if (window._justAddedId) {
    animateNewEl(document.querySelector(`[data-id="${window._justAddedId}"]`));
    window._justAddedId = null;
  }
  if (window._justAddedDocId) {
    animateNewEl(document.querySelector(`[data-doc-id="${window._justAddedDocId}"]`));
    window._justAddedDocId = null;
  }

  // ── Mini dashboard: equipment + docs stats ──
  const today = todayUTC();
  const in30  = new Date(today); in30.setDate(in30.getDate() + 30);
  let totalDocs = 0, expiredDocs = 0, expiringDocs = 0;
  docs.forEach(d => {
    totalDocs++;
    if (d.expiry_date) {
      const exp = new Date(d.expiry_date);
      if (exp < today)      expiredDocs++;
      else if (exp <= in30) expiringDocs++;
    }
  });
  const eqEl   = document.getElementById('dashEquip');
  const eqSub  = document.getElementById('dashEquipSub');
  const eqTile = eqEl.closest('.dash-tile');
  eqEl.textContent  = totalCount;
  eqSub.textContent = `${totalCount} registered`;
  eqTile.className  = 'dash-tile ' + (totalCount > 0 ? 'ok' : 'info');
  const dcEl   = document.getElementById('dashDocs');
  const dcSub  = document.getElementById('dashDocsSub');
  const dcTile = dcEl.closest('.dash-tile');
  dcEl.textContent = totalDocs;
  if (expiredDocs > 0) {
    dcSub.textContent = `${expiredDocs} expired`;
    dcTile.className = 'dash-tile bad';
  } else if (expiringDocs > 0) {
    dcSub.textContent = `${expiringDocs} expiring soon`;
    dcTile.className = 'dash-tile warn';
  } else {
    dcSub.textContent = totalDocs > 0 ? 'All valid' : 'No documents';
    dcTile.className = 'dash-tile ' + (totalDocs > 0 ? 'ok' : 'info');
  }
  dcSub.style.color = '';
}

function equipItemCard(item, name, docs, subs = [], docsByItem = {}, subsByParent = {}, isAdmin = false) {

  const _today = todayUTC();
  const _in30  = new Date(_today); _in30.setDate(_in30.getDate() + 30);
  const isExp     = d => d.expiry_date && parseUTC(d.expiry_date) < _today;
  const isExpiring = d => { if (!d.expiry_date) return false; const e = parseUTC(d.expiry_date); return e >= _today && e <= _in30; };
  const mkBadge   = (exp, expir) => exp > 0
    ? `<span class="sbadge sbadge-expired">⚠ ${exp} EXPIRED</span>`
    : expir > 0
    ? `<span class="sbadge sbadge-expiring">⚠ ${expir} EXPIRING</span>`
    : '';

  const docsHtml = docs.length ? docs.map(d => {
    const typeName = esc(d.doc_type_name || '—');
    const expiry   = d.expiry_date;
    const today = _today, in30 = _in30;
    let statusClass = 'doc-status-valid', statusText = 'VALID';
    if (expiry) {
      const exp = new Date(expiry);
      if (exp < today)      { statusClass = 'doc-status-expired';  statusText = 'EXPIRED'; }
      else if (exp <= in30) { statusClass = 'doc-status-expiring'; statusText = 'EXPIRING'; }
    }
    const fileBtn = d.file_url ? `<button class="doc-view-btn" data-url="${esc(d.file_url)}" onclick="openDoc(this.dataset.url)" aria-label="View ${typeName} document">↗ View</button>` : '';
    const rowClass = statusText === 'EXPIRED' ? ' status-expired' : statusText === 'EXPIRING' ? ' status-expiring' : '';
    return `<div class="doc-row${rowClass}" data-doc-id="${parseInt(d.id)}">
      <div class="flex-1">
        <div class="doc-name">${typeName}</div>
        <div class="doc-date">Issue: ${esc(d.issue_date || '—')} · Expiry: ${esc(expiry || '—')}</div>
      </div>
      <div class="row-gap-sm">
        ${fileBtn}
        <span class="doc-status ${statusClass}">${statusText}</span>
        <button class="btn-danger" onclick="deleteDoc(${parseInt(d.id)})" aria-label="Delete ${typeName} document">✕</button>
      </div>
    </div>`;
  }).join('') : `<div class="doc-date doc-empty">No documents yet</div>`;

  // Badge for own docs only (used on DOCUMENTS header)
  const ownDocsBadge = mkBadge(docs.filter(isExp).length, docs.filter(isExpiring).length);
  // Badge rolled up from all nested docs (used on title/SN line)
  const allNestedDocs = [
    ...docs,
    ...subs.flatMap(sub => [
      ...(docsByItem[sub.id] || []),
      ...(subsByParent[sub.id] || []).flatMap(sc => docsByItem[sc.id] || [])
    ])
  ];
  let alertBadge = '';
  if (allNestedDocs.length === 0) {
    alertBadge = `<span class="sbadge sbadge-missing">MISSING DOCS</span>`;
  } else if (!item.assessed) {
    alertBadge = `<span class="sbadge sbadge-awaiting">AWAITING REVIEW</span>`;
  } else {
    const _expC = allNestedDocs.filter(isExp).length, _expirC = allNestedDocs.filter(isExpiring).length;
    alertBadge = _expC > 0
      ? `<span class="sbadge sbadge-expired">⚠ ${_expC} EXPIRED</span>`
      : _expirC > 0
      ? `<span class="sbadge sbadge-expiring">⚠ ${_expirC} EXPIRING</span>`
      : `<span class="sbadge sbadge-ready">READY</span>`;
  }

  const subsHtml = subs.map(sub => {
    const subDocs = docsByItem[sub.id] || [];
    const subDocsHtml = subDocs.length ? subDocs.map(d => {
      const expiry = d.expiry_date;
      const typeName = esc(d.doc_type_name || '—');
      let statusClass = 'doc-status-valid', statusText = 'VALID';
      if (expiry) {
        const exp = new Date(expiry);
        if (exp < _today)      { statusClass = 'doc-status-expired';  statusText = 'EXPIRED'; }
        else if (exp <= _in30) { statusClass = 'doc-status-expiring'; statusText = 'EXPIRING'; }
      }
      const fileBtn = d.file_url ? `<button class="doc-view-btn" data-url="${esc(d.file_url)}" onclick="openDoc(this.dataset.url)" aria-label="View ${typeName} document">↗ View</button>` : '';
      return `<div class="doc-row doc-row-sm" data-doc-id="${parseInt(d.id)}">
        <div class="flex-1"><div class="doc-name">${typeName}</div><div class="doc-date">Issue: ${esc(d.issue_date || '—')} · Expiry: ${esc(expiry || '—')}</div></div>
        <div class="row-gap-sm">${fileBtn}<span class="doc-status ${statusClass}">${statusText}</span><button class="btn-danger" onclick="deleteDoc(${parseInt(d.id)})" aria-label="Delete ${typeName} document">✕</button></div>
      </div>`;
    }).join('') : `<div class="doc-date doc-empty-sm">No documents yet</div>`;
    const subChildren = subsByParent[sub.id] || [];
    const subOwnDocsBadge = mkBadge(subDocs.filter(isExp).length, subDocs.filter(isExpiring).length);
    const allSubDocs = [...subDocs, ...subChildren.flatMap(sc => docsByItem[sc.id] || [])];
    const subAlertBadge = mkBadge(allSubDocs.filter(isExp).length, allSubDocs.filter(isExpiring).length);
    const subChildrenHtml = subChildren.map(sc => {
      const scDocs = docsByItem[sc.id] || [];
      const scDocsHtml = scDocs.length ? scDocs.map(d => {
        const expiry = d.expiry_date;
        const typeName = esc(d.doc_type_name || '—');
        let statusClass = 'doc-status-valid', statusText = 'VALID';
        if (expiry) { const exp = new Date(expiry); if (exp < _today) { statusClass = 'doc-status-expired'; statusText = 'EXPIRED'; } else if (exp <= _in30) { statusClass = 'doc-status-expiring'; statusText = 'EXPIRING'; } }
        const fileBtn = d.file_url ? `<button class="doc-view-btn" data-url="${esc(d.file_url)}" onclick="openDoc(this.dataset.url)" aria-label="View ${typeName} document">↗ View</button>` : '';
        return `<div class="doc-row doc-row-xs" data-doc-id="${parseInt(d.id)}">
          <div class="flex-1"><div class="doc-name">${typeName}</div><div class="doc-date">Issue: ${esc(d.issue_date||'—')} · Expiry: ${esc(expiry||'—')}</div></div>
          <div class="row-gap-xs">${fileBtn}<span class="doc-status ${statusClass}">${statusText}</span><button class="btn-danger" onclick="deleteDoc(${parseInt(d.id)})" aria-label="Delete ${typeName} document">✕</button></div>
        </div>`;
      }).join('') : `<div class="doc-date doc-empty-xs">No documents yet</div>`;
      const scHasDeeper = (subsByParent[sc.id] || []).length > 0;
      const scAlertBadge = mkBadge(scDocs.filter(isExp).length, scDocs.filter(isExpiring).length);
      const scName   = esc(sc.name || 'Sub-child');
      const scSerial = esc(sc.serial_number || '—');
      return `<div class="sub-child-card" data-id="${parseInt(sc.id)}">
        <div class="sub-child-header">
          <div class="card-clickable" onclick="toggleSubCard(this.closest('.sub-child-card'))">
            <div class="sub-child-title">${scName}</div>
            <div class="card-meta">
              <div class="doc-name" style="font-size:10px;">S/N: ${scSerial}</div>
              ${scAlertBadge}
            </div>
          </div>
          <div class="row-gap-xs">
            ${scHasDeeper ? `<span title="Has nested sub-components not shown" class="depth-badge">↳ ${parseInt((subsByParent[sc.id]).length)}</span>` : ''}
            <button class="btn-reassign" onclick="openReassignModal(${parseInt(sc.id)}, this.dataset.name, ${parseInt(sub.id)})" data-name="${scName}" aria-label="Change parent of ${scName}">⇄</button>
            <button class="btn-toggle" onclick="toggleSubCard(this.closest('.sub-child-card'))" aria-label="Expand ${scName}">▾</button>
            <button class="btn-danger" onclick="deleteEquipItem(${parseInt(sc.id)})" aria-label="Delete ${scName}">✕</button>
          </div>
        </div>
        <div class="sub-child-body">
          <div class="body-inner"><div class="body-content">
            <div class="doc-group collapsed">
              <div class="doc-group-header" onclick="toggleDocGroup(this)">
                <span class="doc-group-title">Documents</span>
                ${scAlertBadge}
                <span class="doc-group-count">${scDocs.length}</span>
                <span class="doc-group-toggle">▾</span>
              </div>
              <div class="doc-group-body"><div class="doc-group-inner">
                ${scDocsHtml}
                <button class="upload-btn upload-btn-sm" onclick="openAddDoc(${parseInt(sc.id)}, '${esc(sc.name)}')">+ Add Document</button>
              </div></div>
            </div>
          </div></div>
        </div>
      </div>`;
    }).join('');

    const subName   = esc(sub.name || 'Sub-component');
    const subSerial = esc(sub.serial_number || '—');
    return `<div class="sub-card" data-id="${parseInt(sub.id)}">
      <div class="sub-card-header">
        <div class="card-clickable" onclick="toggleSubCard(this.closest('.sub-card'))">
          <div class="sub-card-title">${subName}</div>
          <div class="card-meta">
            <div class="doc-name" style="font-size:11px;">S/N: ${subSerial}</div>
            ${subAlertBadge}
          </div>
        </div>
        <div class="row-gap-xs">
          <button class="btn-reassign" onclick="openReassignModal(${parseInt(sub.id)}, this.dataset.name, ${parseInt(item.id)})" data-name="${subName}" aria-label="Change parent of ${subName}">⇄</button>
          <button class="btn-toggle" onclick="toggleSubCard(this.closest('.sub-card'))" aria-label="Expand ${subName}">▾</button>
          <button class="btn-danger" onclick="deleteEquipItem(${parseInt(sub.id)})" aria-label="Delete ${subName}">✕</button>
        </div>
      </div>
      <div class="sub-card-body">
        <div class="body-inner"><div class="body-content">
          <div class="doc-group collapsed">
            <div class="doc-group-header" onclick="toggleDocGroup(this)">
              <span class="doc-group-title">Documents</span>
              ${subOwnDocsBadge}
              <span class="doc-group-count">${subDocs.length}</span>
              <span class="doc-group-toggle">▾</span>
            </div>
            <div class="doc-group-body"><div class="doc-group-inner">
              ${subDocsHtml}
              <button class="upload-btn upload-btn-sm" onclick="openAddDoc(${parseInt(sub.id)}, '${sub.name.replace(/'/g, "\\'")}')">+ Add Document</button>
            </div></div>
          </div>
          <div class="mt-sm">
            ${subChildrenHtml}
            <button class="add-sub-btn add-sub-btn-sm" onclick="openAddSubComponent(${parseInt(sub.id)}, this.dataset.name)" data-name="${subName}">+ Add Sub-child</button>
          </div>
        </div></div>
      </div>
    </div>`;
  }).join('');

  const safeName   = esc(name);
  const safeSerial = esc(item.serial_number || '—');
  return `<div class="app-card" data-id="${parseInt(item.id)}">
    <input type="checkbox" class="equip-bulk-check" data-id="${parseInt(item.id)}" style="display:${_equipBulkMode ? 'block' : 'none'};margin:8px;" onchange="updateEquipBulkCount()">
    <div class="card-header">
      <div class="card-clickable" onclick="toggleCard(this.closest('.app-card').querySelector('.btn-toggle'))">
        <div class="card-title">${safeName}</div>
        <div class="card-meta">
          <div class="doc-name">S/N: ${safeSerial}</div>
          ${isAdmin && item.contractor_id_obj?.company ? `<div class="doc-name" style="color:var(--text-3);font-size:11px;">${esc(item.contractor_id_obj.company)}</div>` : ''}
          ${alertBadge}
        </div>
      </div>
      <div class="row-wrap">
        ${isAdmin ? `<button class="btn-edit" onclick="openEditEquipment(${parseInt(item.id)})" aria-label="Edit ${safeName}" style="padding:6px 10px;border:1px solid var(--border);border-radius:4px;background:var(--surface-2);color:var(--text-1);cursor:pointer;font-size:12px;">Edit</button>` : ''}
        <button class="btn-reassign" onclick="openReassignModal(${parseInt(item.id)}, this.dataset.name, null)" data-name="${safeName}" aria-label="Change assignment of ${safeName}">⇄</button>
        <button class="btn-toggle" onclick="toggleCard(this)" aria-label="Expand ${safeName}">▾</button>
        <button class="btn-danger" onclick="deleteEquipItem(${parseInt(item.id)})" aria-label="Delete ${safeName}">✕</button>
      </div>
    </div>
    <div class="card-body">
      <div class="body-inner"><div class="body-content">
        <div class="doc-group collapsed">
          <div class="doc-group-header" onclick="toggleDocGroup(this)">
            <span class="doc-group-title">Documents</span>
            ${ownDocsBadge}
            <span class="doc-group-count">${docs.length}</span>
            <span class="doc-group-toggle">▾</span>
          </div>
          <div class="doc-group-body"><div class="doc-group-inner">
            ${docsHtml}
            <button class="upload-btn upload-btn-sm" onclick="openAddDoc(${parseInt(item.id)}, '${name.replace(/'/g, "\\'")}')">+ Add Document</button>
          </div></div>
        </div>
        <div class="sub-section">
          <div class="sub-label">Sub-components${subs.length ? ` (${subs.length})` : ''}</div>
          ${subsHtml}
          <button class="add-sub-btn" onclick="openAddSubComponent(${parseInt(item.id)}, this.dataset.name)" data-name="${safeName}">+ Add Sub-component</button>
        </div>
      </div></div>
    </div>
  </div>`;
}

async function addEquipment() {
  const selEl  = document.getElementById('equipSelect');
  const tmplId = selEl.value;
  const serial = document.getElementById('equipSerial').value.trim();
  if (!tmplId)  { showToast('Please select an equipment type', 'warn'); return; }
  if (!serial)  { showToast('Please enter a serial number', 'warn'); return; }

  let finalTemplateId = null;
  let finalName       = '';

  if (tmplId === '__new__') {
    const customName = document.getElementById('equipName').value.trim();
    if (!customName) { showToast('Please enter the equipment name', 'warn'); return; }
    const u = getUser();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/equipment_templates`, {
      method: 'POST',
      headers: { ...getHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ name: customName, service_line: u.service_line })
    });
    if (res.ok) {
      const [newTmpl] = await res.json();
      finalTemplateId = newTmpl?.id || null;
    }
    finalName = customName;
  } else {
    finalTemplateId = parseInt(tmplId);
    finalName = selEl.options[selEl.selectedIndex].text;
  }

  const _eqRes = await fetch(`${SUPABASE_URL}/rest/v1/equipment_items`, {
    method: 'POST', headers: { ...getHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({ contractor_id: getUser().id, equipment_template_id: finalTemplateId, serial_number: serial, name: finalName })
  });
  if (_eqRes.ok) { const [_newItem] = await _eqRes.json(); window._justAddedId = _newItem?.id; }
  closeModal('ctEquipModal');
  loadEquipment(true);
}

// ─── Reassign Equipment ───
let currentReassignItemId = null;

async function openReassignModal(itemId, itemName, currentParentId) {
  currentReassignItemId = itemId;
  document.getElementById('reassignTitle').textContent = `Change: ${itemName}`;
  const h = getHeaders();
  const allItems = await apiFetch(`${SUPABASE_URL}/rest/v1/equipment_items?select=*&order=created_at`, { headers: h });
  const active = (allItems || []).filter(i => !i.dismissed && i.id !== itemId);
  const directChildIds = new Set(active.filter(i => i.parent_id === itemId).map(i => i.id));
  const choices = active.filter(i => !directChildIds.has(i.id));

  choices.sort((a, b) => {
    const la = `${a.name || 'Equipment'} ${a.serial_number || ''}`.toLowerCase();
    const lb = `${b.name || 'Equipment'} ${b.serial_number || ''}`.toLowerCase();
    return la.localeCompare(lb);
  });
  window._reassignChoices = choices;
  window._reassignCurrentParentId = currentParentId;
  document.getElementById('reassignSearch').value = '';
  renderReassignList('', currentParentId);

  const isChild = currentParentId !== null;
  document.getElementById(isChild ? 'reassignChild' : 'reassignStandalone').checked = true;
  document.getElementById('reassignParentWrap').style.display = isChild ? 'block' : 'none';

  openModal('reassignModal');
}

function onReassignTypeChange(radio) {
  document.getElementById('reassignParentWrap').style.display = radio.value === 'child' ? 'block' : 'none';
}

function renderReassignList(query, preselect) {
  const q = (query || '').toLowerCase();
  const filtered = (window._reassignChoices || []).filter(i => {
    const label = `${i.name || ''} ${i.serial_number || ''}`.toLowerCase();
    return !q || label.includes(q);
  });
  const container = document.getElementById('reassignList');
  if (!filtered.length) { container.innerHTML = '<div class="no-matches">No matches</div>'; return; }
  container.innerHTML = filtered.map(i => {
    const level  = !i.parent_id ? 'Equipment' : 'Sub-component';
    const label  = `[${level}] ${esc(i.name || 'Equipment')} · S/N: ${esc(i.serial_number || '—')}`;
    const safeId = parseInt(i.id);
    const checked = (preselect != null && String(i.id) === String(preselect)) ? 'checked' : '';
    return `<div class="reassign-option">
      <input type="radio" name="reassignParent" id="rp_${safeId}" value="${safeId}" ${checked}>
      <label for="rp_${safeId}">${label}</label>
    </div>`;
  }).join('');
}

function filterReassignList(query) {
  const checked = document.querySelector('input[name="reassignParent"]:checked');
  const currentVal = checked ? checked.value : null;
  renderReassignList(query, currentVal);
}

async function saveReassign() {
  const type = document.querySelector('input[name="reassignType"]:checked').value;
  let newParentId = null;

  if (type === 'child') {
    const checked = document.querySelector('input[name="reassignParent"]:checked');
    if (!checked) { showToast('Please select a parent equipment', 'warn'); return; }
    newParentId = parseInt(checked.value);
  }

  await fetch(`${SUPABASE_URL}/rest/v1/equipment_items?id=eq.${currentReassignItemId}`, {
    method: 'PATCH',
    headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ parent_id: newParentId })
  });
  closeModal('reassignModal');
  loadEquipment(true);
}

// ─── Sub-component ───
let currentSubParentId = null;

async function openAddSubComponent(parentId, parentName) {
  currentSubParentId = parentId;
  document.getElementById('ctSubModalTitle').textContent = `Add Sub-component to ${parentName}`;
  document.getElementById('subEquipSerial').value = '';
  document.getElementById('subEquipName').value = '';
  document.getElementById('newSubNameWrap').style.display = 'none';
  const h = getHeaders();
  const u = getUser();
  const templates = await apiFetch(`${SUPABASE_URL}/rest/v1/equipment_templates?service_line=eq.${encodeURIComponent(u.service_line)}&order=name`, { headers: h }) || [];
  const sel = document.getElementById('subEquipSelect');
  sel.innerHTML = '<option value="">Select component type...</option>'
    + templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
    + '<option value="__new__">+ Add new type...</option>';
  openModal('ctSubModal');
}

function onSubEquipSelectChange(sel) {
  document.getElementById('newSubNameWrap').style.display = sel.value === '__new__' ? 'block' : 'none';
}

async function addSubComponent() {
  const selEl  = document.getElementById('subEquipSelect');
  const tmplId = selEl.value;
  const serial = document.getElementById('subEquipSerial').value.trim();
  if (!tmplId)  { showToast('Please select a component type', 'warn'); return; }
  if (!serial)  { showToast('Please enter a serial number', 'warn'); return; }

  let finalTemplateId = null;
  let finalName = '';

  if (tmplId === '__new__') {
    const customName = document.getElementById('subEquipName').value.trim();
    if (!customName) { showToast('Please enter the component name', 'warn'); return; }
    const u = getUser();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/equipment_templates`, {
      method: 'POST',
      headers: { ...getHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ name: customName, service_line: u.service_line })
    });
    if (res.ok) {
      const [newTmpl] = await res.json();
      finalTemplateId = newTmpl?.id || null;
    }
    finalName = customName;
  } else {
    finalTemplateId = parseInt(tmplId);
    finalName = selEl.options[selEl.selectedIndex].text;
  }

  const _scRes = await fetch(`${SUPABASE_URL}/rest/v1/equipment_items`, {
    method: 'POST', headers: { ...getHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({ contractor_id: getUser().id, equipment_template_id: finalTemplateId, serial_number: serial, name: finalName, parent_id: currentSubParentId })
  });
  if (_scRes.ok) { const [_newItem] = await _scRes.json(); window._justAddedId = _newItem?.id; }
  closeModal('ctSubModal');
  loadEquipment(true);
}

async function deleteEquipItem(id) {
  if (!await showConfirm('Delete this equipment and all its documents?')) return;
  const el = document.querySelector(`[data-id="${id}"]`);
  // Start API calls immediately so they run in parallel with the animation
  const h = { ...getHeaders(), Prefer: 'return=minimal' };
  const deletePromise = fetch(`${SUPABASE_URL}/rest/v1/documents?equipment_item_id=eq.${id}`, { method: 'DELETE', headers: h })
    .then(() => fetch(`${SUPABASE_URL}/rest/v1/equipment_items?id=eq.${id}`, { method: 'DELETE', headers: h }));
  animateRemoveEl(el, async () => {
    const r = await deletePromise;
    if (!r.ok) { showToast('Delete failed: ' + r.status, 'error'); }
    else { logAudit('equipment', id, 'deleted', 'Equipment item'); }
    loadEquipment(true);
  });
}

async function deleteDoc(id) {
  if (!await showConfirm('Delete this document?')) return;
  const el = document.querySelector(`[data-doc-id="${id}"]`);
  // Start API call immediately so it runs in parallel with the animation
  const deletePromise = fetch(`${SUPABASE_URL}/rest/v1/documents?id=eq.${id}`, { method: 'DELETE', headers: { ...getHeaders(), Prefer: 'return=minimal' } });
  animateRemoveEl(el, async () => {
    const r = await deletePromise;
    if (!r.ok) { showToast('Delete failed: ' + r.status, 'error'); }
    else { logAudit('document', id, 'deleted', 'Equipment document'); }
    loadEquipment(true);
  });
}

// ─── Add Document Modal ───
let currentDocItemId = null;
let currentDocItemName = '';

function openAddDoc(itemId, itemName = '') {
  currentDocItemId = itemId;
  currentDocItemName = itemName;
  document.getElementById('docTypeSelect').value = '';
  document.getElementById('docTypeCustom').style.display = 'none';
  document.getElementById('docTypeCustom').value = '';
  document.getElementById('docIssueDate').value = '';
  document.getElementById('docExpiryDate').value = '';
  document.getElementById('docNoExpiry').checked = false;
  document.getElementById('docExpiryDate').disabled = false;
  document.getElementById('docFileInput').value = '';
  document.getElementById('docFileName').textContent = '';
  openModal('addDocModal');
}

function onDocTypeChange(sel) {
  const custom = document.getElementById('docTypeCustom');
  if (sel.value === '__new__') {
    custom.style.display = 'block';
    custom.focus();
  } else {
    custom.style.display = 'none';
  }
}

async function saveDocument() {
  const typeSelect = document.getElementById('docTypeSelect').value;
  const typeCustom = document.getElementById('docTypeCustom').value.trim();
  const typeName   = typeSelect === '__new__' ? typeCustom : typeSelect;
  const issueDate  = document.getElementById('docIssueDate').value;
  const noExpiry   = document.getElementById('docNoExpiry').checked;
  const expiryDate = noExpiry ? null : document.getElementById('docExpiryDate').value;
  const file       = document.getElementById('docFileInput').files[0];

  if (!typeName) { showToast('Please select or enter a document type', 'warn'); return; }
  if (!file) { showToast('Please attach a file — attachment is required', 'warn'); document.getElementById('docFileBtn').style.borderColor = 'var(--bad)'; return; }
  if (!validateUploadFile(file)) return;
  document.getElementById('docFileBtn').style.borderColor = 'var(--border)';

  let fileUrl = null;
  if (file) {
    const safeName = file.name.replace(/[^\x00-\x7F]/g, c => encodeURIComponent(c)).replace(/\s+/g, '_');
    const path = `equipment/${getUser().id}/${currentDocItemId}/${Date.now()}_${safeName}`;
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/equipment-docs/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${getToken()}`, 'Content-Type': file.type },
      body: file
    });
    if (!uploadRes.ok) { showToast('File upload failed. Please try again.', 'error'); return; }
    fileUrl = `${SUPABASE_URL}/storage/v1/object/public/equipment-docs/${path}`;
  }

  const _docRes = await fetch(`${SUPABASE_URL}/rest/v1/documents`, {
    method: 'POST', headers: { ...getHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({
      equipment_item_id: currentDocItemId,
      doc_type_name: typeName,
      issue_date:  issueDate  || null,
      expiry_date: expiryDate || null,
      file_url:    fileUrl,
      ai_status:   'pending'
    })
  });
  let _savedEquipDocId = null;
  if (_docRes.ok) { const [_newDoc] = await _docRes.json(); window._justAddedDocId = _newDoc?.id; _savedEquipDocId = _newDoc?.id; }

  // Reset assessed flag whenever a document is added
  await fetch(`${SUPABASE_URL}/rest/v1/equipment_items?id=eq.${currentDocItemId}`, {
    method: 'PATCH', headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ assessed: false })
  });

  showToast('Document saved', 'success');
  const auditLabel = currentDocItemName ? `${docTypeName} - ${currentDocItemName}` : docTypeName;
  logAudit('document', _savedEquipDocId, 'uploaded', auditLabel, { file_url: fileUrl });
  closeModal('addDocModal');
  loadEquipment(true);
}

async function markEquipAssessed(itemId) {
  const card = document.querySelector(`[data-id="${itemId}"]`);
  const badge = card?.querySelector('.sbadge-awaiting');
  if (badge) { badge.className = 'sbadge sbadge-ready'; badge.textContent = 'READY'; }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/equipment_items?id=eq.${itemId}`, {
    method: 'PATCH', headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ assessed: true })
  });
  if (!r.ok) {
    if (badge) { badge.className = 'sbadge sbadge-awaiting'; badge.textContent = 'AWAITING REVIEW'; }
    showToast('Failed to mark as assessed', 'error');
    return;
  }
  logAudit('equipment', itemId, 'updated', 'Marked as assessed');
  loadEquipment(true);
}

async function exportEquipmentCsv() {
  const h = getHeaders();
  const items = await apiFetch(`${SUPABASE_URL}/rest/v1/equipment_items?dismissed=is.false&parent_id=is.null&select=*,equipment_templates(name)&order=created_at`, { headers: h });
  if (!items) return;
  const ids  = items.map(i => i.id).join(',');
  let docs = [];
  if (ids) docs = await apiFetch(`${SUPABASE_URL}/rest/v1/documents?equipment_item_id=in.(${ids})&select=*`, { headers: h }) || [];
  const docsByItem = {};
  docs.forEach(d => { (docsByItem[d.equipment_item_id] = docsByItem[d.equipment_item_id] || []).push(d); });

  const rows = items.map(i => {
    const iDocs   = docsByItem[i.id] || [];
    const earliest = iDocs.filter(d => d.expiry_date).map(d => d.expiry_date).sort()[0] || '';
    return {
      'Name':          i.equipment_templates?.name || i.name || '',
      'Model':         i.model || '',
      'Serial Number': i.serial_number || '',
      'Assessed':      i.assessed ? 'Yes' : 'No',
      'Next Expiry':   earliest,
      'Docs':          iDocs.length,
    };
  });
  exportToCsv(rows, `equipment-${new Date().toISOString().slice(0,10)}.csv`);
}

function toggleEquipBulkMode() {
  _equipBulkMode = !_equipBulkMode;
  document.getElementById('equipBulkBar').style.display = _equipBulkMode ? 'flex' : 'none';
  document.getElementById('equipBulkToggleBtn').textContent = _equipBulkMode ? 'Cancel' : 'Select';
  document.querySelectorAll('#equipmentList .equip-bulk-check').forEach(cb => {
    cb.style.display = _equipBulkMode ? 'block' : 'none';
    cb.checked = false;
  });
  updateEquipBulkCount();
}

function updateEquipBulkCount() {
  const count = document.querySelectorAll('#equipmentList .equip-bulk-check:checked').length;
  document.getElementById('equipBulkCount').textContent = `${count} selected`;
}

async function bulkDeleteEquipment() {
  const checked = [...document.querySelectorAll('#equipmentList .equip-bulk-check:checked')];
  if (!checked.length) { showToast('Select at least one item', 'warn'); return; }
  const count = checked.length;
  if (!await showConfirm(`Delete ${count} equipment item${count > 1 ? 's' : ''} and all sub-items? This cannot be undone.`)) return;

  const ids = checked.map(cb => parseInt(cb.dataset.id, 10)).filter(id => !isNaN(id));
  const h   = { ...getHeaders(), Prefer: 'return=minimal' };
  try {
    const results = await Promise.all(ids.map(id =>
      fetch(`${SUPABASE_URL}/rest/v1/documents?equipment_item_id=eq.${id}`, { method: 'DELETE', headers: h })
        .then(() => fetch(`${SUPABASE_URL}/rest/v1/equipment_items?id=eq.${id}`, { method: 'DELETE', headers: h }))
    ));
    const failed = results.filter(r => !r.ok);
    if (failed.length) {
      showToast(`Delete failed for ${failed.length} item(s)`, 'error');
      loadEquipment();
      return;
    }
    showToast(`${count} equipment item${count > 1 ? 's' : ''} deleted`, 'success');
    toggleEquipBulkMode();
    loadEquipment();
  } catch (e) {
    showToast('Network error during bulk delete', 'error');
    loadEquipment();
  }
}

// Admin: Edit equipment record
async function openEditEquipment(itemId) {
  const h = getHeaders();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/equipment_items?id=eq.${itemId}&select=*`, { headers: h });
  if (!res.ok) { showToast('Failed to load equipment', 'error'); return; }
  const [item] = await res.json();
  if (!item) { showToast('Equipment not found', 'error'); return; }
  document.getElementById('editEquipId').value = item.id;
  document.getElementById('editEquipName').value = item.name || '';
  document.getElementById('editEquipSerial').value = item.serial_number || '';
  document.getElementById('editEquipAssessed').checked = item.assessed || false;
  openModal('editEquipModal');
}

async function saveEditEquipment() {
  const h = getHeaders();
  const id = parseInt(document.getElementById('editEquipId').value);
  const name = document.getElementById('editEquipName').value.trim();
  const serial_number = document.getElementById('editEquipSerial').value.trim();
  const assessed = document.getElementById('editEquipAssessed').checked;
  if (!name) { showToast('Equipment name is required', 'warn'); return; }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/equipment_items?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...h, Prefer: 'return=minimal' },
    body: JSON.stringify({ name, serial_number, assessed })
  });
  if (!res.ok) { showToast('Save failed: ' + res.status, 'error'); return; }
  logAudit('equipment', String(id), 'updated', name);
  closeModal('editEquipModal');
  loadEquipment();
}
