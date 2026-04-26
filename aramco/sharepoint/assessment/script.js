// Configuration - Update with your Supabase details
const RADP_CONFIG = {
  url: 'https://fslleuedqlxpjnerruzt.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGxldWVkcWx4cGpuZXJydXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTMxMTksImV4cCI6MjA5MDU2OTExOX0.H1narO5BF5uF2KwlKtKvioz3mun2ecxb1Lg_xVDLdt4'
};

let currentDocument = null;

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
  const response = await fetch(`${RADP_CONFIG.url}${endpoint}`, {
    headers: {
      'apikey': RADP_CONFIG.key,
      'Content-Type': 'application/json'
    }
  });

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

  // Display personnel
  const personnelBody = document.getElementById('personnelBody');
  if (personnel && personnel.length > 0) {
    personnelBody.innerHTML = personnel.map(p => {
      const person = p.personnel;
      const docs = personnelDocs[p.personnel_id] || [];
      const docsHtml = docs.length > 0
        ? docs.map(d => `<a href="#" class="doc-link" onclick="openDocument(event, '${escapeHtml(d.file_url)}', '${escapeHtml(d.doc_type_name)}')">${escapeHtml(d.doc_type_name)}</a>`).join(' • ')
        : '<span style="color: var(--text-3);">No documents</span>';

      return `
        <tr>
          <td>${escapeHtml(person.full_name || '—')}</td>
          <td>${escapeHtml(person.position || '—')}</td>
          <td>${docsHtml}</td>
          <td><span class="status status-pending">PENDING</span></td>
        </tr>
      `;
    }).join('');
  } else {
    personnelBody.innerHTML = '<tr><td colspan="4" class="empty">No personnel added</td></tr>';
  }

  // Display equipment
  const equipmentBody = document.getElementById('equipmentBody');
  if (equipment && equipment.length > 0) {
    equipmentBody.innerHTML = equipment.map(e => {
      const equip = e.equipment_items;
      const docs = equipmentDocs[e.equipment_item_id] || [];
      const docsHtml = docs.length > 0
        ? docs.map(d => `<a href="#" class="doc-link" onclick="openDocument(event, '${escapeHtml(d.file_url)}', '${escapeHtml(d.doc_type_name)}')">${escapeHtml(d.doc_type_name)}</a>`).join(' • ')
        : '<span style="color: var(--text-3);">No documents</span>';

      return `
        <tr>
          <td>${escapeHtml(equip.name || equip.model || '—')}</td>
          <td>${escapeHtml(equip.serial_number || '—')}</td>
          <td>${docsHtml}</td>
          <td><span class="status status-pending">PENDING</span></td>
        </tr>
      `;
    }).join('');
  } else {
    equipmentBody.innerHTML = '<tr><td colspan="4" class="empty">No equipment added</td></tr>';
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

// Allow Enter key to fetch
document.getElementById('assessmentId').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    fetchAssessment();
  }
});
