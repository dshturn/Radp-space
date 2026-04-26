// Configuration
const RADP_CONFIG = {
  url: 'https://fslleuedqlxpjnerruzt.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGxldWVkcWx4cGpuZXJydXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTMxMTksImV4cCI6MjA5MDU2OTExOX0.H1narO5BF5uF2KwlKtKvioz3mun2ecxb1Lg_xVDLdt4'
};

let authToken = null;
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

function initializePage() {
  authToken = StorageUtil.getItem('assessor_token');
  currentUser = StorageUtil.getItem('assessor_user');

  if (authToken && currentUser) {
    showContentView();
  } else {
    showLoginView();
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

async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const msgEl = document.getElementById('loginMessage');

  msgEl.innerHTML = '<div class="loading"><div class="spinner"></div> Authenticating...</div>';

  try {
    // Authenticate via Edge Function (avoids CORS issues)
    const authRes = await fetch(`${RADP_CONFIG.url}/functions/v1/sharepoint-auth-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    if (!authRes.ok) {
      const error = await authRes.json();
      throw new Error(error.error || 'Invalid credentials');
    }

    const authData = await authRes.json();
    authToken = authData.token;
    currentUser = authData.user.full_name || email;

    // Store token and user
    StorageUtil.setItem('assessor_token', authToken);
    StorageUtil.setItem('assessor_user', currentUser);

    msgEl.innerHTML = '<div class="success">Login successful! Loading module...</div>';
    setTimeout(() => {
      showContentView();
      msgEl.innerHTML = '';
    }, 1000);

  } catch (error) {
    console.error('Login error:', error);
    msgEl.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    authToken = null;
  }
}

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    StorageUtil.removeItem('assessor_token');
    StorageUtil.removeItem('assessor_user');
    authToken = null;
    currentUser = null;
    document.getElementById('assessmentId').value = '';
    document.getElementById('messageContainer').innerHTML = '';
    document.getElementById('lorContainer').classList.remove('active');
    showLoginView();
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
      fetchFromRadp(`/rest/v1/assessments?id=eq.${assessmentId}`),
      fetchFromRadp(`/rest/v1/assessment_personnel?assessment_id=eq.${assessmentId}&select=*,personnel(id,full_name,position,national_id)`),
      fetchFromRadp(`/rest/v1/assessment_equipment?assessment_id=eq.${assessmentId}&select=*,equipment_items(id,name,serial_number,model)`)
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
        const docs = await fetchFromRadp(`/rest/v1/personnel_documents?personnel_id=in.(${personalIds})`);
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

    // Fetch documents for equipment
    let equipmentDocs = {};
    if (equipment && equipment.length > 0) {
      const equipIds = equipment.map(e => e.equipment_item_id).filter(Boolean).join(',');
      if (equipIds) {
        const docs = await fetchFromRadp(`/rest/v1/documents?equipment_item_id=in.(${equipIds})`);
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
    displayLor(assessData, personnel, equipment, personnelDocs, equipmentDocs);
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
  if (!authToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${RADP_CONFIG.url}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'apikey': RADP_CONFIG.anonKey,
      'Content-Type': 'application/json'
    }
  });

  if (response.status === 401) {
    // Token expired
    handleLogout();
    throw new Error('Session expired. Please login again.');
  }

  if (!response.ok) {
    throw new Error(`RADP API error: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : (data ? [data] : []);
}

function displayLor(assessment, personnel, equipment, personnelDocs, equipmentDocs) {
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

  // Display equipment tree
  const equipmentTree = document.getElementById('equipmentTree');
  if (equipment && equipment.length > 0) {
    let html = '';
    equipment.forEach(e => {
      const equip = e.equipment_items;
      const docs = equipmentDocs[e.equipment_item_id] || [];
      const name = equip.name || equip.model || '—';
      const meta = equip.serial_number ? `S/N: ${equip.serial_number}` : '';

      html += createTreeItemHtml(`equip_${e.equipment_item_id}`, name, meta);
    });
    equipmentTree.innerHTML = html;

    // Add documents to each equipment item
    equipment.forEach(e => {
      const equip = e.equipment_items;
      const docs = equipmentDocs[e.equipment_item_id] || [];
      const itemEl = equipmentTree.querySelector(`[data-item-id="equip_${e.equipment_item_id}"] .tree-children`);

      if (docs.length > 0) {
        itemEl.innerHTML = docs.map(d =>
          createTreeChildHtml(d.doc_type_name, d.issue_date, d.expiry_date, d.file_url)
        ).join('');
      } else {
        itemEl.innerHTML = '<div class="tree-child-item"><div class="tree-child-icon">—</div><div class="tree-child-content"><div class="tree-child-name" style="color: var(--text-3);">No documents</div></div></div>';
      }
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
