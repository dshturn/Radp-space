// ═══════════════════ PERSONNEL ═══════════════════

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
  document.getElementById('ctPersModal').classList.add('open');
}

function onPersPositionChange(sel) {
  document.getElementById('newPersPositionWrap').style.display = sel.value === '__new__' ? 'block' : 'none';
}

async function addPersonnel() {
  const name       = document.getElementById('persName').value.trim();
  const selEl      = document.getElementById('persPositionSelect');
  const nationalId = document.getElementById('persNationalId').value.trim();
  if (!name)           { alert('Please enter full name'); return; }
  if (!selEl.value)    { alert('Please select a position'); return; }
  if (!/^\d{10}$/.test(nationalId)) { alert('ID must be exactly 10 digits'); return; }

  let position = selEl.value;
  if (position === '__new__') {
    const newPos = document.getElementById('persPositionNew').value.trim();
    if (!newPos) { alert('Please enter a position name'); return; }
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
  if (_pRes.ok) { const [_newP] = await _pRes.json(); window._justAddedPersId = _newP?.id; }
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
  const people = await apiFetch(`${SUPABASE_URL}/rest/v1/personnel?select=*&order=created_at`, { headers: h });
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
      let [_exp, _expir, _ok] = [0, 0, 0];
      persons.forEach(p => {
        const docs = docsByPerson[p.id] || [];
        if      (docs.some(d => d.expiry_date && new Date(d.expiry_date) < _t))                                              _exp++;
        else if (docs.some(d => d.expiry_date && new Date(d.expiry_date) >= _t && new Date(d.expiry_date) <= _i30)) _expir++;
        else _ok++;
      });
      return `<div class="eq-group collapsed">
        <div class="group-header" onclick="toggleGroup(this)">
          <span class="group-title">${pos}</span>
          ${grpBadges(_exp, _expir, _ok)}
          <span class="group-toggle">▾</span>
        </div>
        <div class="group-body"><div class="group-body-inner">${cardsHtml}</div></div>
      </div>`;
    }).join('');
  }

  if (preserveState) {
    expandedIds.forEach(id => { const el = document.querySelector(`[data-id="${id}"]`); if (el) el.classList.add('expanded'); });
    document.querySelectorAll('#personnelList .eq-group').forEach(g => {
      const title = g.querySelector('.group-title');
      if (title && expandedGroups.has(title.textContent.trim())) g.classList.remove('collapsed');
    });
    window.scrollTo({ top: scrollY, behavior: 'instant' });
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
  pEl.textContent  = people.length;
  pSub.textContent = missingMandatory > 0 ? `${missingMandatory} docs missing` : (people.length > 0 ? 'All docs uploaded' : 'None added');
  pSub.style.color = missingMandatory > 0 ? '#fbbf24' : '#64748b';
  pTile.className  = 'dash-tile ' + (missingMandatory > 0 ? 'warn' : people.length > 0 ? 'ok' : 'info');
}

function personnelCard(p, docs) {
  const today = new Date(); today.setHours(0,0,0,0);
  const in30  = new Date(today); in30.setDate(in30.getDate() + 30);
  const docMap = {};
  docs.forEach(d => { docMap[d.doc_type_name] = d; });

  const docRows = PERS_DOC_TYPES.map(t => {
    const d = docMap[t.name];
    const mandBadge = t.mandatory
      ? `<span style="font-size:10px;color:#93c5fd;background:#1e3a5f;padding:2px 6px;border-radius:10px;">Required</span>`
      : `<span style="font-size:10px;color:#a78bfa;background:#2d1b69;padding:2px 6px;border-radius:10px;">Optional</span>`;

    if (d) {
      let statusColor = '#6ee7b7', statusText = 'VALID', rowBorder = '';
      if (d.expiry_date) {
        const exp = new Date(d.expiry_date);
        if (exp < today)      { statusColor = '#fda4af'; statusText = 'EXPIRED';  rowBorder = 'border-left:3px solid #fda4af;padding-left:8px;'; }
        else if (exp <= in30) { statusColor = '#fbbf24'; statusText = 'EXPIRING'; rowBorder = 'border-left:3px solid #fbbf24;padding-left:8px;'; }
      }
      const fileBtn = d.file_url ? `<button onclick="openDoc('${d.file_url}')" style="background:none;border:none;color:#38bdf8;font-size:11px;cursor:pointer;padding:0;text-decoration:underline;">📎 View</button>` : '';
      const cfg     = PERS_DOC_TYPES.find(x => x.name === t.name) || {};
      const dateStr = cfg.noIssue && cfg.noExpiry ? ''
                    : cfg.noIssue  ? `Expiry: ${d.expiry_date || '—'}`
                    : cfg.noExpiry ? `Issue: ${d.issue_date || '—'}`
                    : `Issue: ${d.issue_date || '—'} · Expiry: ${d.expiry_date || '—'}`;
      const yrsStr  = t.name === 'CV' && p.years_experience != null ? `<div class="doc-date">${p.years_experience} yrs exp in O&G</div>` : '';
      return `<div class="doc-row" data-doc-id="${d.id}" style="${rowBorder}">
        <div style="flex:1">
          <div class="doc-name" style="display:flex;align-items:center;gap:6px;">${t.name} ${mandBadge}</div>
          ${dateStr ? `<div class="doc-date">${dateStr}</div>` : ''}
          ${yrsStr}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${fileBtn}
          <span style="color:${statusColor};font-size:11px;font-weight:bold;">${statusText}</span>
          <button class="btn-edit" onclick="editPersDoc(${d.id},${p.id},'${t.name}',${t.mandatory},'${d.issue_date||''}','${d.expiry_date||''}',${p.years_experience??'null'})" title="Edit">✏️</button>
          <button class="btn-danger" onclick="deletePersDoc(${d.id})">✕</button>
        </div>
      </div>`;
    } else {
      return `<div class="doc-row">
        <div style="flex:1">
          <div class="doc-name" style="display:flex;align-items:center;gap:6px;">${t.name} ${mandBadge}</div>
          <div class="doc-date" style="color:#475569;">Not uploaded</div>
        </div>
        <button class="upload-btn" onclick="openAddPersDoc(${p.id},'${t.name}',${t.mandatory})">↑ Upload</button>
      </div>`;
    }
  }).join('');

  const expiredCount  = docs.filter(d => d.expiry_date && new Date(d.expiry_date) < today).length;
  const expiringCount = docs.filter(d => { if (!d.expiry_date) return false; const e = new Date(d.expiry_date); return e >= today && e <= in30; }).length;
  const alertBadge = expiredCount  > 0 ? `<span style="background:#4c0519;color:#fda4af;font-size:11px;font-weight:bold;padding:3px 8px;border-radius:20px;">⚠ ${expiredCount} EXPIRED</span>`
                   : expiringCount > 0 ? `<span style="background:#422006;color:#fbbf24;font-size:11px;font-weight:bold;padding:3px 8px;border-radius:20px;">⚠ ${expiringCount} EXPIRING</span>`
                   : '';

  return `<div class="app-card" data-id="p${p.id}">
    <div class="card-header">
      <div style="cursor:pointer;flex:1;" onclick="toggleCard(this.closest('.app-card').querySelector('.btn-toggle'))">
        <div class="card-title">${p.full_name}</div>
        <div class="doc-name" style="margin-top:4px;">${p.position || ''} · ID: ${p.national_id || '—'}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${alertBadge}
        <button class="btn-toggle" onclick="toggleCard(this)" title="Expand">▾</button>
        <button class="btn-danger" onclick="deletePersRecord(${p.id})" title="Delete">🗑</button>
      </div>
    </div>
    <div class="card-body"><div class="body-inner"><div class="body-content">
      <div class="doc-group collapsed">
        <div class="doc-group-header" onclick="toggleDocGroup(this)">
          <span class="doc-group-title">Documents</span>
          ${alertBadge}
          <span class="doc-group-count">${docs.length}</span>
          <span class="doc-group-toggle">▾</span>
        </div>
        <div class="doc-group-body"><div class="doc-group-inner">${docRows}</div></div>
      </div>
    </div></div></div>
  </div>`;
}

function openAddPersDoc(personId, typeName, mandatory) {
  const cfg = PERS_DOC_TYPES.find(t => t.name === typeName) || {};
  document.getElementById('persDocPersonId').value       = personId;
  document.getElementById('persDocIsMandatory').value    = mandatory;
  document.getElementById('persDocTypeName').textContent = typeName;
  document.getElementById('persDocIssueDate').value      = '';
  document.getElementById('persDocExpiryDate').value     = '';
  document.getElementById('persDocFileInput').value      = '';
  document.getElementById('persDocFileName').textContent = '';
  document.getElementById('persDocFileBtn').style.borderColor = '';
  document.getElementById('persDocIssueDateWrap').style.display  = cfg.noIssue    ? 'none' : 'block';
  document.getElementById('persDocExpiryDateWrap').style.display = cfg.noExpiry   ? 'none' : 'block';
  document.getElementById('persDocAutoExpiryNote').style.display = cfg.autoExpiry ? 'block' : 'none';
  document.getElementById('persDocYearsExpWrap').style.display   = typeName === 'CV' ? 'block' : 'none';
  document.getElementById('persDocYearsExp').value  = '';
  document.getElementById('persDocEditId').value     = '';
  document.getElementById('persDocFileRequired').style.display = 'inline';
  document.getElementById('addPersDocModal').classList.add('open');
}

function editPersDoc(docId, personId, typeName, mandatory, issueDate, expiryDate, yearsExp) {
  const cfg = PERS_DOC_TYPES.find(t => t.name === typeName) || {};
  document.getElementById('persDocEditId').value         = docId;
  document.getElementById('persDocPersonId').value       = personId;
  document.getElementById('persDocIsMandatory').value    = mandatory;
  document.getElementById('persDocTypeName').textContent = typeName;
  document.getElementById('persDocIssueDate').value      = issueDate  || '';
  document.getElementById('persDocExpiryDate').value     = expiryDate || '';
  document.getElementById('persDocFileInput').value      = '';
  document.getElementById('persDocFileName').textContent = 'Keep existing file (or choose a new one to replace)';
  document.getElementById('persDocFileBtn').style.borderColor = '';
  document.getElementById('persDocIssueDateWrap').style.display  = cfg.noIssue    ? 'none' : 'block';
  document.getElementById('persDocExpiryDateWrap').style.display = cfg.noExpiry   ? 'none' : 'block';
  document.getElementById('persDocAutoExpiryNote').style.display = cfg.autoExpiry ? 'block' : 'none';
  document.getElementById('persDocYearsExpWrap').style.display   = typeName === 'CV' ? 'block' : 'none';
  document.getElementById('persDocYearsExp').value  = yearsExp != null ? yearsExp : '';
  document.getElementById('persDocFileRequired').style.display = 'none';
  document.getElementById('addPersDocModal').classList.add('open');
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
  if (!file && !editId) { alert('Please attach a file — attachment is required'); document.getElementById('persDocFileBtn').style.borderColor = '#fda4af'; return; }

  let fileUrl = null;
  if (file) {
    const safeName = file.name.replace(/[^\x00-\x7F]/g, c => encodeURIComponent(c)).replace(/\s+/g, '_');
    const path = `personnel/${personId}/${typeName.replace(/[^a-z0-9]/gi,'_')}/${Date.now()}_${safeName}`;
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/personnel-docs/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${getToken()}`, 'Content-Type': file.type },
      body: file
    });
    if (!uploadRes.ok) { alert('File upload failed. Please try again.'); return; }
    fileUrl = `${SUPABASE_URL}/storage/v1/object/public/personnel-docs/${path}`;
  }

  const payload = { issue_date: issueDate || null, expiry_date: expDate || null };
  if (fileUrl) payload.file_url = fileUrl;

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
    if (_pdRes.ok) { const [_newPd] = await _pdRes.json(); window._justAddedPersDocId = _newPd?.id; }
  }

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
  closeModal('addPersDocModal');
  loadPersonnel();
}

async function deletePersDoc(id) {
  if (!confirm('Delete this document?')) return;
  const el = document.querySelector(`[data-doc-id="${id}"]`);
  animateRemoveEl(el, async () => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/personnel_documents?id=eq.${id}`, { method: 'DELETE', headers: { ...getHeaders(), Prefer: 'return=minimal' } });
    if (!r.ok) { alert('Delete failed: ' + r.status); }
    loadPersonnel(true);
  });
}

async function deletePersRecord(id) {
  if (!confirm('Delete this personnel record and all their documents?')) return;
  const el = document.querySelector(`[data-id="p${id}"]`);
  animateRemoveEl(el, async () => {
    const h = { ...getHeaders(), Prefer: 'return=minimal' };
    await fetch(`${SUPABASE_URL}/rest/v1/assessment_personnel?personnel_id=eq.${id}`, { method: 'DELETE', headers: h });
    await fetch(`${SUPABASE_URL}/rest/v1/personnel_documents?personnel_id=eq.${id}`, { method: 'DELETE', headers: h });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/personnel?id=eq.${id}`, { method: 'DELETE', headers: h });
    if (!r.ok) { const t = await r.text(); alert('Delete failed: ' + r.status + '\n' + t); }
    loadPersonnel(true);
  });
}
