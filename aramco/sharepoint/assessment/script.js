// Configuration
const RADP_CONFIG = {
  proxyUrl: 'https://radp-b73e8e73c2e5.herokuapp.com/api'
};

let currentUser = null;

// Storage utility - fallback to sessionStorage if localStorage fails (for iframe isolation)
const StorageUtil = {
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage failed, using sessionStorage:', e);
      sessionStorage.setItem(key, value);
    }
  },
  getItem(key) {
    try {
      return localStorage.getItem(key) || sessionStorage.getItem(key);
    } catch (e) {
      return sessionStorage.getItem(key);
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
    try {
      sessionStorage.removeItem(key);
    } catch (e) {}
  }
};

// ═══════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════

async function initializePage() {
  currentUser = StorageUtil.getItem('assessor_user');

  // Get user from SharePoint if not cached
  if (!currentUser) {
    const user = await getCurrentUser();
    if (user?.title) {
      currentUser = user.title;
      StorageUtil.setItem('assessor_user', currentUser);
    } else {
      currentUser = 'Assessor';
    }
  }

  showContentView();
}

async function getCurrentUser() {
  const base = 'https://sharek.aramco.com.sa';
  try {
    const resp = await fetch(`${base}/_api/web/currentuser`, {
      method: 'GET',
      headers: { 'Accept': 'application/json; odata=verbose' }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const u = json?.d ?? {};
    return { id: u.Id, title: u.Title, email: u.Email };
  } catch (e) {
    console.error('User fetch error', e);
    return null;
  }
}

function showLoginView() {
  document.getElementById('loginContainer').style.display = 'block';
  document.getElementById('contentContainer').style.display = 'none';
}

function showContentView() {
  document.getElementById('loginContainer').style.display = 'none';
  document.getElementById('contentContainer').style.display = 'block';
  document.getElementById('currentUser').textContent = currentUser;
}


function handleLogout() {
  if (confirm('Clear session and reset?')) {
    StorageUtil.removeItem('assessor_user');
    document.getElementById('assessmentId').value = '';
    document.getElementById('messageContainer').innerHTML = '';
    document.getElementById('lorContainer').classList.remove('active');
    location.reload();
  }
}

function showMessage(message, type = 'info') {
  const container = document.getElementById('messageContainer');
  container.innerHTML = `<div class="${type}">${escapeHtml(message)}</div>`;
  setTimeout(() => {
    container.innerHTML = '';
  }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getDocumentStatus(expiryDate) {
  if (!expiryDate) return null;

  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'expiring';
  return 'valid';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function createTreeItemHtml(itemId, itemName, itemMeta, isExpanded = false) {
  return `
    <div class="tree-item" data-item-id="${itemId}">
      <div class="tree-item-header" onclick="toggleTreeItem(this)">
        <div class="tree-toggle ${isExpanded ? 'expanded' : 'collapsed'}"></div>
        <div class="tree-item-content">
          <div class="tree-item-main">
            <div class="tree-item-name">${escapeHtml(itemName)}</div>
            ${itemMeta ? `<div class="tree-item-meta">${escapeHtml(itemMeta)}</div>` : ''}
          </div>
        </div>
      </div>
      <div class="tree-children ${isExpanded ? 'expanded' : ''}"></div>
    </div>
  `;
}

function createTreeChildHtml(docName, issueDate, expiryDate, fileUrl) {
  const status = getDocumentStatus(expiryDate);
  const statusClass = status ? `status-${status}` : '';
  const statusBadge = status ? `<span class="status ${statusClass}">${status.toUpperCase()}</span>` : '';

  return `
    <div class="tree-child-item">
      <div class="tree-child-icon">📄</div>
      <div class="tree-child-content">
        <div class="tree-child-name">
          ${escapeHtml(docName)}
          ${fileUrl ? `<a href="#" class="doc-link" onclick="openDocument(event, '${escapeHtml(fileUrl)}', '${escapeHtml(docName)}')">View</a>` : ''}
        </div>
        <div class="tree-child-dates">
          <span>Issued: ${formatDate(issueDate)}</span>
          <span>Expires: ${formatDate(expiryDate)}</span>
          ${statusBadge}
        </div>
      </div>
    </div>
  `;
}

function toggleTreeItem(headerEl) {
  const item = headerEl.closest('.tree-item');
  const toggle = headerEl.querySelector('.tree-toggle');
  const children = item.querySelector('.tree-children');

  toggle.classList.toggle('collapsed');
  toggle.classList.toggle('expanded');
  children.classList.toggle('expanded');
}

async function fetchAssessment() {
  const assessmentId = document.getElementById('assessmentId').value;
  if (!assessmentId) {
    showMessage('Please enter an assessment ID', 'error');
    return;
  }

  const fetchBtn = document.getElementById('fetchBtn');
  fetchBtn.disabled = true;
  fetchBtn.innerHTML = '<div class="spinner"></div> Fetching...';

  try {
    // Fetch assessment + personnel + equipment in parallel
    const [assessment, personnel, equipment] = await Promise.all([
      fetchFromRadp(`/assessments?id=eq.${assessmentId}`),
      fetchFromRadp(`/assessment_personnel?assessment_id=eq.${assessmentId}&select=*,personnel(id,full_name,position,national_id)`),
      fetchFromRadp(`/assessment_equipment?assessment_id=eq.${assessmentId}&select=*,equipment_items(id,name,serial_number,model,parent_id)`)
    ]);

    if (!assessment || assessment.length === 0) {
      showMessage('Assessment not found', 'error');
      fetchBtn.disabled = false;
      fetchBtn.textContent = '📋 Fetch LoR';
      return;
    }

    const assessData = assessment[0];

    // Fetch documents for personnel
    let personnelDocs = {};
    if (personnel && personnel.length > 0) {
      const personalIds = personnel.map(p => p.personnel_id).filter(Boolean).join(',');
      if (personalIds) {
        const docs = await fetchFromRadp(`/personnel_documents?personnel_id=in.(${personalIds})`);
        if (docs) {
          docs.forEach(doc => {
            if (!personnelDocs[doc.personnel_id]) {
              personnelDocs[doc.personnel_id] = [];
            }
            personnelDocs[doc.personnel_id].push(doc);
          });
        }
      }
    }

    // Fetch equipment hierarchy + documents
    let equipmentHierarchy = {};
    let equipmentDocs = {};
    if (equipment && equipment.length > 0) {
      // Get all equipment IDs (parent + children)
      const equipIds = equipment.map(e => e.equipment_item_id).filter(Boolean);

      // Fetch all children for these equipment items
      if (equipIds.length > 0) {
        const childEquip = await fetchFromRadp(`/equipment_items?parent_id=in.(${equipIds.join(',')})`);
        if (childEquip) {
          childEquip.forEach(child => {
            if (!equipmentHierarchy[child.parent_id]) {
              equipmentHierarchy[child.parent_id] = [];
            }
            equipmentHierarchy[child.parent_id].push(child);
          });
        }
      }

      // Fetch documents for parent + all child equipment
      const allEquipIds = [
        ...equipIds,
        ...Object.values(equipmentHierarchy).flat().map(e => e.id)
      ];

      if (allEquipIds.length > 0) {
        const docs = await fetchFromRadp(`/documents?equipment_item_id=in.(${allEquipIds.join(',')})`);
        if (docs) {
          docs.forEach(doc => {
            if (!equipmentDocs[doc.equipment_item_id]) {
              equipmentDocs[doc.equipment_item_id] = [];
            }
            equipmentDocs[doc.equipment_item_id].push(doc);
          });
        }
      }
    }

    // Display the LoR
    displayLor(assessData, personnel, equipment, personnelDocs, equipmentHierarchy, equipmentDocs);
    showMessage('Assessment loaded successfully', 'success');

  } catch (error) {
    console.error('Error fetching assessment:', error);
    showMessage(`Error: ${error.message}`, 'error');
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.textContent = '📋 Fetch LoR';
  }
}

async function fetchFromRadp(endpoint) {
  const encodedEndpoint = encodeURIComponent(endpoint);
  const proxyUrl = `${RADP_CONFIG.proxyUrl}?endpoint=${encodedEndpoint}`;

  const response = await fetch(proxyUrl, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`RADP API error: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : (data ? [data] : []);
}

function displayLor(assessment, personnel, equipment, personnelDocs, equipmentHierarchy, equipmentDocs) {
  // Update header
  document.getElementById('assessmentIdDisplay').textContent = assessment.id;
  document.getElementById('fieldWell').textContent = assessment.field_well || '—';
  document.getElementById('jobType').textContent = assessment.type_of_job || '—';
  document.getElementById('objective').textContent = assessment.objective || '—';

  const statusBadge = document.getElementById('assessmentStatus');
  const safeStatus = ['draft', 'pending', 'approved', 'rejected'].includes(assessment.status) ? assessment.status : 'draft';
  statusBadge.innerHTML = `<span class="status status-${safeStatus}">${safeStatus.toUpperCase()}</span>`;

  // Display personnel tree
  const personnelTree = document.getElementById('personnelTree');
  if (personnel && personnel.length > 0) {
    let html = '';
    personnel.forEach(p => {
      const person = p.personnel;
      const docs = personnelDocs[p.personnel_id] || [];
      const meta = person.position ? `Position: ${person.position}` : '';

      html += createTreeItemHtml(`pers_${p.personnel_id}`, person.full_name || '—', meta);
    });
    personnelTree.innerHTML = html;

    // Add documents to each personnel item
    personnel.forEach(p => {
      const person = p.personnel;
      const docs = personnelDocs[p.personnel_id] || [];
      const itemEl = personnelTree.querySelector(`[data-item-id="pers_${p.personnel_id}"] .tree-children`);

      if (docs.length > 0) {
        itemEl.innerHTML = docs.map(d =>
          createTreeChildHtml(d.doc_type_name, d.issue_date, d.expiry_date, d.file_url)
        ).join('');
      } else {
        itemEl.innerHTML = '<div class="tree-child-item"><div class="tree-child-icon">—</div><div class="tree-child-content"><div class="tree-child-name" style="color: var(--text-3);">No documents</div></div></div>';
      }
    });
  } else {
    personnelTree.innerHTML = '<div class="empty">No personnel added</div>';
  }

  // Display equipment tree with hierarchy
  const equipmentTree = document.getElementById('equipmentTree');
  if (equipment && equipment.length > 0) {
    let html = '';
    equipment.forEach(e => {
      const equip = e.equipment_items;
      const docs = equipmentDocs[e.equipment_item_id] || [];
      const children = equipmentHierarchy[e.equipment_item_id] || [];
      const name = equip.name || equip.model || '—';
      const meta = equip.serial_number ? `S/N: ${equip.serial_number}` : '';

      html += createTreeItemHtml(`equip_${e.equipment_item_id}`, name, meta);
    });
    equipmentTree.innerHTML = html;

    // Add content to each equipment item (documents + sub-components)
    equipment.forEach(e => {
      const equip = e.equipment_items;
      const parentDocs = equipmentDocs[e.equipment_item_id] || [];
      const children = equipmentHierarchy[e.equipment_item_id] || [];
      const itemEl = equipmentTree.querySelector(`[data-item-id="equip_${e.equipment_item_id}"] .tree-children`);

      let content = '';

      // Add parent documents
      if (parentDocs.length > 0) {
        content += parentDocs.map(d =>
          createTreeChildHtml(d.doc_type_name, d.issue_date, d.expiry_date, d.file_url)
        ).join('');
      }

      // Add sub-components with their documents
      if (children.length > 0) {
        children.forEach(child => {
          const childDocs = equipmentDocs[child.id] || [];
          const childName = child.name || child.model || '—';
          const childMeta = child.serial_number ? `S/N: ${child.serial_number}` : '';

          // Create nested component structure
          content += `
            <div class="tree-child-item" style="padding: 12px 16px 12px 50px; background-color: var(--bg-3); border: none; cursor: default;">
              <div style="flex: 1;">
                <div class="tree-child-name" style="font-weight: 600; color: var(--text-0);">${escapeHtml(childName)}</div>
                ${childMeta ? `<div class="tree-child-dates" style="margin-top: 2px;">${escapeHtml(childMeta)}</div>` : ''}
              </div>
            </div>
          `;

          // Add child documents with extra indentation
          if (childDocs.length > 0) {
            childDocs.forEach(d => {
              content += `
                <div class="tree-child-item" style="padding: 10px 16px 10px 80px;">
                  <div class="tree-child-icon">📄</div>
                  <div class="tree-child-content">
                    <div class="tree-child-name">
                      ${escapeHtml(d.doc_type_name)}
                      ${d.file_url ? `<a href="#" class="doc-link" onclick="openDocument(event, '${escapeHtml(d.file_url)}', '${escapeHtml(d.doc_type_name)}')">View</a>` : ''}
                    </div>
                    <div class="tree-child-dates">
                      <span>Issued: ${formatDate(d.issue_date)}</span>
                      <span>Expires: ${formatDate(d.expiry_date)}</span>
                      ${getDocumentStatus(d.expiry_date) ? `<span class="status status-${getDocumentStatus(d.expiry_date)}">${getDocumentStatus(d.expiry_date).toUpperCase()}</span>` : ''}
                    </div>
                  </div>
                </div>
              `;
            });
          }
        });
      }

      // Show no documents/components message if empty
      if (!parentDocs.length && !children.length) {
        content = '<div class="tree-child-item"><div class="tree-child-icon">—</div><div class="tree-child-content"><div class="tree-child-name" style="color: var(--text-3);">No documents or components</div></div></div>';
      }

      itemEl.innerHTML = content;
    });
  } else {
    equipmentTree.innerHTML = '<div class="empty">No equipment added</div>';
  }

  // Show the LoR container
  document.getElementById('lorContainer').classList.add('active');
}

function openDocument(event, fileUrl, docName) {
  event.preventDefault();
  if (!fileUrl) return;

  const viewer = document.getElementById('documentViewer');
  const viewerBody = document.getElementById('viewerBody');
  const viewerTitle = document.getElementById('viewerTitle');

  viewerTitle.textContent = escapeHtml(docName);

  // Determine file type
  const extension = fileUrl.split('.').pop().toLowerCase();
  let html = '';

  if (['pdf'].includes(extension)) {
    html = `<iframe src="${escapeHtml(fileUrl)}" style="width:100%; height:100%; border:none;"></iframe>`;
  } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
    html = `<img src="${escapeHtml(fileUrl)}" alt="${escapeHtml(docName)}" />`;
  } else {
    html = `
      <div style="text-align: center; color: var(--text-2);">
        <p>Document type not supported for preview</p>
        <p style="margin-top: 12px;">
          <a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer" class="doc-link">
            Open in new window →
          </a>
        </p>
      </div>
    `;
  }

  viewerBody.innerHTML = html;
  viewer.classList.add('open');
}

function closeViewer() {
  document.getElementById('documentViewer').classList.remove('open');
}

// Close viewer with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeViewer();
  }
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initializePage();

  // Allow Enter key to fetch (if element exists)
  const assessmentInput = document.getElementById('assessmentId');
  if (assessmentInput) {
    assessmentInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        fetchAssessment();
      }
    });
  }
});
