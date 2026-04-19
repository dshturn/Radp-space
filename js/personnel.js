// ═══════════════════ PERSONNEL ═══════════════════

let _persPage = 0;
let _persSearch = '';
const _PERS_PAGE_SIZE = 25;
let _persBulkMode = false;

const PERS_DOC_TYPES = [
  { name: 'CV',               mandatory: true,  noIssue: true,  noExpiry: true              },
  { name: 'Medical Report',   mandatory: true,  noIssue: false, noExpiry: true, autoExpiry: 2 },
  { name: 'Fire Fighting',    mandatory: true  },
  { name: 'H2S & SCBA',       mandatory: true  },
  { name: 'First Aid',        mandatory: true  },
  { name: 'Well Control',     mandatory: false },
  { name: 'HUET',             mandatory: false },
];

async function openAddPersonnel() {
  const positions = await apiFetch(`${SUPABASE_URL}/rest/v1/personnel_positions?select=name&order=name`, { headers: getHeaders() }) || [];
  document.getElementById('persPositionSelect').innerHTML =
    '<option value="">Select position...</option>'
    + positions.map(p => `<option value="${p.name}">${p.name}</option>`).join('')
    + '<option value="__new__">+ Add new position...</option>';
  document.getElementById('newPersPositionWrap').style.display = 'none';
  document.getElementById('persName').value         = '';
  document.getElementById('persPositionNew').value  = '';
  document.getElementById('persNationalId').value   = '';
  openModal('ctPersModal');
}

function onPersPositionChange(sel) {
  document.getElementById('newPersPositionWrap').style.display = sel.value === '__new__' ? 'block' : 'none';
}

async function addPersonnel() {
  const name       = document.getElementById('persName').value.trim();
  const selEl      = document.getElementById('persPositionSelect');
  const nationalId = document.getElementById('persNationalId').value.trim();
  if (!name)           { showToast('Please enter full name', 'warn'); return; }
  if (!selEl.value)    { showToast('Please select a position', 'warn'); return; }
  if (!/^\d{10}$/.test(nationalId)) { showToast('ID must be exactly 10 digits', 'warn'); return; }

  let position = selEl.value;
  if (position === '__new__') {
    const newPos = document.getElementById('persPositionNew').value.trim();
    if (!newPos) { showToast('Please enter a position name', 'warn'); return; }
    await fetch(`${SUPABASE_URL}/rest/v1/personnel_positions`, {
      method: 'POST', headers: { ...getHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ name: newPos })
    });
    position = newPos;
  }

  const _pRes = await fetch(`${SUPABASE_URL}/rest/v1/personnel`, {
    method: 'POST', headers: { ...getHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({ contractor_id: getUser().id, full_name: name, position, national_id: nationalId })
  });
  if (_pRes.ok) { const [_newP] = await _pRes.json(); window._justAddedPersId = _newP?.id; showToast('Personnel added', 'success'); logAudit('personnel', _newP.id, 'created', _newP.full_name || name); }
  else { showToast('Failed to add personnel', 'error'); return; }
  closeModal('ctPersModal'); loadPersonnel();
}

async function loadPersonnel(preserveState = false) {
  let expandedIds = new Set(), expandedGroups = new Set(), scrollY = 0;
  if (preserveState) {
    document.querySelectorAll('#personnelList .app-card.expanded').forEach(c => { if (c.dataset.id) expandedIds.add(c.dataset.id); });
    document.querySelectorAll('#personnelList .eq-group:not(.collapsed)').forEach(g => {
      const title = g.querySelector('.group-title');
      if (title) expandedGroups.add(title.textContent.trim());
    });
  }

  const h = getHeaders();
  const from = _persPage * _PERS_PAGE_SIZE;
  const res  = await fetch(
    `${SUPABASE_URL}/rest/v1/personnel?select=*&order=created_at${_persSearch ? `&name=ilike.*${encodeURIComponent(_persSearch)}*` : ''}&offset=${from}&limit=${_PERS_PAGE_SIZE}`,
    { headers: { ...h, Prefer: 'count=exact' } }
  );
  if (res.status === 401) { localStorage.removeItem('radp_token'); localStorage.removeItem('radp_user'); showPage('login'); return; }
  if (!res.ok) { showToast('Failed to load personnel', 'error'); return; }
  const people = await res.json();
  const totalCount = parseInt(res.headers.get('Content-Range')?.split('/')[1] || '0', 10);
  if (!people) return;

  // Load all personnel docs in one shot
  const personIds = people.map(p => p.id).join(',');
  let persDocs = [];
  if (personIds) persDocs = await apiFetch(`${SUPABASE_URL}/rest/v1/personnel_documents?personnel_id=in.(${personIds})&select=*&order=uploaded_at.desc`, { headers: h }) || [];
  const docsByPerson = {};
  persDocs.forEach(d => { if (!docsByPerson[d.personnel_id]) docsByPerson[d.personnel_id] = []; docsByPerson[d.personnel_id].push(d); });

  const list = document.getElementById('personnelList');
  if (preserveState) scrollY = window.scrollY;
  if (!people.length) {
    list.innerHTML = '<div class="empty">No personnel added yet</div>';
  } else {
    // Group by position
    const persGroups = {};
    people.forEach(p => {
      const key = p.position || 'Other';
      if (!persGroups[key]) persGroups[key] = [];
      persGroups[key].push(p);
    });
    list.innerHTML = Object.entries(persGroups).sort(([a],[b]) => a.localeCompare(b)).map(([pos, persons]) => {
      const cardsHtml = persons.map(p => personnelCard(p, docsByPerson[p.id] || [])).join('');
      const _t = new Date(); _t.setHours(0,0,0,0);
      const _i30 = new Date(_t); _i30.setDate(_t.getDate() + 30);
      let [_exp, _expir, _ok, _missing, _review] = [0, 0, 0, 0, 0];
      persons.forEach(p => {
        const docs = docsByPerson[p.id] || [];
        const allMandatory = PERS_DOC_TYPES.filter(t => t.mandatory).every(t => docs.some(d => d.doc_type_name === t.name));
        if (!allMandatory)                                                                                                    _missing++;
        else if (!p.assessed)                                                                                                _review++;
        else if (docs.some(d => d.expiry_date && new Date(d.expiry_date) < _t))                                             _exp++;
        else if (docs.some(d => d.expiry_date && new Date(d.expiry_date) >= _t && new Date(d.expiry_date) <= _i30))         _expir++;
        else                                                                                                                 _ok++;
      });
      return `<div class="eq-group collapsed">
        <div class="group-header" onclick="toggleGroup(this)">
          <span class="group-title">${esc(pos)}</span>
          ${grpBadges(_exp, _expir, _ok, _missing, _review)}
          <span class="group-toggle">▾</span>
        </div>
        <div class="group-body"><div class="group-body-inner">${cardsHtml}</div></div>
      </div>`;
    }).join('');
  }
  if (_persBulkMode) updatePersBulkCount();

  // Render pagination controls
  const totalPages = Math.ceil(totalCount / _PERS_PAGE_SIZE);
  const pagEl = document.getElementById('personnelPagination');
  if (pagEl) {
    if (totalPages <= 1) { pagEl.innerHTML = ''; }
    else {
      pagEl.innerHTML = `
        <div class="pagination">
          <button class="pag-btn" onclick="_persPage=Math.max(0,_persPage-1);loadPersonnel()" ${_persPage === 0 ? 'disabled' : ''}>← Prev</button>
          <span class="pag-info">Page ${_persPage + 1} of ${totalPages}</span>
          <button class="pag-btn" onclick="_persPage=Math.min(${totalPages-1},_persPage+1);loadPersonnel()" ${_persPage >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
        </div>`;
    }
  }

  if (preserveState) {
    // Suppress transitions so state restoration is instant (no animate-open flash)
    const noTrans = document.createElement('style');
    noTrans.id = '_persNoTrans';
    noTrans.textContent = '#personnelList .group-body,#personnelList .card-body,#personnelList .sub-card-body,#personnelList .sub-child-body{transition:none!important;opacity:1!important;grid-template-rows:unset!important}';
    document.head.appendChild(noTrans);

    expandedIds.forEach(id => { const el = document.querySelector(`[data-id="${id}"]`); if (el) el.classList.add('expanded'); });
    document.querySelectorAll('#personnelList .eq-group').forEach(g => {
      const title = g.querySelector('.group-title');
      if (title && expandedGroups.has(title.textContent.trim())) g.classList.remove('collapsed');
    });
    window.scrollTo({ top: scrollY, behavior: 'instant' });

    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById('_persNoTrans')?.remove();
    }));
  }

  // Animate newly added personnel card or doc
  if (window._justAddedPersId) {
    animateNewEl(document.querySelector(`[data-id="p${window._justAddedPersId}"]`));
    window._justAddedPersId = null;
  }
  if (window._justAddedPersDocId) {
    animateNewEl(document.querySelector(`[data-doc-id="${window._justAddedPersDocId}"]`));
    window._justAddedPersDocId = null;
  }

  // ── Mini dashboard: personnel tile ──
  let missingMandatory = 0;
  people.forEach(p => {
    const uploaded = new Set((docsByPerson[p.id] || []).map(d => d.doc_type_name));
    const missing  = PERS_DOC_TYPES.filter(t => t.mandatory && !uploaded.has(t.name));
    if (missing.length > 0) missingMandatory++;
  });
  const pEl   = document.getElementById('dashPersonnel');
  const pSub  = document.getElementById('dashPersonnelSub');
  const pTile = pEl.closest('.dash-tile');
  pEl.textContent  = totalCount;
  pSub.textContent = missingMandatory > 0 ? `${missingMandatory} docs missing` : (totalCount > 0 ? 'All docs uploaded' : 'None added');
  pSub.style.color = '';
  pTile.className  = 'dash-tile ' + (missingMandatory > 0 ? 'warn' : totalCount > 0 ? 'ok' : 'info');
}

function personnelCard(p, docs) {
  const today = new Date(); today.setHours(0,0,0,0);
  const in30  = new Date(today); in30.setDate(in30.getDate() + 30);
  const docMap = {};
  docs.forEach(d => { docMap[d.doc_type_name] = d; });

  const docRows = PERS_DOC_TYPES.map(t => {
    const d = docMap[t.name];
    const mandBadge = t.mandatory
      ? `<span class="doc-badge-req">Required</span>`
      : `<span class="doc-badge-opt">Optional</span>`;

    if (d) {
      let statusClass = 'doc-status-valid', statusText = 'VALID';
      if (d.expiry_date) {
        const exp = new Date(d.expiry_date);
        if (exp < today)      { statusClass = 'doc-status-expired';  statusText = 'EXPIRED';  }
        else if (exp <= in30) { statusClass = 'doc-status-expiring'; statusText = 'EXPIRING'; }
      }
      const safeTypeName = esc(t.name);
      const fileBtn = d.file_url ? `<button class="doc-view-btn" data-url="${esc(d.file_url)}" onclick="openDoc(this.dataset.url)" aria-label="View ${safeTypeName} document">↗ View</button>` : '';
      const cfg     = PERS_DOC_TYPES.find(x => x.name === t.name) || {};
      const dateStr = cfg.noIssue && cfg.noExpiry ? ''
                    : cfg.noIssue  ? `Expiry: ${esc(d.expiry_date || '—')}`
                    : cfg.noExpiry ? `Issue: ${esc(d.issue_date || '—')}`
                    : `Issue: ${esc(d.issue_date || '—')} · Expiry: ${esc(d.expiry_date || '—')}`;
      const yrsInt  = parseInt(p.years_experience);
      const yrsStr  = t.name === 'CV' && p.years_experience != null ? `<div class="doc-date">${isNaN(yrsInt) ? '' : yrsInt} yrs exp in O&G</div>` : '';
      const rowClass = statusText === 'EXPIRED' ? ' status-expired' : statusText === 'EXPIRING' ? ' status-expiring' : '';
      const safeYrs  = p.years_experience != null ? parseInt(p.years_experience) : 'null';
      return `<div class="doc-row${rowClass}" data-doc-id="${parseInt(d.id)}">
        <div class="flex-1">
          <div class="doc-name row-gap-xs">${safeTypeName} ${mandBadge}</div>
          ${dateStr ? `<div class="doc-date">${dateStr}</div>` : ''}
          ${yrsStr}
        </div>
        <div class="row-gap-sm">
          ${fileBtn}
          <span class="doc-status ${statusClass}">${statusText}</span>
          <button class="btn-edit" onclick="editPersDoc(${parseInt(d.id)},${parseInt(p.id)},this.dataset.type,${t.mandatory ? 'true' : 'false'},this.dataset.issue,this.dataset.expiry,${safeYrs})" data-type="${safeTypeName}" data-issue="${esc(d.issue_date||'')}" data-expiry="${esc(d.expiry_date||'')}" aria-label="Edit ${safeTypeName}">✏</button>
          <button class="btn-danger" onclick="deletePersDoc(${parseInt(d.id)})" aria-label="Delete ${safeTypeName} document">✕</button>
        </div>
      </div>`;
    } else {
      const safeTypeName = esc(t.name);
      return `<div class="doc-row">
        <div class="flex-1">
          <div class="doc-name row-gap-xs">${safeTypeName} ${mandBadge}</div>
          <div class="doc-date text-muted">Not uploaded</div>
        </div>
        <button class="upload-btn" onclick="openAddPersDoc(${parseInt(p.id)}, this.dataset.type, ${t.mandatory ? 'true' : 'false'})" data-type="${safeTypeName}">↑ Upload</button>
      </div>`;
    }
  }).join('');

  const expiredCount  = docs.filter(d => d.expiry_date && new Date(d.expiry_date) < today).length;
  const expiringCount = docs.filter(d => { if (!d.expiry_date) return false; const e = new Date(d.expiry_date); return e >= today && e <= in30; }).length;
  const allMandatoryUploaded = PERS_DOC_TYPES.filter(t => t.mandatory).every(t => docMap[t.name]);
  let alertBadge = '';
  if (!allMandatoryUploaded) {
    alertBadge = `<span class="sbadge sbadge-missing">MISSING DOCS</span>`;
  } else if (!p.assessed) {
    alertBadge = `<span class="sbadge sbadge-awaiting">AWAITING REVIEW</span>`;
  } else if (expiredCount > 0) {
    alertBadge = `<span class="sbadge sbadge-expired">⚠ ${expiredCount} EXPIRED</span>`;
  } else if (expiringCount > 0) {
    alertBadge = `<span class="sbadge sbadge-expiring">⚠ ${expiringCount} EXPIRING</span>`;
  } else {
    alertBadge = `<span class="sbadge sbadge-ready">READY</span>`;
  }

  const safeName = esc(p.full_name);
  return `<div class="app-card" data-id="p${parseInt(p.id)}">
    <input type="checkbox" class="bulk-check" data-id="${parseInt(p.id)}" style="display:${_persBulkMode ? 'block' : 'none'};margin:8px;" onchange="updatePersBulkCount()">
    <div class="card-header">
      <div class="card-clickable" onclick="toggleCard(this.closest('.app-card').querySelector('.btn-toggle'))">
        <div class="card-title">${safeName}</div>
        <div class="doc-name mt-xs">${esc(p.position || '')} · ID: ${esc(p.national_id || '—')}</div>
      </div>
      <div class="row-wrap">
        ${alertBadge}
        <button class="btn-toggle" onclick="toggleCard(this)" aria-label="Expand ${safeName}">▾</button>
        <button class="btn-danger" onclick="deletePersRecord(${parseInt(p.id)})" aria-label="Delete ${safeName}">✕</button>
      </div>
    </div>
    <div class="card-body"><div class="body-inner"><div class="body-content">
      ${docRows}
    </div></div></div>
  </div>`;
}

function _resetPersDocModal() {
  document.getElementById('persDocIssueDate').value      = '';
  document.getElementById('persDocExpiryDate').value     = '';
  document.getElementById('persDocFileInput').value      = '';
  document.getElementById('persDocFileName').textContent = '';
  document.getElementById('persDocFileBtn').style.borderColor = '';
  document.getElementById('persDocYearsExp').value       = '';
  document.getElementById('persDocEditId').value         = '';
  document.getElementById('persDocFileRequired').style.display = 'inline';
}

function openAddPersDoc(personId, typeName, mandatory) {
  const cfg = PERS_DOC_TYPES.find(t => t.name === typeName) || {};
  _resetPersDocModal();
  document.getElementById('persDocPersonId').value       = personId;
  document.getElementById('persDocIsMandatory').value    = mandatory;
  document.getElementById('persDocIsCustom').value       = 'false';
  document.getElementById('persDocTypeName').textContent = typeName;
  document.getElementById('persDocCustomNameWrap').style.display = 'none';
  document.getElementById('persDocIssueDateWrap').style.display  = cfg.noIssue    ? 'none' : 'block';
  document.getElementById('persDocExpiryDateWrap').style.display = cfg.noExpiry   ? 'none' : 'block';
  document.getElementById('persDocAutoExpiryNote').style.display = cfg.autoExpiry ? 'block' : 'none';
  document.getElementById('persDocYearsExpWrap').style.display   = typeName === 'CV' ? 'block' : 'none';
  openModal('addPersDocModal');
}

function openAddCustomPersDoc(personId) {
  _resetPersDocModal();
  document.getElementById('persDocPersonId').value       = personId;
  document.getElementById('persDocIsMandatory').value    = 'false';
  document.getElementById('persDocIsCustom').value       = 'true';
  document.getElementById('persDocTypeName').textContent = '';
  document.getElementById('persDocCustomName').value     = '';
  document.getElementById('persDocCustomNameWrap').style.display = 'block';
  document.getElementById('persDocIssueDateWrap').style.display  = 'block';
  document.getElementById('persDocExpiryDateWrap').style.display = 'block';
  document.getElementById('persDocAutoExpiryNote').style.display = 'none';
  document.getElementById('persDocYearsExpWrap').style.display   = 'none';
  openModal('addPersDocModal');
}

function editPersDoc(docId, personId, typeName, mandatory, issueDate, expiryDate, yearsExp) {
  const cfg      = PERS_DOC_TYPES.find(t => t.name === typeName) || {};
  const isCustom = !PERS_DOC_TYPES.find(t => t.name === typeName);
  _resetPersDocModal();
  document.getElementById('persDocEditId').value         = docId;
  document.getElementById('persDocPersonId').value       = personId;
  document.getElementById('persDocIsMandatory').value    = mandatory;
  document.getElementById('persDocIsCustom').value       = isCustom ? 'true' : 'false';
  document.getElementById('persDocTypeName').textContent = isCustom ? '' : typeName;
  document.getElementById('persDocCustomNameWrap').style.display = isCustom ? 'block' : 'none';
  document.getElementById('persDocCustomName').value     = isCustom ? typeName : '';
  document.getElementById('persDocIssueDate').value      = issueDate  || '';
  document.getElementById('persDocExpiryDate').value     = expiryDate || '';
  document.getElementById('persDocIssueDateWrap').style.display  = cfg.noIssue    ? 'none' : 'block';
  document.getElementById('persDocExpiryDateWrap').style.display = cfg.noExpiry   ? 'none' : 'block';
  document.getElementById('persDocAutoExpiryNote').style.display = cfg.autoExpiry ? 'block' : 'none';
  document.getElementById('persDocYearsExpWrap').style.display   = typeName === 'CV' ? 'block' : 'none';
  document.getElementById('persDocYearsExp').value       = yearsExp != null ? yearsExp : '';
  openModal('addPersDocModal');
}

async function savePersDocument() {
  const editId    = document.getElementById('persDocEditId').value;
  const personId  = document.getElementById('persDocPersonId').value;
  const typeName  = document.getElementById('persDocTypeName').textContent;
  const mandatory = document.getElementById('persDocIsMandatory').value === 'true';
  const cfg       = PERS_DOC_TYPES.find(t => t.name === typeName) || {};
  const issueDate = document.getElementById('persDocIssueDate').value;
  let   expDate   = document.getElementById('persDocExpiryDate').value;
  if (cfg.autoExpiry && issueDate) {
    const d = new Date(issueDate);
    d.setFullYear(d.getFullYear() + cfg.autoExpiry);
    expDate = d.toISOString().split('T')[0];
  }
  const file = document.getElementById('persDocFileInput').files[0];
  if (!file) { showToast('Please attach a new file — a file is required to save changes', 'warn'); document.getElementById('persDocFileBtn').style.borderColor = 'var(--bad)'; return; }
  if (!validateUploadFile(file)) return;

  let fileUrl = null;
  if (file) {
    const safeName = file.name.replace(/[^\x00-\x7F]/g, c => encodeURIComponent(c)).replace(/\s+/g, '_');
    const path = `personnel/${personId}/${typeName.replace(/[^a-z0-9]/gi,'_')}/${Date.now()}_${safeName}`;
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/personnel-docs/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${getToken()}`, 'Content-Type': file.type },
      body: file
    });
    if (!uploadRes.ok) { showToast('File upload failed. Please try again.', 'error'); return; }
    fileUrl = `${SUPABASE_URL}/storage/v1/object/public/personnel-docs/${path}`;
  }

  const payload = { issue_date: issueDate || null, expiry_date: expDate || null };
  if (fileUrl) payload.file_url = fileUrl;

  let _savedDocId = editId ? parseInt(editId) : null;
  if (editId) {
    await fetch(`${SUPABASE_URL}/rest/v1/personnel_documents?id=eq.${editId}`, {
      method: 'PATCH', headers: { ...getHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify(payload)
    });
  } else {
    const _pdRes = await fetch(`${SUPABASE_URL}/rest/v1/personnel_documents`, {
      method: 'POST', headers: { ...getHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ personnel_id: parseInt(personId), doc_type_name: typeName, is_mandatory: mandatory, ...payload })
    });
    if (_pdRes.ok) { const [_newPd] = await _pdRes.json(); window._justAddedPersDocId = _newPd?.id; _savedDocId = _newPd?.id; }
  }

  // Reset assessed flag whenever a document is added or updated
  await fetch(`${SUPABASE_URL}/rest/v1/personnel?id=eq.${personId}`, {
    method: 'PATCH', headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ assessed: false })
  });

  // If CV, also save years of experience onto the personnel record
  if (typeName === 'CV') {
    const yrs = parseInt(document.getElementById('persDocYearsExp').value);
    if (!isNaN(yrs)) {
      await fetch(`${SUPABASE_URL}/rest/v1/personnel?id=eq.${personId}`, {
        method: 'PATCH', headers: { ...getHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ years_experience: yrs })
      });
    }
  }
  showToast('Document saved', 'success');
  logAudit('document', _savedDocId, editId ? 'updated' : 'uploaded', 'Personnel document');
  closeModal('addPersDocModal');
  loadPersonnel();
}

async function deletePersDoc(id) {
  if (!await showConfirm('Delete this document?')) return;
  const el = document.querySelector(`[data-doc-id="${id}"]`);
  // Start API call immediately so it runs in parallel with the animation
  const deletePromise = fetch(`${SUPABASE_URL}/rest/v1/personnel_documents?id=eq.${id}`, { method: 'DELETE', headers: { ...getHeaders(), Prefer: 'return=minimal' } });
  animateRemoveEl(el, async () => {
    const r = await deletePromise;
    if (!r.ok) { showToast('Delete failed: ' + r.status, 'error'); }
    else { logAudit('document', id, 'deleted', 'Personnel document'); }
    loadPersonnel(true);
  });
}

async function markPersAssessed(personId) {
  // Optimistic: swap badge immediately
  const card = document.querySelector(`[data-id="p${personId}"]`);
  const badge = card?.querySelector('.sbadge-awaiting');
  if (badge) { badge.className = 'sbadge sbadge-ready'; badge.textContent = 'READY'; }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/personnel?id=eq.${personId}`, {
    method: 'PATCH', headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ assessed: true })
  });
  if (!r.ok) {
    // Roll back
    if (badge) { badge.className = 'sbadge sbadge-awaiting'; badge.textContent = 'AWAITING REVIEW'; }
    showToast('Failed to mark as assessed', 'error');
    return;
  }
  logAudit('personnel', personId, 'updated', 'Marked as assessed');
  loadPersonnel(true);
}

async function deletePersRecord(id) {
  if (!await showConfirm('Delete this personnel record and all their documents?')) return;
  const el = document.querySelector(`[data-id="p${id}"]`);
  // Delete dependents in parallel, then the personnel record — all concurrent with animation
  const h = { ...getHeaders(), Prefer: 'return=minimal' };
  const deletePromise = Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/assessment_personnel?personnel_id=eq.${id}`, { method: 'DELETE', headers: h }),
    fetch(`${SUPABASE_URL}/rest/v1/personnel_documents?personnel_id=eq.${id}`, { method: 'DELETE', headers: h })
  ]).then(() => fetch(`${SUPABASE_URL}/rest/v1/personnel?id=eq.${id}`, { method: 'DELETE', headers: h }));
  animateRemoveEl(el, async () => {
    const r = await deletePromise;
    if (!r.ok) { const t = await r.text(); showToast('Delete failed: ' + r.status, 'error'); }
    else { logAudit('personnel', id, 'deleted', 'Personnel record'); }
    loadPersonnel(true);
  });
}

async function exportPersonnelCsv() {
  const h = getHeaders();
  const people = await apiFetch(`${SUPABASE_URL}/rest/v1/personnel?select=*&order=created_at`, { headers: h });
  if (!people) return;
  const personIds = people.map(p => p.id).join(',');
  let docs = [];
  if (personIds) docs = await apiFetch(`${SUPABASE_URL}/rest/v1/personnel_documents?personnel_id=in.(${personIds})&select=*`, { headers: h }) || [];
  const docsByPerson = {};
  docs.forEach(d => { (docsByPerson[d.personnel_id] = docsByPerson[d.personnel_id] || []).push(d); });

  const rows = people.map(p => {
    const pDocs    = docsByPerson[p.id] || [];
    const allMand  = PERS_DOC_TYPES.filter(t => t.mandatory).every(t => pDocs.some(d => d.doc_type_name === t.name));
    const earliest = pDocs.filter(d => d.expiry_date).map(d => d.expiry_date).sort()[0] || '';
    return {
      'Full Name':      p.full_name,
      'Position':       p.position || '',
      'National ID':    p.national_id || '',
      'Assessed':       p.assessed ? 'Yes' : 'No',
      'Next Expiry':    earliest,
      'Missing Mandatory Docs': allMand ? 'No' : 'Yes',
    };
  });
  exportToCsv(rows, `personnel-${new Date().toISOString().slice(0,10)}.csv`);
}

function togglePersBulkMode() {
  _persBulkMode = !_persBulkMode;
  document.getElementById('persBulkBar').style.display = _persBulkMode ? 'flex' : 'none';
  document.getElementById('persBulkToggleBtn').textContent = _persBulkMode ? 'Cancel' : 'Select';
  document.querySelectorAll('#personnelList .bulk-check').forEach(cb => {
    cb.style.display = _persBulkMode ? 'block' : 'none';
    cb.checked = false;
  });
  updatePersBulkCount();
}

function updatePersBulkCount() {
  const count = document.querySelectorAll('#personnelList .bulk-check:checked').length;
  document.getElementById('persBulkCount').textContent = `${count} selected`;
}

async function bulkDeletePersonnel() {
  const checked = [...document.querySelectorAll('#personnelList .bulk-check:checked')];
  if (!checked.length) { showToast('Select at least one person', 'warn'); return; }
  const count = checked.length;
  if (!await showConfirm(`Delete ${count} personnel record${count > 1 ? 's' : ''}? This cannot be undone.`)) return;

  const ids = checked.map(cb => parseInt(cb.dataset.id, 10)).filter(id => !isNaN(id));
  const h   = { ...getHeaders(), Prefer: 'return=minimal' };
  try {
    const results = await Promise.all(ids.map(id =>
      Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/assessment_personnel?personnel_id=eq.${id}`, { method: 'DELETE', headers: h }),
        fetch(`${SUPABASE_URL}/rest/v1/personnel_documents?personnel_id=eq.${id}`, { method: 'DELETE', headers: h })
      ]).then(() => fetch(`${SUPABASE_URL}/rest/v1/personnel?id=eq.${id}`, { method: 'DELETE', headers: h }))
    ));
    const failed = results.filter(r => !r.ok);
    if (failed.length) {
      showToast(`Delete failed for ${failed.length} record(s)`, 'error');
      loadPersonnel();
      return;
    }
    showToast(`${count} personnel record${count > 1 ? 's' : ''} deleted`, 'success');
    togglePersBulkMode();
    loadPersonnel();
  } catch (e) {
    showToast('Network error during bulk delete', 'error');
    loadPersonnel();
  }
}
