// ═══════════════════ EQUIPMENT ═══════════════════

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
  document.getElementById('ctEquipModal').classList.add('open');
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

  const items = await apiFetch(`${SUPABASE_URL}/rest/v1/equipment_items?select=*&order=created_at`, { headers: h });
  if (!items) return;

  const activeItems = items.filter(i => !i.dismissed);
  const topLevel = activeItems.filter(i => !i.parent_id);
  const subsByParent = {};
  activeItems.filter(i => i.parent_id).forEach(i => {
    if (!subsByParent[i.parent_id]) subsByParent[i.parent_id] = [];
    subsByParent[i.parent_id].push(i);
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
        const cardsHtml = items.map(i => equipItemCard(i, i.name || 'Equipment', docsByItem[i.id] || [], subsByParent[i.id] || [], docsByItem, subsByParent)).join('');
        const _t = new Date(); _t.setHours(0,0,0,0);
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
            <span class="group-title">${type}</span>
            ${grpBadges(_exp, _expir, _ok, _missing, _review)}
            <span class="group-toggle">▾</span>
          </div>
          <div class="group-body"><div class="group-body-inner">${cardsHtml}</div></div>
        </div>`;
      }).join('')
    : '<div class="empty">No equipment yet. Click "+ Add Equipment" to start.</div>';

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
  const today = new Date(); today.setHours(0,0,0,0);
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
  eqEl.textContent  = activeItems.length;
  eqSub.textContent = `${activeItems.length} registered`;
  eqTile.className  = 'dash-tile ' + (activeItems.length > 0 ? 'ok' : 'info');
  const dcEl   = document.getElementById('dashDocs');
  const dcSub  = document.getElementById('dashDocsSub');
  const dcTile = dcEl.closest('.dash-tile');
  dcEl.textContent = totalDocs;
  if (expiredDocs > 0) {
    dcSub.textContent = `${expiredDocs} expired`; dcSub.style.color = '#fda4af';
    dcTile.className = 'dash-tile bad';
  } else if (expiringDocs > 0) {
    dcSub.textContent = `${expiringDocs} expiring soon`; dcSub.style.color = '#fbbf24';
    dcTile.className = 'dash-tile warn';
  } else {
    dcSub.textContent = totalDocs > 0 ? 'All valid' : 'No documents'; dcSub.style.color = '#64748b';
    dcTile.className = 'dash-tile ' + (totalDocs > 0 ? 'ok' : 'info');
  }
}

function equipItemCard(item, name, docs, subs = [], docsByItem = {}, subsByParent = {}) {

  const _today = new Date(); _today.setHours(0,0,0,0);
  const _in30  = new Date(_today); _in30.setDate(_in30.getDate() + 30);
  const isExp     = d => d.expiry_date && new Date(d.expiry_date) < _today;
  const isExpiring = d => { if (!d.expiry_date) return false; const e = new Date(d.expiry_date); return e >= _today && e <= _in30; };
  const mkBadge   = (exp, expir) => exp > 0
    ? `<span style="background:#4c0519;color:#fda4af;font-size:11px;font-weight:bold;padding:3px 8px;border-radius:20px;">⚠ ${exp} EXPIRED</span>`
    : expir > 0
    ? `<span style="background:#422006;color:#fbbf24;font-size:11px;font-weight:bold;padding:3px 8px;border-radius:20px;">⚠ ${expir} EXPIRING</span>`
    : '';
  const bStyle = 'font-size:11px;font-weight:bold;padding:3px 8px;border-radius:20px;';

  const docsHtml = docs.length ? docs.map(d => {
    const typeName = d.doc_type_name || '—';
    const expiry   = d.expiry_date;
    const today = _today, in30 = _in30;
    let statusColor = '#6ee7b7', statusText = 'VALID';
    if (expiry) {
      const exp = new Date(expiry);
      if (exp < today)      { statusColor = '#fda4af'; statusText = 'EXPIRED'; }
      else if (exp <= in30) { statusColor = '#fbbf24'; statusText = 'EXPIRING'; }
    }
    const fileBtn = d.file_url ? `<button onclick="openDoc('${d.file_url}')" style="background:none;border:none;color:#38bdf8;font-size:11px;cursor:pointer;padding:0;text-decoration:underline;">📎 View</button>` : '';
    const rowClass = statusText === 'EXPIRED' ? ' status-expired' : statusText === 'EXPIRING' ? ' status-expiring' : '';
    return `<div class="doc-row${rowClass}" data-doc-id="${d.id}">
      <div style="flex:1">
        <div class="doc-name">${typeName}</div>
        <div class="doc-date">Issue: ${d.issue_date || '—'} · Expiry: ${expiry || '—'}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        ${fileBtn}
        <span style="color:${statusColor};font-size:11px;font-weight:bold;">${statusText}</span>
        <button class="btn-danger" onclick="deleteDoc(${d.id})">✕</button>
      </div>
    </div>`;
  }).join('') : `<div class="doc-date" style="padding:8px 0;">No documents yet</div>`;

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
    alertBadge = `<span style="${bStyle}background:#4c0519;color:#fda4af;">MISSING DOCS</span>`;
  } else if (!item.assessed) {
    alertBadge = `<span style="${bStyle}background:#1e3a5f;color:#93c5fd;">AWAITING REVIEW</span>`;
  } else {
    const _expC = allNestedDocs.filter(isExp).length, _expirC = allNestedDocs.filter(isExpiring).length;
    alertBadge = _expC > 0
      ? `<span style="${bStyle}background:#4c0519;color:#fda4af;">⚠ ${_expC} EXPIRED</span>`
      : _expirC > 0
      ? `<span style="${bStyle}background:#422006;color:#fbbf24;">⚠ ${_expirC} EXPIRING</span>`
      : `<span style="${bStyle}background:#14532d;color:#86efac;">READY</span>`;
  }

  const subsHtml = subs.map(sub => {
    const subDocs = docsByItem[sub.id] || [];
    const subDocsHtml = subDocs.length ? subDocs.map(d => {
      const expiry = d.expiry_date;
      let statusColor = '#6ee7b7', statusText = 'VALID';
      if (expiry) {
        const exp = new Date(expiry);
        if (exp < _today)      { statusColor = '#fda4af'; statusText = 'EXPIRED'; }
        else if (exp <= _in30) { statusColor = '#fbbf24'; statusText = 'EXPIRING'; }
      }
      const fileBtn = d.file_url ? `<button onclick="openDoc('${d.file_url}')" style="background:none;border:none;color:#38bdf8;font-size:11px;cursor:pointer;padding:0;text-decoration:underline;">📎 View</button>` : '';
      return `<div class="doc-row" data-doc-id="${d.id}" style="padding:6px 0;">
        <div style="flex:1"><div class="doc-name">${d.doc_type_name || '—'}</div><div class="doc-date">Issue: ${d.issue_date || '—'} · Expiry: ${expiry || '—'}</div></div>
        <div style="display:flex;align-items:center;gap:8px;">${fileBtn}<span style="color:${statusColor};font-size:11px;font-weight:bold;">${statusText}</span><button class="btn-danger" onclick="deleteDoc(${d.id})">✕</button></div>
      </div>`;
    }).join('') : `<div class="doc-date" style="padding:4px 0;">No documents yet</div>`;
    const subChildren = subsByParent[sub.id] || [];
    const subOwnDocsBadge = mkBadge(subDocs.filter(isExp).length, subDocs.filter(isExpiring).length);
    const allSubDocs = [...subDocs, ...subChildren.flatMap(sc => docsByItem[sc.id] || [])];
    const subAlertBadge = mkBadge(allSubDocs.filter(isExp).length, allSubDocs.filter(isExpiring).length);
    const subChildrenHtml = subChildren.map(sc => {
      const scDocs = docsByItem[sc.id] || [];
      const scDocsHtml = scDocs.length ? scDocs.map(d => {
        const expiry = d.expiry_date;
        let statusColor = '#6ee7b7', statusText = 'VALID';
        if (expiry) { const exp = new Date(expiry); if (exp < _today) { statusColor = '#fda4af'; statusText = 'EXPIRED'; } else if (exp <= _in30) { statusColor = '#fbbf24'; statusText = 'EXPIRING'; } }
        const fileBtn = d.file_url ? `<button onclick="openDoc('${d.file_url}')" style="background:none;border:none;color:#38bdf8;font-size:11px;cursor:pointer;padding:0;text-decoration:underline;">📎 View</button>` : '';
        return `<div class="doc-row" data-doc-id="${d.id}" style="padding:4px 0;font-size:12px;">
          <div style="flex:1"><div class="doc-name">${d.doc_type_name||'—'}</div><div class="doc-date">Issue: ${d.issue_date||'—'} · Expiry: ${expiry||'—'}</div></div>
          <div style="display:flex;align-items:center;gap:6px;">${fileBtn}<span style="color:${statusColor};font-size:10px;font-weight:bold;">${statusText}</span><button class="btn-danger" onclick="deleteDoc(${d.id})">✕</button></div>
        </div>`;
      }).join('') : `<div class="doc-date" style="padding:3px 0;font-size:11px;">No documents yet</div>`;
      const scHasDeeper = (subsByParent[sc.id] || []).length > 0;
      const scAlertBadge = mkBadge(scDocs.filter(isExp).length, scDocs.filter(isExpiring).length);
      return `<div class="sub-child-card" data-id="${sc.id}">
        <div class="sub-child-header">
          <div style="cursor:pointer;flex:1;" onclick="toggleSubCard(this.closest('.sub-child-card'))">
            <div class="sub-child-title">${sc.name || 'Sub-child'}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:1px;">
              <div class="doc-name" style="font-size:10px;">S/N: ${sc.serial_number || '—'}</div>
              ${scAlertBadge}
            </div>
          </div>
          <div style="display:flex;gap:5px;align-items:center;">
            ${scHasDeeper ? `<span title="Has nested sub-components not shown" style="font-size:10px;color:#94a3b8;background:#1e293b;border:1px solid #334155;padding:2px 7px;border-radius:8px;cursor:default;">↳ ${(subsByParent[sc.id]).length}</span>` : ''}
            <button class="btn-reassign" onclick="openReassignModal(${sc.id},'${(sc.name||'Sub-child').replace(/'/g,"\\'")}',${sub.id})" title="Change parent">⇄</button>
            <button class="btn-toggle" onclick="toggleSubCard(this.closest('.sub-child-card'))" title="Expand">▾</button>
            <button class="btn-danger" onclick="deleteEquipItem(${sc.id})" title="Delete">🗑</button>
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
                <button class="upload-btn" style="font-size:11px;padding:4px 8px;margin-top:8px;margin-bottom:4px;" onclick="openAddDoc(${sc.id})">+ Add Document</button>
              </div></div>
            </div>
          </div></div>
        </div>
      </div>`;
    }).join('');

    return `<div class="sub-card" data-id="${sub.id}">
      <div class="sub-card-header">
        <div style="cursor:pointer;flex:1;" onclick="toggleSubCard(this.closest('.sub-card'))">
          <div class="sub-card-title">${sub.name || 'Sub-component'}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
            <div class="doc-name" style="font-size:11px;">S/N: ${sub.serial_number || '—'}</div>
            ${subAlertBadge}
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn-reassign" onclick="openReassignModal(${sub.id},'${(sub.name||'Sub-component').replace(/'/g,"\\'")}',${item.id})" title="Change parent">⇄</button>
          <button class="btn-toggle" onclick="toggleSubCard(this.closest('.sub-card'))" title="Expand">▾</button>
          <button class="btn-danger" onclick="deleteEquipItem(${sub.id})" title="Delete">🗑</button>
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
              <button class="upload-btn" style="font-size:11px;margin-top:8px;margin-bottom:4px;" onclick="openAddDoc(${sub.id})">+ Add Document</button>
            </div></div>
          </div>
          <div style="margin-top:8px;">
            ${subChildrenHtml}
            <button class="add-sub-btn" style="font-size:11px;padding:4px 10px;margin-top:6px;" onclick="openAddSubComponent(${sub.id},'${(sub.name||'Sub-component').replace(/'/g,"\\'")}')">+ Add Sub-child</button>
          </div>
        </div></div>
      </div>
    </div>`;
  }).join('');

  return `<div class="app-card" data-id="${item.id}">
    <div class="card-header">
      <div style="cursor:pointer;flex:1;" onclick="toggleCard(this.closest('.app-card').querySelector('.btn-toggle'))">
        <div class="card-title">${name}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
          <div class="doc-name">S/N: ${item.serial_number || '—'}</div>
          ${alertBadge}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button class="btn-reassign" onclick="openReassignModal(${item.id},'${name.replace(/'/g,"\\'")}',null)" title="Change assignment">⇄</button>
        <button class="btn-toggle" onclick="toggleCard(this)" title="Expand">▾</button>
        <button class="btn-danger" onclick="deleteEquipItem(${item.id})" title="Delete equipment">🗑</button>
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
            <button class="upload-btn" style="margin-top:8px;margin-bottom:4px;" onclick="openAddDoc(${item.id})">+ Add Document</button>
          </div></div>
        </div>
        <div class="sub-section">
          <div class="sub-label">Sub-components${subs.length ? ` (${subs.length})` : ''}</div>
          ${subsHtml}
          <button class="add-sub-btn" onclick="openAddSubComponent(${item.id}, '${name.replace(/'/g, "\\'")}')">+ Add Sub-component</button>
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

  document.getElementById('reassignModal').classList.add('open');
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
  if (!filtered.length) { container.innerHTML = '<div style="color:#64748b;font-size:13px;padding:8px 0;">No matches</div>'; return; }
  container.innerHTML = filtered.map(i => {
    const level = !i.parent_id ? 'Equipment' : 'Sub-component';
    const label = `[${level}] ${i.name || 'Equipment'} · S/N: ${i.serial_number || '—'}`;
    const checked = (preselect != null && String(i.id) === String(preselect)) ? 'checked' : '';
    return `<div class="reassign-option">
      <input type="radio" name="reassignParent" id="rp_${i.id}" value="${i.id}" ${checked}>
      <label for="rp_${i.id}">${label}</label>
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
  document.getElementById('ctSubModal').classList.add('open');
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
    loadEquipment(true);
  });
}

// ─── Add Document Modal ───
let currentDocItemId = null;

function openAddDoc(itemId) {
  currentDocItemId = itemId;
  document.getElementById('docTypeSelect').value = '';
  document.getElementById('docTypeCustom').style.display = 'none';
  document.getElementById('docTypeCustom').value = '';
  document.getElementById('docIssueDate').value = '';
  document.getElementById('docExpiryDate').value = '';
  document.getElementById('docNoExpiry').checked = false;
  document.getElementById('docExpiryDate').disabled = false;
  document.getElementById('docFileInput').value = '';
  document.getElementById('docFileName').textContent = '';
  document.getElementById('addDocModal').classList.add('open');
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
  if (!file) { showToast('Please attach a file — attachment is required', 'warn'); document.getElementById('docFileBtn').style.borderColor = '#fda4af'; return; }
  document.getElementById('docFileBtn').style.borderColor = '#334155';

  let fileUrl = null;
  if (file) {
    const safeName = file.name.replace(/[^\x00-\x7F]/g, c => encodeURIComponent(c)).replace(/\s+/g, '_');
    const path = `equipment/${getUser().id}/${currentDocItemId}/${Date.now()}_${safeName}`;
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/equipment-docs/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${getToken()}`, 'Content-Type': file.type },
      body: file
    });
    if (uploadRes.ok) fileUrl = `${SUPABASE_URL}/storage/v1/object/public/equipment-docs/${path}`;
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
  if (_docRes.ok) { const [_newDoc] = await _docRes.json(); window._justAddedDocId = _newDoc?.id; }

  // Reset assessed flag whenever a document is added
  await fetch(`${SUPABASE_URL}/rest/v1/equipment_items?id=eq.${currentDocItemId}`, {
    method: 'PATCH', headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ assessed: false })
  });

  closeModal('addDocModal');
  loadEquipment(true);
}

async function markEquipAssessed(itemId) {
  await fetch(`${SUPABASE_URL}/rest/v1/equipment_items?id=eq.${itemId}`, {
    method: 'PATCH', headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ assessed: true })
  });
  loadEquipment(true);
}
