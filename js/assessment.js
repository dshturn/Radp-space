// ═══════════════════ ASSESSMENT ═══════════════════

let currentAssessmentId = null;
let _currentAssessment = null;
let _assessPage = 0;
const _ASSESS_PAGE_SIZE = 25;

function assessmentInit() {
  loadAssessments();
}

// ── Mini dashboard: assessments tile ──
async function loadDashAssessments() {
  const u = getUser();
  const assessments = await apiFetch(`${SUPABASE_URL}/rest/v1/assessments?contractor_id=eq.${u.id}&select=id,status`, { headers: getHeaders() });
  const aEl   = document.getElementById('dashAssessments');
  const aSub  = document.getElementById('dashAssessmentsSub');
  const aTile = aEl.closest('.dash-tile');
  if (!assessments) return;
  const total    = assessments.length;
  const approved = assessments.filter(a => a.status === 'approved').length;
  const draft    = assessments.filter(a => !a.status || a.status === 'draft').length;
  aEl.textContent  = total;
  aSub.textContent = draft > 0 ? `${draft} in progress` : (total > 0 ? `${approved} approved` : 'None yet');
  aSub.style.color = '';
  aTile.className  = 'dash-tile ' + (total > 0 ? 'ok' : 'info');
}

function showList() {
  document.querySelectorAll('#assessment-page .as-view').forEach(v => v.classList.remove('active'));
  document.getElementById('listView').classList.add('active');
  loadAssessments();
}

function showCreate() {
  document.querySelectorAll('#assessment-page .as-view').forEach(v => v.classList.remove('active'));
  document.getElementById('createView').classList.add('active');
  loadServiceLines();
}

async function loadServiceLines() {
  const u     = getUser();
  const res   = await fetch(`${SUPABASE_URL}/rest/v1/service_lines?select=name&order=name`, { headers: getHeaders() });
  const lines = await res.json();
  const sel   = document.getElementById('typeOfJob');
  sel.innerHTML = '<option value="">Select type of job...</option>'
    + lines.map(l => `<option value="${l.name}"${l.name === u.service_line ? ' selected' : ''}>${l.name}</option>`).join('')
    + '<option value="__custom__">+ Add custom type of job...</option>';
  document.getElementById('typeOfJobCustomWrap').style.display = 'none';

  const fwRes  = await apiFetch(`${SUPABASE_URL}/rest/v1/assessments?select=field_well&field_well=not.is.null&order=field_well`, { headers: getHeaders() });
  const unique = [...new Set((fwRes || []).map(r => r.field_well).filter(Boolean))];
  document.getElementById('fieldWellSelect').innerHTML =
    '<option value="">Select field / well...</option>'
    + unique.map(v => `<option value="${v}">${v}</option>`).join('')
    + '<option value="__new__">+ Add new field / well...</option>';
  document.getElementById('fieldWellNewWrap').style.display = 'none';
  document.getElementById('fieldWellNew').value = '';
}

function onFieldWellChange(sel) {
  document.getElementById('fieldWellNewWrap').style.display = sel.value === '__new__' ? 'block' : 'none';
  if (sel.value === '__new__') document.getElementById('fieldWellNew').focus();
}

function onTypeOfJobChange(sel) {
  const isCustom = sel.value === '__custom__';
  document.getElementById('typeOfJobCustomWrap').style.display = isCustom ? 'block' : 'none';
  if (isCustom) document.getElementById('typeOfJobCustom').focus();
}

function showDetail(id) {
  currentAssessmentId = id;
  document.querySelectorAll('#assessment-page .as-view').forEach(v => v.classList.remove('active'));
  const detailView = document.getElementById('detailView');
  if (detailView) detailView.classList.add('active');
  document.querySelectorAll('#detailTabs .tab').forEach(t => t.classList.remove('active'));
  const firstTab = document.querySelectorAll('#detailTabs .tab')[0];
  if (firstTab) firstTab.classList.add('active');
  const persTab = document.getElementById('personnelTab');
  if (persTab) persTab.style.display = 'block';
  const equipTab = document.getElementById('equipmentTab');
  if (equipTab) equipTab.style.display = 'none';
  loadAssessmentDetail(id);
}

const DT_ORDER = { personnel: 0, equipment: 1 };

function showDetailTab(tab, el) {
  const perVisible = document.getElementById('personnelTab').style.display !== 'none';
  const current    = perVisible ? 'personnel' : 'equipment';
  const goingRight = DT_ORDER[tab] > DT_ORDER[current];
  const animClass  = goingRight ? 'slide-in-right' : 'slide-in-left';
  document.querySelectorAll('#detailTabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const target = tab === 'equipment' ? document.getElementById('equipmentTab') : document.getElementById('personnelTab');
  const other  = tab === 'equipment' ? document.getElementById('personnelTab')  : document.getElementById('equipmentTab');
  other.style.display = 'none';
  target.style.display = 'block';
  target.classList.remove('slide-in-right', 'slide-in-left');
  target.classList.add(animClass);
  target.addEventListener('animationend', () => target.classList.remove(animClass), { once: true });
}

async function loadAssessments() {
  const u = getUser();
  const from = _assessPage * _ASSESS_PAGE_SIZE;
  const res  = await fetch(
    `${SUPABASE_URL}/rest/v1/assessments?contractor_id=eq.${u.id}&order=created_at.desc&offset=${from}&limit=${_ASSESS_PAGE_SIZE}`,
    { headers: { ...getHeaders(), Prefer: 'count=exact' } }
  );
  if (!res.ok) { showToast('Failed to load assessments', 'error'); return; }
  const assessments = await res.json();
  const totalCount = parseInt(res.headers.get('Content-Range')?.split('/')[1] || '0', 10);
  const list = document.getElementById('assessmentList');
  if (!assessments.length) { list.innerHTML = '<div class="empty">No assessments yet. Create your first one.</div>'; return; }
  const validStatuses = new Set(['draft', 'approved', 'pending', 'rejected']);
  list.innerHTML = assessments.map(a => {
    const safeStatus = validStatuses.has(a.status) ? a.status : 'draft';
    const isEditable = a.status === 'draft';
    return `
    <div class="assessment-card" onclick="showDetail(${parseInt(a.id)})">
      <div>
        <div class="assessment-title">${esc(a.field_well) || 'Untitled'}</div>
        <div class="assessment-meta">${esc(a.type_of_job) || ''} · ${esc(a.date_of_issue) || ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        ${isEditable ? `<button class="btn-edit btn-sm" onclick="openEditAssessment(${parseInt(a.id)});event.stopPropagation();" aria-label="Edit assessment">✏</button>` : ''}
        ${isEditable ? `<button class="btn-danger btn-sm" onclick="deleteAssessment(${parseInt(a.id)});event.stopPropagation();" aria-label="Delete assessment">✕</button>` : ''}
        <span class="badge ${safeStatus}">${safeStatus}</span>
      </div>
    </div>`;
  }).join('');

  const totalPages = Math.ceil(totalCount / _ASSESS_PAGE_SIZE);
  const pagEl = document.getElementById('assessmentPagination');
  if (pagEl) {
    if (totalPages <= 1) { pagEl.innerHTML = ''; }
    else {
      pagEl.innerHTML = `
        <div class="pagination">
          <button class="pag-btn" onclick="_assessPage=Math.max(0,_assessPage-1);loadAssessments()" ${_assessPage === 0 ? 'disabled' : ''}>← Prev</button>
          <span class="pag-info">Page ${_assessPage + 1} of ${totalPages}</span>
          <button class="pag-btn" onclick="_assessPage=Math.min(${totalPages-1},_assessPage+1);loadAssessments()" ${_assessPage >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
        </div>`;
    }
  }
}

async function createAssessment() {
  const requestId  = document.getElementById('requestId').value;
  const fwSel      = document.getElementById('fieldWellSelect');
  const fieldWell  = fwSel.value === '__new__'
    ? document.getElementById('fieldWellNew').value.trim()
    : fwSel.value;
  const typeOfJobSel = document.getElementById('typeOfJob');
  const typeOfJob = typeOfJobSel.value === '__custom__'
    ? document.getElementById('typeOfJobCustom').value.trim()
    : typeOfJobSel.value;
  const objective  = document.getElementById('objective').value;
  if (!fieldWell) { showToast('Please select or enter a Field / Well', 'warn'); return; }
  if (!typeOfJob || typeOfJob === '—') { showToast('Please select a Type of Job', 'warn'); return; }
  if (typeOfJobSel.value === '__custom__' && typeOfJob) {
    await fetch(`${SUPABASE_URL}/rest/v1/service_lines`, {
      method: 'POST', headers: { ...getHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ name: typeOfJob })
    });
  }
  const res  = await fetch(`${SUPABASE_URL}/rest/v1/assessments`, {
    method: 'POST', headers: { ...getHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({ contractor_id: getUser().id, field_well: fieldWell, type_of_job: typeOfJob, objective, sharepoint_request_id: requestId || null })
  });
  if (!res.ok) { showToast('Failed to create assessment', 'error'); return; }
  const data = await res.json();
  if (!data?.[0]?.id) { showToast('Unexpected error creating assessment', 'error'); return; }
  logAudit('assessment', data[0].id, 'created', fieldWell);
  showDetail(data[0].id);
}

async function approveAssessment(assessmentId) {
  const u = getUser();
  if (u.role !== 'admin' && u.role !== 'assessor') { showToast('Only assessors can approve', 'warn'); return; }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${assessmentId}`, {
    method: 'PATCH',
    headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'approved' })
  });
  if (!res.ok) { showToast('Approval failed', 'error'); return; }

  // Trigger SharePoint sync if assessment has sharepoint_request_id
  const assess = await apiFetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${assessmentId}`, { headers: getHeaders() });
  if (assess?.[0]?.sharepoint_request_id) {
    const spId = parseInt(assess[0].sharepoint_request_id);
    syncToSharePoint(assessmentId, spId, 'Approved');
  }

  logAudit('assessment', assessmentId, 'approved', `Assessment ${assessmentId}`);
  showToast('Assessment approved', 'success');
  await loadAssessmentDetail(assessmentId);
}

async function rejectAssessment(assessmentId) {
  const u = getUser();
  if (u.role !== 'admin' && u.role !== 'assessor') { showToast('Only assessors can reject', 'warn'); return; }

  const reason = prompt('Reason for rejection:');
  if (!reason) return;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${assessmentId}`, {
    method: 'PATCH',
    headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'rejected' })
  });
  if (!res.ok) { showToast('Rejection failed', 'error'); return; }

  logAudit('assessment', assessmentId, 'rejected', `Assessment ${assessmentId} — ${reason}`);
  showToast('Assessment rejected', 'success');
  await loadAssessmentDetail(assessmentId);
}

async function syncToSharePoint(assessmentId, sharepointId, newStatus) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sharepoint-update-status`, {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId, sharepointId, newStatus })
    });
    const result = await res.json();
    if (result.success) {
      console.log('SharePoint sync successful:', result.message);
    } else {
      console.warn('SharePoint sync failed:', result.error);
    }
  } catch (err) {
    console.error('SharePoint sync error:', err);
  }
}

async function loadAssessmentDetail(id) {
  const data = await apiFetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${id}`, { headers: getHeaders() });
  if (!data) return;
  const a = data[0];
  _currentAssessment = a;
  const validStatuses = new Set(['draft', 'approved', 'pending', 'rejected']);
  const safeStatus = validStatuses.has(a.status) ? a.status : 'draft';

  const user = getUser();
  let aramcoHtml = '';

  let syncHtml = '';

  // Approval buttons for assessors/admins
  let approvalHtml = '';
  if ((user.role === 'admin' || user.role === 'assessor') && a.status === 'pending') {
    approvalHtml = `
      <div style="margin-top:12px;display:flex;gap:8px;">
        <button class="btn-success" onclick="approveAssessment(${parseInt(id)})">✓ Approve</button>
        <button class="btn-danger" onclick="rejectAssessment(${parseInt(id)})">✗ Reject</button>
      </div>`;
  }

  document.getElementById('assessmentInfo').innerHTML = `
    <h2 style="margin-bottom:12px;">${esc(a.field_well)}</h2>
    <div class="detail-info">Type: ${esc(a.type_of_job)}</div>
    <div class="detail-info">Objective: ${esc(a.objective) || '—'}</div>
    <div class="detail-info" style="margin-bottom:0;">Date: ${esc(a.date_of_issue)} · Status: <span class="badge ${safeStatus}">${safeStatus}</span></div>${aramcoHtml}${syncHtml}${approvalHtml}`;
  loadSelectedEquipment(id);
  loadSelectedPersonnel(id);
}

async function loadSelectedEquipment(id) {
  const items = await apiFetch(`${SUPABASE_URL}/rest/v1/assessment_equipment?assessment_id=eq.${id}&select=*,equipment_items(serial_number,model,equipment_template_id,equipment_templates(name))`, { headers: getHeaders() });
  if (!items) return;
  const el = document.getElementById('equipmentTab');
  if (!el) return;
  if (!items.length) { el.innerHTML = '<div class="empty">No equipment selected</div>'; return; }
  el.innerHTML = items.map(i => `
    <div class="item-row">
      <div class="item-info"><div class="item-name">${esc(i.equipment_items?.equipment_templates?.name || i.equipment_items?.model || '—')}</div><div class="item-detail">S/N: ${esc(i.equipment_items?.serial_number || '—')}</div></div>
      <button class="btn-danger" onclick="removeEquipment(${parseInt(i.id)})">Remove</button>
    </div>`).join('');
}

async function loadSelectedPersonnel(id) {
  const items = await apiFetch(`${SUPABASE_URL}/rest/v1/assessment_personnel?assessment_id=eq.${id}&select=*,personnel(full_name,position,national_id)`, { headers: getHeaders() });
  if (!items) return;
  const el = document.getElementById('personnelTab');
  if (!el) return;
  if (!items.length) { el.innerHTML = '<div class="empty">No personnel selected</div>'; return; }
  el.innerHTML = items.map(i => `
    <div class="item-row">
      <div class="item-info"><div class="item-name">${esc(i.personnel?.full_name || '—')}</div><div class="item-detail">${esc(i.personnel?.position || '')} · ID: ${esc(i.personnel?.national_id || '—')}</div></div>
      <button class="btn-danger" onclick="removePersonnel(${parseInt(i.id)})">Remove</button>
    </div>`).join('');
}

async function openEquipmentSelector() {
  const h = getHeaders();
  const [itemsRes, allItemsRes, addedRes, docsRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/equipment_items?dismissed=is.false&parent_id=is.null&select=*,equipment_templates(name)&order=created_at`, { headers: h }),
    fetch(`${SUPABASE_URL}/rest/v1/equipment_items?dismissed=is.false&select=id,parent_id`, { headers: h }),
    fetch(`${SUPABASE_URL}/rest/v1/assessment_equipment?assessment_id=eq.${currentAssessmentId}&select=id,equipment_item_id`, { headers: h }),
    fetch(`${SUPABASE_URL}/rest/v1/documents?select=equipment_item_id`, { headers: h })
  ]);
  if (itemsRes.status === 401) { localStorage.removeItem('radp_token'); localStorage.removeItem('radp_user'); showPage('login'); return; }
  const items    = await itemsRes.json();
  const allItems = allItemsRes.ok ? await allItemsRes.json() : [];
  const added    = addedRes.ok  ? await addedRes.json()    : [];
  const allDocs  = docsRes.ok   ? await docsRes.json()     : [];
  const addedMap = Object.fromEntries(added.map(a => [String(a.equipment_item_id), a.id]));

  // Build parent→children map and set of item IDs that have at least one document
  const childrenOf = {};
  allItems.forEach(i => { if (i.parent_id) { (childrenOf[i.parent_id] = childrenOf[i.parent_id] || []).push(i.id); } });
  const itemsWithDocs = new Set(allDocs.map(d => d.equipment_item_id));
  function treeHasDocs(id) {
    if (itemsWithDocs.has(id)) return true;
    return (childrenOf[id] || []).some(cid => treeHasDocs(cid));
  }

  document.getElementById('equipSelectorList').innerHTML = items.map(i => {
    const rowId    = addedMap[String(i.id)];
    const isAdded  = !!rowId;
    const hasDocs  = treeHasDocs(i.id);
    // Only AWAITING REVIEW = has docs + not yet assessed
    const eligible = !i.assessed && hasDocs;
    const label    = esc(i.equipment_templates?.name || i.model || '—');
    const detail   = `S/N: ${esc(i.serial_number || '—')}`;
    const safeId   = parseInt(i.id);
    const safeRowId = parseInt(rowId);

    const statusBadge = !hasDocs
      ? `<span class="sbadge sbadge-missing">MISSING DOCS</span>`
      : i.assessed
      ? `<span class="sbadge sbadge-ready">READY</span>`
      : `<span class="sbadge sbadge-awaiting">AWAITING REVIEW</span>`;

    if (isAdded) {
      return `<div class="item-row">
          <div class="item-info">
            <div class="item-name row-gap-xs">${label} ${statusBadge}</div>
            <div class="item-detail">${detail} · <em style="color:var(--text-4);">Already added</em></div>
          </div>
          <button class="btn-danger" onclick="removeEquipment(${safeRowId},true)">Remove</button>
        </div>`;
    } else if (!eligible) {
      return `<div class="item-row item-disabled">
          <div class="item-info">
            <div class="item-name row-gap-xs">${label} ${statusBadge}</div>
            <div class="item-detail">${detail}</div>
          </div>
        </div>`;
    } else {
      return `<div class="checkbox-item">
          <div class="row-gap-md"><input type="checkbox" id="eq_${safeId}" value="${safeId}"><label for="eq_${safeId}" class="label-row"><strong>${label}</strong>${statusBadge}<span style="color:var(--text-3);font-size:12px;"> · ${detail}</span></label></div>
          <button class="btn-success btn-success-sm" style="flex-shrink:0;" onclick="addEquipmentItem(${safeId})">Add</button>
        </div>`;
    }
  }).join('') || '<div class="empty">No equipment in your database</div>';
  openModal('asEquipModal');
  const eq = document.getElementById('equipSelectorSearch').value;
  if (eq) filterCheckboxList('equipSelectorList', eq);
}

async function addSelectedEquipment() {
  const checked = [...document.querySelectorAll('#equipSelectorList input:checked')].map(c => c.value);
  if (!checked.length) { showToast('Select at least one item', 'warn'); return; }
  await Promise.all(checked.map(itemId =>
    fetch(`${SUPABASE_URL}/rest/v1/assessment_equipment`, {
      method: 'POST', headers: { ...getHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ assessment_id: currentAssessmentId, equipment_item_id: parseInt(itemId) })
    })
  ));
  document.getElementById('asEquipModal').classList.remove('open');
  loadSelectedEquipment(currentAssessmentId);
}

async function addEquipmentItem(itemId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/assessment_equipment`, {
    method: 'POST', headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ assessment_id: currentAssessmentId, equipment_item_id: itemId })
  });
  if (!r.ok) { showToast('Add failed: ' + r.status, 'error'); return; }
  const equip = await apiFetch(`${SUPABASE_URL}/rest/v1/equipment_items?id=eq.${itemId}&select=name,serial_number,model`, { headers: getHeaders() });
  const name = equip?.[0]?.name || equip?.[0]?.model || 'Equipment';
  const serial = equip?.[0]?.serial_number ? ` - ${equip[0].serial_number}` : '';
  const equipLabel = `${name}${serial}`;
  logAudit('assessment', currentAssessmentId, 'added_equipment', equipLabel);
  loadSelectedEquipment(currentAssessmentId);
  openEquipmentSelector();
}

async function addPersonnelItem(persId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/assessment_personnel`, {
    method: 'POST', headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ assessment_id: currentAssessmentId, personnel_id: persId })
  });
  if (!r.ok) { showToast('Add failed: ' + r.status, 'error'); return; }
  try {
    const person = await apiFetch(`${SUPABASE_URL}/rest/v1/personnel?id=eq.${persId}&select=full_name,position`, { headers: getHeaders() });
    const persLabel = person?.[0]?.full_name || `Personnel ${persId}`;
    logAudit('assessment', currentAssessmentId, 'added_personnel', persLabel);
  } catch (err) {
    console.error('Failed to log personnel addition:', err);
    logAudit('assessment', currentAssessmentId, 'added_personnel', `Personnel ${persId}`);
  }
  loadSelectedPersonnel(currentAssessmentId);
  openPersonnelSelector();
}

async function removeEquipment(id, fromSelector) {
  const btn = document.querySelector(`button[onclick*="removeEquipment(${id}"]`);
  if (btn?.disabled) return; // Prevent double-click
  btn.disabled = true;
  const label = btn?.closest('.item-row')?.querySelector('.item-name')?.textContent || `Equipment ${id}`;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/assessment_equipment?id=eq.${id}`, { method: 'DELETE', headers: { ...getHeaders(), Prefer: 'return=minimal' } });
    if (!r.ok) { showToast('Remove failed: ' + r.status, 'error'); btn.disabled = false; return; }
    logAudit('assessment', currentAssessmentId, 'removed_equipment', label);
    loadSelectedEquipment(currentAssessmentId);
    if (fromSelector) openEquipmentSelector();
  } catch (err) {
    console.error('Remove equipment error:', err);
    showToast('Remove failed: ' + err.message, 'error');
    btn.disabled = false;
  }
}

async function openPersonnelSelector() {
  const h = getHeaders();
  const [peopleRes, addedRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/personnel?select=*&order=created_at`, { headers: h }),
    fetch(`${SUPABASE_URL}/rest/v1/assessment_personnel?assessment_id=eq.${currentAssessmentId}&select=id,personnel_id`, { headers: h })
  ]);
  if (peopleRes.status === 401) { localStorage.removeItem('radp_token'); localStorage.removeItem('radp_user'); showPage('login'); return; }
  const people = await peopleRes.json();
  const added  = addedRes.ok ? await addedRes.json() : [];

  // Fetch docs for these personnel to verify mandatory uploads
  let allDocs = [];
  if (people.length) {
    const ids = people.map(p => p.id).join(',');
    const docsRes = await fetch(`${SUPABASE_URL}/rest/v1/personnel_documents?personnel_id=in.(${ids})&select=personnel_id,doc_type_name`, { headers: h });
    if (docsRes.ok) allDocs = await docsRes.json();
  }

  const addedMap    = Object.fromEntries(added.map(a => [String(a.personnel_id), a.id]));
  const docsByPerson = {};
  allDocs.forEach(d => { (docsByPerson[d.personnel_id] = docsByPerson[d.personnel_id] || []).push(d.doc_type_name); });
  const mandatoryTypes = PERS_DOC_TYPES.filter(t => t.mandatory).map(t => t.name);

  // Only AWAITING REVIEW = all mandatory docs present + not yet assessed
  const isEligible = p => {
    const uploaded = new Set(docsByPerson[p.id] || []);
    return mandatoryTypes.every(name => uploaded.has(name)) && !p.assessed;
  };

  document.getElementById('persSelectorList').innerHTML = people.map(p => {
    const rowId    = addedMap[String(p.id)];
    const isAdded  = !!rowId;
    const eligible = isEligible(p);

    const uploaded     = new Set(docsByPerson[p.id] || []);
    const allMandatory = mandatoryTypes.every(name => uploaded.has(name));
    const statusBadge  = !allMandatory
      ? `<span class="sbadge sbadge-missing">MISSING DOCS</span>`
      : p.assessed
      ? `<span class="sbadge sbadge-ready">READY</span>`
      : `<span class="sbadge sbadge-awaiting">AWAITING REVIEW</span>`;

    const safePId  = parseInt(p.id);
    const safeRId  = parseInt(rowId);
    if (isAdded) {
      return `<div class="item-row">
          <div class="item-info">
            <div class="item-name row-gap-xs">${esc(p.full_name)} ${statusBadge}</div>
            <div class="item-detail">${esc(p.position || '')}<em style="color:var(--text-4);"> · Already added</em></div>
          </div>
          <button class="btn-danger" onclick="removePersonnel(${safeRId},true)">Remove</button>
        </div>`;
    } else if (!eligible) {
      return `<div class="item-row item-disabled">
          <div class="item-info">
            <div class="item-name row-gap-xs">${esc(p.full_name)} ${statusBadge}</div>
            <div class="item-detail">${esc(p.position || '')}</div>
          </div>
        </div>`;
    } else {
      return `<div class="checkbox-item"><div class="row-gap-md"><input type="checkbox" id="per_${safePId}" value="${safePId}"><label for="per_${safePId}" class="label-row"><strong>${esc(p.full_name)}</strong>${statusBadge}<span style="color:var(--text-3);font-size:12px;"> · ${esc(p.position || '')}</span></label></div><button class="btn-success btn-success-sm" style="flex-shrink:0;" onclick="addPersonnelItem(${safePId})">Add</button></div>`;
    }
  }).join('') || '<div class="empty">No personnel in your database</div>';
  openModal('asPersModal');
  const ps = document.getElementById('persSelectorSearch').value;
  if (ps) filterCheckboxList('persSelectorList', ps);
}

async function addSelectedPersonnel() {
  const checked = [...document.querySelectorAll('#persSelectorList input:checked')].map(c => c.value);
  if (!checked.length) { showToast('Select at least one person', 'warn'); return; }
  await Promise.all(checked.map(persId =>
    fetch(`${SUPABASE_URL}/rest/v1/assessment_personnel`, {
      method: 'POST', headers: { ...getHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ assessment_id: currentAssessmentId, personnel_id: parseInt(persId) })
    })
  ));
  document.getElementById('asPersModal').classList.remove('open');
  loadSelectedPersonnel(currentAssessmentId);
}

async function removePersonnel(id, fromSelector) {
  const btn = document.querySelector(`button[onclick*="removePersonnel(${id}"]`);
  if (btn?.disabled) return; // Prevent double-click
  btn.disabled = true;
  const label = btn?.closest('.item-row')?.querySelector('.item-name')?.textContent || `Personnel ${id}`;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/assessment_personnel?id=eq.${id}`, {
      method: 'DELETE',
      headers: { ...getHeaders(), Prefer: 'return=minimal' }
    });
    if (!res.ok) { showToast('Remove failed: ' + res.status, 'error'); btn.disabled = false; return; }
    logAudit('assessment', currentAssessmentId, 'removed_personnel', label);
    loadSelectedPersonnel(currentAssessmentId);
    if (fromSelector) openPersonnelSelector();
  } catch (err) {
    console.error('Remove personnel error:', err);
    showToast('Remove failed: ' + err.message, 'error');
    btn.disabled = false;
  }
}

// ─── LoR ───
function getExpiryStyle(dateStr) {
  if (!dateStr || dateStr === '—' || dateStr === '-') return '';
  const expiry = parseUTC(dateStr), today = todayUTC();
  const in14 = new Date(today); in14.setDate(in14.getDate() + 14);
  if (expiry < today)  return 'background:#ffcccc;font-weight:bold;';
  if (expiry <= in14)  return 'background:#fff3cc;font-weight:bold;';
  return '';
}

async function generateLoR() {
  const h = getHeaders(), u = getUser();
  const [aRes, eRes, pRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${currentAssessmentId}`, { headers: h }),
    fetch(`${SUPABASE_URL}/rest/v1/assessment_equipment?assessment_id=eq.${currentAssessmentId}&select=*,equipment_items(id,serial_number,model,name,parent_id,equipment_templates(name),documents(*,document_types(document_name)))`, { headers: h }),
    fetch(`${SUPABASE_URL}/rest/v1/assessment_personnel?assessment_id=eq.${currentAssessmentId}&select=*,personnel(*)`, { headers: h })
  ]);
  const assessment = (await aRes.json())[0];
  const equipment  = await eRes.json();
  const personnel  = await pRes.json();

  // Fetch documents only for personnel in this assessment
  const personnelIds = personnel.map(p => p.personnel.id).filter(Boolean);
  let allPersonnelDocs = [];
  if (personnelIds.length) {
    const pDocsRes = await fetch(`${SUPABASE_URL}/rest/v1/personnel_documents?personnel_id=in.(${personnelIds.join(',')})&select=*`, { headers: h });
    allPersonnelDocs = pDocsRes.ok ? await pDocsRes.json() : [];
  }

  // ── Fetch sub-components and sub-sub-components for selected root equipment ──
  const rootItems = equipment.map(e => e.equipment_items).filter(Boolean);
  const rootIds   = rootItems.map(i => i.id);
  let childItems  = [];
  if (rootIds.length) {
    const cRes = await fetch(
      `${SUPABASE_URL}/rest/v1/equipment_items?dismissed=is.false&parent_id=in.(${rootIds.join(',')})&select=id,parent_id,serial_number,model,name,equipment_templates(name),documents(*,document_types(document_name))`,
      { headers: h }
    );
    if (cRes.ok) childItems = await cRes.json();
  }
  const childIds = childItems.map(i => i.id);
  let grandItems = [];
  if (childIds.length) {
    const gcRes = await fetch(
      `${SUPABASE_URL}/rest/v1/equipment_items?dismissed=is.false&parent_id=in.(${childIds.join(',')})&select=id,parent_id,serial_number,model,name,equipment_templates(name),documents(*,document_types(document_name))`,
      { headers: h }
    );
    if (gcRes.ok) grandItems = await gcRes.json();
  }
  const kidsByParent = {};
  [...childItems, ...grandItems].forEach(c => { (kidsByParent[c.parent_id] = kidsByParent[c.parent_id] || []).push(c); });

  const today = todayUTC();
  const todayStr = today.toLocaleDateString('en-GB');
  const allExpiries = [];

  // Deduplicate documents (remove exact duplicates)
  const seenDocs = new Set();
  const uniqueDocs = allPersonnelDocs.filter(d => {
    const key = `${d.personnel_id}:${d.doc_type_name}`;
    if (seenDocs.has(key)) return false;
    seenDocs.add(key);
    return true;
  });

  // Build map of documents by personnel_id
  const docsByPersonnel = {};
  uniqueDocs.forEach(d => {
    if (!docsByPersonnel[d.personnel_id]) docsByPersonnel[d.personnel_id] = [];
    docsByPersonnel[d.personnel_id].push(d);
  });

  // Deduplicate personnel by ID (in case assessment_personnel has duplicates)
  const seenPersonnelIds = new Set();
  const uniquePersonnel = personnel.filter(p => {
    const id = p.personnel?.id;
    if (seenPersonnelIds.has(id)) return false;
    seenPersonnelIds.add(id);
    return true;
  });

  // Group personnel by job role
  const byRole = {};
  uniquePersonnel.forEach(p => {
    const role = p.personnel?.position || 'Unassigned';
    if (!byRole[role]) byRole[role] = [];
    byRole[role].push(p);
  });

  let persRows = '', pNum = 1;
  const roles = Object.keys(byRole).sort();
  roles.forEach(role => {
    persRows += `<tr><td colspan="11" style="background:#1e3a5f;color:white;font-weight:bold;padding:5px 4px;border:1px solid #bbb;">● ${esc(role)}</td></tr>`;
    byRole[role].forEach(p => {
      const per = p.personnel;
      const docs = docsByPersonnel[per.id] || [];
      if (!docs.length) {
        persRows += `<tr><td>${pNum++}</td><td>${esc(per?.full_name||'—')}</td><td>${esc(String(per?.years_experience||'—'))}</td><td>${esc(per?.position||'—')}</td><td>—</td><td>—</td><td class="ac"></td><td class="ac"></td><td class="ac"></td><td class="ac"></td><td class="ac"></td></tr>`;
      } else {
        docs.forEach((d, idx) => {
          const expiry = d.expiry_date || '';
          if (expiry && expiry !== '—' && expiry !== '-') allExpiries.push(new Date(expiry));
          const docName = d.doc_type_name || '—';
          const docLink = d.file_url ? `<a href="${d.file_url}" target="_blank" style="color:#0066cc;text-decoration:underline;cursor:pointer;">${esc(docName)}</a>` : esc(docName);
          persRows += `<tr>`
            + `<td>${idx === 0 ? pNum++ : ''}</td>`
            + `<td>${idx === 0 ? esc(per?.full_name||'—') : ''}</td>`
            + `<td>${idx === 0 ? esc(String(per?.years_experience||'—')) : ''}</td>`
            + `<td>${idx === 0 ? esc(per?.position||'—') : ''}</td>`
            + `<td>${docLink}</td>`
            + `<td style="${getExpiryStyle(expiry)}">${esc(expiry || '—')}</td>`
            + `<td class="ac"></td><td class="ac"></td><td class="ac"></td><td class="ac"></td><td class="ac"></td>`
            + `</tr>`;
        });
      }
    });
  });

  // ── Group equipment by type and render recursively ──
  let equipRows = '', eNum = 1;
  const itemName = it => esc(it?.equipment_templates?.name || it?.name || it?.model || '—');
  const itemType = it => esc(it?.equipment_templates?.name || 'Uncategorized');
  const indentFor = depth => depth === 0 ? '' : '&nbsp;'.repeat(depth * 4) + '└─ ';
  const tdBg = depth => depth === 0 ? '' : depth === 1 ? 'background:#eef3f8!important;' : 'background:#dde5ee!important;';

  function renderItem(item, depth) {
    const docs = item?.documents || [];
    const bg   = tdBg(depth);
    const td   = (content, extra = '') => `<td style="${bg}${extra}">${content}</td>`;
    const tdAc = () => `<td class="ac" style="${bg}"></td>`;
    const numCell = depth === 0 ? String(eNum++) : '';
    const sn      = esc(item?.serial_number || '—');
    const label   = indentFor(depth) + itemName(item);

    if (!docs.length) {
      equipRows += `<tr>${td(numCell)}${td(sn)}${td(label)}${td('—')}${td('—')}${td('—')}${tdAc()}${tdAc()}${tdAc()}${tdAc()}${tdAc()}</tr>`;
    } else {
      docs.forEach((d, idx) => {
        const expiry = d.expiry_date || '';
        if (expiry && expiry !== '—' && expiry !== '-') allExpiries.push(new Date(expiry));
        const docName = d.document_types?.document_name || d.doc_type_name || '—';
        const docLink = d.file_url ? `<a href="${d.file_url}" target="_blank" style="color:#0066cc;text-decoration:underline;cursor:pointer;">${esc(docName)}</a>` : esc(docName);
        equipRows += `<tr>`
          + td(idx === 0 ? numCell : '')
          + td(idx === 0 ? sn      : '')
          + td(idx === 0 ? label   : '')
          + td(docLink)
          + td(esc(d.issue_date || '—'))
          + td(esc(expiry || '—'), getExpiryStyle(expiry))
          + tdAc() + tdAc() + tdAc() + tdAc() + tdAc()
          + `</tr>`;
      });
    }

    (kidsByParent[item.id] || []).forEach(child => renderItem(child, depth + 1));
  }

  const byType = {};
  rootItems.forEach(item => {
    const type = itemType(item);
    if (!byType[type]) byType[type] = [];
    byType[type].push(item);
  });

  const types = Object.keys(byType).sort();
  types.forEach(type => {
    equipRows += `<tr><td colspan="11" style="background:#2d4a1e;color:white;font-weight:bold;padding:5px 4px;border:1px solid #bbb;">● ${type}</td></tr>`;
    byType[type].forEach(item => renderItem(item, 0));
  });
  let validTillStr = '—', validTillBg = '#cccccc', validTillColor = '#333';
  if (allExpiries.length) {
    const validTill = new Date(Math.min(...allExpiries.map(d => d.getTime())));
    validTillStr = validTill.toLocaleDateString('en-GB');
    const in14 = new Date(today); in14.setDate(in14.getDate() + 14);
    if (validTill < today)      { validTillBg = '#cc0000'; validTillColor = 'white'; }
    else if (validTill <= in14) { validTillBg = '#ffaa00'; validTillColor = '#000'; }
    else                        { validTillBg = '#00aa44'; validTillColor = 'white'; }
  }
  const lorHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>LoR - ${esc(assessment.field_well)}</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:16px;color:#000}h1{font-size:15px;text-align:center;margin-bottom:2px;font-weight:bold}.subtitle{text-align:center;font-size:10px;color:#444;margin-bottom:10px}h2{font-size:11px;margin:12px 0 5px;background:#1e3a5f;color:white;padding:5px 10px}.info-table{width:100%;border-collapse:collapse;margin-bottom:10px}.info-table td{padding:4px 8px;border:1px solid #bbb;font-size:11px}.info-table .lbl{font-weight:bold;background:#e8edf2;width:130px}table{width:100%;border-collapse:collapse;margin-bottom:12px;table-layout:fixed}th{padding:5px 4px;text-align:left;font-size:10px;border:1px solid #bbb;word-wrap:break-word;word-break:break-word;white-space:normal;line-height:1.3}th.sp{background:#1e3a5f;color:white}th.as{background:#2d4a1e;color:white}td{padding:4px 4px;border:1px solid #ddd;font-size:10px;vertical-align:middle;word-wrap:break-word}tr:nth-child(even) td{background:#f7f9f7}tr:nth-child(even) td.ac{background:#eaf4e8}.ac{background:#f0f7ee}.divider{border-left:2px solid #2d4a1e!important}.footer{margin-top:16px;font-size:10px;color:#888;text-align:center;border-top:1px solid #ddd;padding-top:8px}@media print{body{margin:0;font-size:9px}.no-print{display:none}@page{size:A4 landscape;margin:8mm}th,td,.info-table td{font-size:8px;padding:3px 3px}h2{font-size:9px}}</style></head><body><h1>List of Readiness (LoR)</h1><div class="subtitle">Attachment to SMS Process 07.01 "Service Provider Readiness Assessment Process"</div><table class="info-table"><tr><td class="lbl">Service Provider (SP)</td><td><strong>${esc(u.company||'—')}</strong> · ${esc(u.service_line||'—')}</td><td class="lbl">Date of Issue</td><td>${todayStr}</td><td class="lbl">Valid Till</td><td style="background:${validTillBg};color:${validTillColor};font-weight:bold;padding:3px 6px;">${validTillStr}</td></tr><tr><td class="lbl">Request ID</td><td><strong>${esc(assessment.sharepoint_request_id||'—')}</strong></td><td class="lbl">Field / Well</td><td colspan="3">${esc(assessment.field_well||'—')}</td></tr><tr><td class="lbl">Type of Job</td><td colspan="5">${esc(assessment.type_of_job||'—')}</td></tr><tr><td class="lbl">Objective (Short Summary)</td><td colspan="5">${esc(assessment.objective||'—')}</td></tr><tr><td class="lbl">Peer Review Team</td><td colspan="5" style="color:#999;font-style:italic;">To be filled by assessor</td></tr></table><table><colgroup><col style="width:3%"><col style="width:13%"><col style="width:9%"><col style="width:9%"><col style="width:10%"><col style="width:8%"><col style="width:10%"><col style="width:8%"><col style="width:8%"><col style="width:11%"><col style="width:11%"></colgroup><thead><tr><th class="sp" colspan="6">Manpower</th><th class="as divider" colspan="5">Assessor Section</th></tr><tr><th class="sp">#</th><th class="sp">Name</th><th class="sp">Yrs Exp O&G</th><th class="sp">Job Role</th><th class="sp">Document Name</th><th class="sp">Date of Expiry</th><th class="as divider">NAWCOD Unit</th><th class="as">Auditor</th><th class="as">Date of Audit</th><th class="as">Readiness for Operations</th><th class="as">Comment</th></tr></thead><tbody>${persRows||'<tr><td colspan="11" style="text-align:center;color:#999;">No personnel selected</td></tr>'}<tr><th class="sp" colspan="6">Equipment</th><th class="as divider" colspan="5">Assessor Section</th></tr><tr><th class="sp">#</th><th class="sp">Equipment S/N</th><th class="sp">Equipment Description</th><th class="sp">Type of Integrity Check</th><th class="sp">Date of Certification</th><th class="sp">Date of Expiry</th><th class="as divider">NAWCOD Unit</th><th class="as">Auditor</th><th class="as">Date of Audit</th><th class="as">Readiness for Operations</th><th class="as">Comment</th></tr>${equipRows||'<tr><td colspan="11" style="text-align:center;color:#999;">No equipment selected</td></tr>'}</tbody></table><div class="no-print" style="margin-top:12px;"><button onclick="window.print()" style="background:#1e3a5f;color:white;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:11px;">🖨️ Print / Save as PDF</button></div><div class="footer">Generated by RADP · ${todayStr}</div></body></html>`;
  const downloadScript = `<script>
async function downloadPDF(btn) {
  try {
    btn.disabled = true;
    btn.textContent = '⬇️ Converting...';

    const response = await fetch('http://localhost:5000/api/generate-html-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: document.documentElement.outerHTML })
    });

    if (!response.ok) throw new Error('PDF conversion failed: ' + response.status);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'LoR_' + new Date().toISOString().split('T')[0] + '.pdf';
    a.click();
    URL.revokeObjectURL(url);
    btn.disabled = false;
    btn.textContent = '⬇️ Download as PDF';
  } catch (err) {
    alert('Error: ' + err.message);
    btn.disabled = false;
    btn.textContent = '⬇️ Download as PDF';
  }
}
</script>`;
  const downloadBtn = `<div style="margin-top:12px;"><button onclick="downloadPDF(this)" style="background:#1e3a5f;color:white;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:11px;margin-right:8px;">⬇️ Download as PDF</button><button onclick="window.print()" style="background:#666;color:white;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:11px;">🖨️ Print</button></div>`;
  const htmlWithBtn = lorHtml.replace('</body>', `${downloadBtn}${downloadScript}</body>`);
  const blob = new Blob([htmlWithBtn], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

async function generateLoRWithDocs(type = 'both') {
  if (!currentAssessmentId) { showToast('No assessment selected', 'error'); return; }

  const typeLabel = type === 'personnel' ? 'Personnel LoR + Docs' : type === 'equipment' ? 'Equipment LoR + Docs' : 'LoR + Docs';
  showToast(`Fetching data for ${typeLabel}...`, 'info');

  try {
    const apiUrl = typeof window !== 'undefined' && window.location.port === '3001'
      ? 'http://localhost:5000/api/generate-lor-pdf'
      : '/api/generate-lor-pdf';

    showToast(`Generating PDF (this may take a moment)...`, 'info');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getHeaders().Authorization
      },
      body: JSON.stringify({ assessmentId: currentAssessmentId, docType: type })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      showToast('PDF generation failed: ' + (err.error || response.status), 'error');
      return;
    }

    showToast('Processing documents...', 'info');
    const blob = await response.blob();

    showToast('Finalizing PDF...', 'info');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const assessment = window._currentAssessment || { field_well: 'Assessment' };
    link.href = url;
    link.download = `LoR_${type}_${assessment.field_well || 'Assessment'}_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('PDF generated successfully', 'success');
  } catch (err) {
    console.error('PDF generation error:', err);
    showToast('Error generating PDF: ' + err.message, 'error');
  }
}

// ── Edit and Delete Assessment ──
async function openEditAssessment(id) {
  const data = await apiFetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${id}`, { headers: getHeaders() });
  if (!data || !data[0]) return;
  const a = data[0];
  document.getElementById('editAssessmentId').value = id;
  document.getElementById('editFieldWell').value = a.field_well || '';
  document.getElementById('editTypeOfJob').value = a.type_of_job || '';
  document.getElementById('editObjective').value = a.objective || '';
  document.getElementById('editDateOfIssue').value = a.date_of_issue || '';
  openModal('editAssessmentModal');
}

async function saveEditAssessment() {
  const id = document.getElementById('editAssessmentId').value;
  const fieldWell = document.getElementById('editFieldWell').value.trim();
  const typeOfJob = document.getElementById('editTypeOfJob').value.trim();
  const objective = document.getElementById('editObjective').value.trim();
  const dateOfIssue = document.getElementById('editDateOfIssue').value;

  if (!fieldWell) { showToast('Field / Well is required', 'warn'); return; }
  if (!typeOfJob) { showToast('Type of Job is required', 'warn'); return; }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ field_well: fieldWell, type_of_job: typeOfJob, objective, date_of_issue: dateOfIssue })
  });
  if (!res.ok) { showToast('Failed to update assessment', 'error'); return; }

  logAudit('assessment', id, 'updated', `Assessment updated: ${fieldWell}`);
  showToast('Assessment updated', 'success');
  closeModal('editAssessmentModal');
  loadAssessments();
}

async function deleteAssessment(id) {
  if (!confirm('Are you sure you want to delete this assessment? This action cannot be undone.')) return;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${id}`, {
    method: 'DELETE',
    headers: { ...getHeaders(), Prefer: 'return=minimal' }
  });
  if (!res.ok) { showToast('Failed to delete assessment', 'error'); return; }

  logAudit('assessment', id, 'deleted', `Assessment deleted`);
  showToast('Assessment deleted', 'success');
  loadAssessments();
}

// Page initialization
async function assessmentInit() {
  await loadAssessments();
}
