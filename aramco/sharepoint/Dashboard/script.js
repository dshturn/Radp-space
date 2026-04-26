/* --------------------------------------------------------------
   1️⃣  Configuration – one clean site base (no trailing slash)
   -------------------------------------------------------------- */
const siteBase = 'https://sharek.aramco.com.sa/modern/30037952';   // ← only once
const restBase = `${siteBase}/_api/web`;                         // → …/_api/web

/* --------------------------------------------------------------
   2️⃣  Helper – build a *properly encoded* GetByTitle URL
   -------------------------------------------------------------- */
function listUrl(title){
  // encode the whole title (spaces, ampersand, etc.)
  return `${restBase}/lists/GetByTitle('${encodeURIComponent(title)}')/items`;
}

/* --------------------------------------------------------------
   3️⃣  List configuration – note the OFFWCOD&WSD entry uses the
       internal name via GetList (no encoding needed)
   -------------------------------------------------------------- */
const listConfig = [
  {
    friendly:'ONWCOD',
    title:'ONWCOD Assessment Requests',
    url:listUrl('ONWCOD Assessment Requests'),
    fieldsSelect:"ID,Service_x0020_Type,Service_x0020_Provider,Destination,lorValidityDate,lorIssueDate"
  },
  {
    friendly: 'OFFWCOD&WSD',
    title: 'OFFWCOD&WSD Assessment Requests',
    url: `${restBase}/lists/GetByTitle('OFFWCOD&WSD Assessment Requests')/items`, // Update this line
    fieldsSelect: "ID,Service_x0020_Type,Service_x0020_Provider,Destination,lorValidityDate,lorIssueDate"
  },
  {
    friendly:'ONWSD',
    title:'ONWSD Assessment Requests',
    url:listUrl('ONWSD Assessment Requests'),
    fieldsSelect:"ID,Service_x0020_Type,Service_x0020_Provider,Destination,lorValidityDate,lorIssueDate"
  },
  {
    friendly:'SAOWCOD',
    title:'SAOWCOD',
    url:listUrl('SAOWCOD'),
    fieldsSelect:"ID,Service_x0020_Type,Service_x0020_Provider,Destination,lorValidityDate,lorIssueDate"
  },
  {
    friendly:'SAGWCOD',
    title:'SAGWCOD',
    url:listUrl('SAGWCOD'),
    fieldsSelect:"ID,Service_x0020_Type,Service_x0020_Provider,Destination,lorValidityDate,lorIssueDate"
  }
];

/* --------------------------------------------------------------
   4️⃣  Generic GET helper (single definition)
   -------------------------------------------------------------- */
async function getJSON(url){
  const resp = await fetch(url, {
    method:'GET',
    headers:{'Accept':'application/json; odata=verbose'},
    credentials:'same-origin'
  });
  if (!resp.ok){
    const txt = await resp.text();
    throw new Error(`❌ ${resp.status} ${resp.statusText}: ${txt}`);
  }
  return resp.json();
}

/* --------------------------------------------------------------
   5️⃣  Paging – follow SharePoint __next link
   -------------------------------------------------------------- */
async function fetchAll(url){
  const all = [];
  let next = `${url}?$orderby=Modified desc&$top=5000`;
  while (next){
    const data = await getJSON(next);
    all.push(...data.d.results);
    next = data.d.__next || null;
  }
  return all;
}

/* --------------------------------------------------------------
   6️⃣  Day‑difference helper
   -------------------------------------------------------------- */
function diffInDays(a,b){
  return Math.floor((a-b)/(1000*60*60*24));
}

/* --------------------------------------------------------------
   7️⃣  Normalise helper (used by pickMainPdf)
   -------------------------------------------------------------- */
function normalise(str){
  return (str||'').toLowerCase().replace(/[^a-z0-9]/g,'');
}

/* --------------------------------------------------------------
   8️⃣  Helper – build an absolute URL from a site‑relative one
   -------------------------------------------------------------- */
function makeAbsoluteUrl(base, relative){
  if (!base.endsWith('/')) base += '/';
  return new URL(relative, base).href;
}

/* --------------------------------------------------------------
   9️⃣  Helper – extract a date from a PDF file name
   -------------------------------------------------------------- */
function dateFromFileName(fileName){
  if (!fileName) return null;
  const clean = fileName.replace(/\s+/g,'').toUpperCase();

  // 1️⃣  YYYY‑MM‑DD  or  YYYYMMDD
  let m = clean.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
  if (m){
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}`);
    return isNaN(d) ? null : d;
  }

  // 2️⃣  DD‑MM‑YYYY (or DD_MM_YYYY)
  m = clean.match(/(\d{2})[-_]?(\d{2})[-_]?(\d{4})/);
  if (m){
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}`);
    return isNaN(d) ? null : d;
  }

  // 3️⃣  MM‑DD‑YYYY (fallback US style)
  m = clean.match(/(\d{2})[-_]?(\d{2})[-_]?(\d{4})/);
  if (m){
    const d = new Date(`${m[3]}-${m[1]}-${m[2]}`);
    return isNaN(d) ? null : d;
  }

  // 4️⃣  YYYYMMDD (already covered by #1 but keep for safety)
  m = clean.match(/(\d{4})(\d{2})(\d{2})/);
  if (m){
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}`);
    return isNaN(d) ? null : d;
  }

  // 5️⃣  MM.DD.YY  (e.g. 02.10.26)
  m = clean.match(/(\d{1,2})\.(\d{1,2})\.(\d{2})/);
  if (m){
    const year = `20${m[3]}`;
    const d = new Date(`${year}-${m[1]}-${m[2]}`);
    return isNaN(d) ? null : d;
  }

  // 6️⃣  Single‑digit month/day patterns (1.22.26, 2.1.26, 03.05.26 …)
  m = clean.match(/(\d{1,2})[._-](\d{1,2})[._-](\d{2,4})/);
  if (m){
    const year = m[3].length===2 ? `20${m[3]}` : m[3];
    const month = m[1].padStart(2,'0');
    const day   = m[2].padStart(2,'0');
    const d = new Date(`${year}-${month}-${day}`);
    return isNaN(d) ? null : d;
  }

  // 7️⃣  M.D.YY (e.g. 2.2.26)
  m = clean.match(/(\d{1})\.(\d{1})\.(\d{2})/);
  if (m){
    const year = `20${m[3]}`;
    const d = new Date(`${year}-${m[1]}-${m[2]}`);
    return isNaN(d) ? null : d;
  }

  return null;
}

/* --------------------------------------------------------------
   🔟  Helper – build a **base title** from a PDF file name
         (remove date & trailing “for <WORD>”)
   -------------------------------------------------------------- */
function baseTitleFromFileName(fileName){
  if (!fileName) return '';
  const withoutDate = fileName.replace(
    /(\d{4}[-_]\d{2}[-_]\d{2})|(\d{8})|(\d{2}[-_]\d{2}[-_]\d{4})|(\d{2}\.\d{2}\.\d{2})|(\d{1,2}[._-]\d{1,2}[._-]\d{2,4})/g,
    ''
  );
  const withoutFor = withoutDate.replace(/\s*for\s+[A-Z]+$/i, '');
  return withoutFor.trim()
                  .replace(/[_\-\s]+$/,'')
                  .replace(/\s{2,}/g,' ');
}

/* --------------------------------------------------------------
   🔟🔟  Pick the “main” PDF for a record (updated)
   -------------------------------------------------------------- */
function pickMainPdf(pdfs, rec) {
  if (!pdfs.length) return null;

  const cleanPdfs = pdfs.filter(p => {
    const name = p.FileName || '';
    return name.toLowerCase().endsWith('.pdf') && !/program/i.test(name);
  });

  if (!cleanPdfs.length) return null;

  const prioritized = cleanPdfs.filter(p => {
    const fileName = p.FileName;
    return /\d{1,2}\.\d{1,2}\.\d{2}/.test(fileName);
  });

  if (prioritized.length) {
    return prioritized[0];
  }

  const dated = cleanPdfs.map(pdf => ({
    pdf,
    date: dateFromFileName(pdf.FileName)
  })).filter(o => o.date !== null);

  if (!dated.length){
    cleanPdfs.sort((a,b)=>new Date(b.Modified)-new Date(a.Modified));
    return cleanPdfs[0];
  }

  dated.sort((a,b)=>b.date-a.date);
  return dated[0].pdf;
}

/* -------------------------------------------------------------- 
   🔟🔟🔟  Render tiles for a given list (ONWCOD **or** OFFWCOD&WSD)
   -------------------------------------------------------------- */
async function renderTiles(containerId, listObj) {
  console.log(`Rendering tiles for ${listObj.friendly} list...`);

  /* ----- 1️⃣  Pull items **with** attachments in one request ----- */
  const query = `$select=${listObj.fieldsSelect},AttachmentFiles/FileName,AttachmentFiles/ServerRelativeUrl,AttachmentFiles/Modified` +
    `&$expand=AttachmentFiles&$top=5000`;
  const itemsUrl = `${listObj.url}?${query}`;

  console.log(`Fetching ${listObj.friendly} list items from ${itemsUrl}...`);

  const itemsResp = await getJSON(itemsUrl);
  const allItems = itemsResp.d.results;

  console.log(`Found ${allItems.length} items in ${listObj.friendly} list.`);

  if (!allItems.length) {
    console.log(`No items found in ${listObj.friendly} list.`);
    return;
  }

  /* ----- 2️⃣  Decide which PDF to keep for each item ----- */
  const itemPromises = allItems.map(async rec => {
    const attachments = (rec.AttachmentFiles && rec.AttachmentFiles.results) || [];

    const pdfs = attachments.filter(a => a.FileName && a.FileName.toLowerCase().endsWith('.pdf'));

    console.log(`Found ${pdfs.length} PDFs for item ${rec.ID}.`);

    const chosen = pickMainPdf(pdfs, rec);
    if (!chosen) {
      console.log(`No PDF found for item ${rec.ID}.`);
      return null;
    }

    const pdfUrl = makeAbsoluteUrl(siteBase, chosen.ServerRelativeUrl);
    const pdfName = chosen.FileName;

    const dateFromName = dateFromFileName(pdfName);
    const pdfMod = dateFromName ? dateFromName.toISOString() : chosen.Modified;

    return { rec, pdfUrl, pdfName, pdfMod };
  });

  const recordsWithPdf = (await Promise.all(itemPromises)).filter(Boolean);

  console.log(`Found ${recordsWithPdf.length} items with PDFs in ${listObj.friendly} list.`);

  /* ----- 3️⃣  Keep only items whose LOR is ≤ 90 days old ----- */
  const today = new Date();
  const filtered = recordsWithPdf.filter(item => {
    const lorValid = new Date(item.rec.lorValidityDate);
    const diff = Math.floor((today - lorValid) / (1000 * 60 * 60 * 24));
    return diff <= 90;
  });

  console.log(`Found ${filtered.length} items with LOR ≤ 90 days old in ${listObj.friendly} list.`);

  /* ----- 4️⃣  Group by Provider | Service | base‑title, keep newest PDF ----- */
  const freshest = new Map(); // key = "provider|service|baseTitle"
  filtered.forEach(item => {
    const provider = (item.rec.Service_x0020_Provider?.trim()) || 'Unknown';

    const serviceRaw = Array.isArray(item.rec.Service_x0020_Type?.results)
      ? item.rec.Service_x0020_Type.results[0]
      : item.rec.Service_x0020_Type;
    const service = (serviceRaw?.trim()) || 'Unknown';

    const baseTitle = baseTitleFromFileName(item.pdfName);
    const key = `${provider}|${service}|${baseTitle || item.pdfName}`;

    const existing = freshest.get(key);
    if (!existing || new Date(item.pdfMod) > new Date(existing.pdfMod)) {
      freshest.set(key, item);
    }
  });

  const finalRecords = Array.from(freshest.values());

  console.log(`Found ${finalRecords.length} final records in ${listObj.friendly} list.`);

  /* ----- 5️⃣  Sort by Provider → Service → newest PDF ----- */
  const sorted = finalRecords.sort((a, b) => {
    const provA = a.rec.Service_x0020_Provider?.trim() || 'Unknown';
    const provB = b.rec.Service_x0020_Provider?.trim() || 'Unknown';
    if (provA !== provB) return provA.localeCompare(provB);

    const svcRawA = Array.isArray(a.rec.Service_x0020_Type?.results)
      ? a.rec.Service_x0020_Type.results[0]
      : a.rec.Service_x0020_Type;
    const svcRawB = Array.isArray(b.rec.Service_x0020_Type?.results)
      ? b.rec.Service_x0020_Type.results[0]
      : b.rec.Service_x0020_Type;
    const svcA = svcRawA?.trim() || 'Unknown';
    const svcB = svcRawB?.trim() || 'Unknown';
    if (svcA !== svcB) return svcA.localeCompare(svcB);

    return new Date(b.pdfMod) - new Date(a.pdfMod);
  });

  console.log(`Sorted ${sorted.length} records in ${listObj.friendly} list.`);

  /* ----- 6️⃣  Render the tiles ----- */
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (listObj.friendly === 'OFFWCOD&WSD') {
    const destinations = [...new Set(sorted.map(item => {
      let destination = '';
      if (Array.isArray(item.rec.Destination?.results)) {
        destination = item.rec.Destination.results.join(', ');
      } else if (item.rec.Destination) {
        destination = item.rec.Destination;
      }
      return destination;
    }))];
    destinations.sort();

    destinations.forEach(destination => {
      const destRecords = sorted.filter(item => {
        let dest = '';
        if (Array.isArray(item.rec.Destination?.results)) {
          dest = item.rec.Destination.results.join(', ');
        } else if (item.rec.Destination) {
          dest = item.rec.Destination;
        }
        return dest === destination;
      });
      const destContainer = document.createElement('div');
      destContainer.className = 'destination-group';
      destContainer.innerHTML = `<h3>${destination}</h3>`;

      const destGrid = document.createElement('div');
      destGrid.className = 'location-grid';
      destContainer.appendChild(destGrid);

      destRecords.forEach(({ rec, pdfUrl, pdfName }) => {
        const provider = rec.Service_x0020_Provider?.trim() || 'Unknown';

        const serviceRaw = Array.isArray(rec.Service_x0020_Type?.results)
          ? rec.Service_x0020_Type.results[0]
          : rec.Service_x0020_Type;
        const service = serviceRaw?.trim() || 'Unknown';

        let destinationText = '';
        if (Array.isArray(rec.Destination?.results)) {
          destinationText = rec.Destination.results.join(', ');
        } else if (rec.Destination) {
          destinationText = rec.Destination;
        }

        const lorValidDate = new Date(rec.lorValidityDate);
        const lorValidFmt = `${lorValidDate.getMonth() + 1}/${lorValidDate.getDate()}/${lorValidDate.getFullYear()}`;

        const issueRaw = rec.lorIssueDate;
        const issueFmt = issueRaw
          ? `${new Date(issueRaw).getMonth() + 1}/${new Date(issueRaw).getDate()}/${new Date(issueRaw).getFullYear()}`
          : '‑';

        // background colour based on expiry
        let bgClass = 'normal';
        const diffDays = Math.floor((lorValidDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) bgClass = 'expired';
        else if (diffDays <= 14) bgClass = 'warning';

        const tile = document.createElement('div');
        tile.className = `location-tile ${bgClass}`;
        tile.innerHTML = `
          <div class="provider"><strong>Provider:</strong> ${provider}</div>
          <div class="service"><strong>Service:</strong> ${service}</div>
          <div class="destination"><strong>Destination:</strong> ${destinationText}</div>
          <div class="lor"><strong>LOR Valid‑to:</strong> ${lorValidFmt}</div>
          <div class="lor-issue"><strong>LOR Issue‑date:</strong> ${issueFmt}</div>
          <div class="request-id"><strong>Request ID:</strong> ${rec.ID}</div>
          <div class="pdf-link"><a href="${pdfUrl}" target="_blank" rel="noopener">${pdfName}</a></div>
        `;
        destGrid.appendChild(tile);
      });

      container.appendChild(destContainer);
    });
  } else {
    sorted.forEach(({ rec, pdfUrl, pdfName }) => {
      const provider = rec.Service_x0020_Provider?.trim() || 'Unknown';

      const serviceRaw = Array.isArray(rec.Service_x0020_Type?.results)
        ? rec.Service_x0020_Type.results[0]
        : rec.Service_x0020_Type;
      const service = serviceRaw?.trim() || 'Unknown';

      const lorValidDate = new Date(rec.lorValidityDate);
      const lorValidFmt = `${lorValidDate.getMonth() + 1}/${lorValidDate.getDate()}/${lorValidDate.getFullYear()}`;

      const issueRaw = rec.lorIssueDate;
      const issueFmt = issueRaw
        ? `${new Date(issueRaw).getMonth() + 1}/${new Date(issueRaw).getDate()}/${new Date(issueRaw).getFullYear()}`
        : '‑';

      // background colour based on expiry
      let bgClass = 'normal';
      const diffDays = Math.floor((lorValidDate - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) bgClass = 'expired';
      else if (diffDays <= 14) bgClass = 'warning';

      const tile = document.createElement('div');
      tile.className = `location-tile ${bgClass}`;
      tile.innerHTML = `
        <div class="provider"><strong>Provider:</strong> ${provider}</div>
        <div class="service"><strong>Service:</strong> ${service}</div>
        <div class="lor"><strong>LOR Valid‑to:</strong> ${lorValidFmt}</div>
        <div class="lor-issue"><strong>LOR Issue‑date:</strong> ${issueFmt}</div>
        <div class="request-id"><strong>Request ID:</strong> ${rec.ID}</div>
        <div class="pdf-link"><a href="${pdfUrl}" target="_blank" rel="noopener">${pdfName}</a></div>
      `;
      container.appendChild(tile);
    });
  }

  console.log(`Rendered ${sorted.length} tiles in ${listObj.friendly} list.`);
}

/* --------------------------------------------------------------
   11️⃣  Main – load data, compute KPIs, render UI
   -------------------------------------------------------------- */
(async () => {
  try{
    /* ---- Pull all lists in parallel ---- */
    const rawLists = await Promise.all(listConfig.map(c=>fetchAll(c.url)));

    /* ---- Flatten while preserving list name ---- */
    const allRecords = [];
    rawLists.forEach((items,idx)=>{
      const friendly = listConfig[idx].friendly;
      items.forEach(rec => allRecords.push({record:rec, listName:friendly}));
    });

    /* ---- Sort newest → oldest ---- */
    allRecords.sort((a,b)=>new Date(b.record.Modified)-new Date(a.record.Modified));

    /* ---- Bucket into Active / Completed ---- */
    const active    = allRecords.filter(r=>!r.record.Status?.toLowerCase().includes('completed'));
    const completed = allRecords.filter(r=> r.record.Status?.toLowerCase().includes('completed'));

  /* ---- KPI calculations ---- */
  /* ---- KPI calculations ---- */
  const totalReq = active.length + completed.length;
  const activeONWCOD = allRecords.filter(r => r.listName === 'ONWCOD' && !r.record.Status?.toLowerCase().includes('completed'));
  const completedONWCOD = allRecords.filter(r => r.listName === 'ONWCOD' && r.record.Status?.toLowerCase().includes('completed'));
  const activeOFFWCODWSD = allRecords.filter(r => r.listName === 'OFFWCOD&WSD' && !r.record.Status?.toLowerCase().includes('completed'));
  const completedOFFWCODWSD = allRecords.filter(r => r.listName === 'OFFWCOD&WSD' && r.record.Status?.toLowerCase().includes('completed'));

  console.log(`Calculating average days to close for ONWCOD...`);
  console.log(`  Total completed ONWCOD requests: ${completedONWCOD.length}`);

  const avgDaysONWCOD = completedONWCOD.reduce((sum, r) => {
    const created  = new Date(r.record.Created);
    const lorIssueDate = new Date(r.record.lorIssueDate);
    if (lorIssueDate < created) {
      console.log(`  Warning: LOR Issue Date is earlier than Created date for request ${r.record.ID}. Skipping this record.`);
      return sum;
    }
    const diff = diffInDays(lorIssueDate, created);
    console.log(`  Request ${r.record.ID}: Diff ${diff} days`);
    return sum + diff;
  }, 0);

  const validCompletedONWCOD = completedONWCOD.filter(r => {
    const created  = new Date(r.record.Created);
    const lorIssueDate = new Date(r.record.lorIssueDate);
    return lorIssueDate >= created;
  });

  const avgCloseONWCOD = validCompletedONWCOD.length ? (avgDaysONWCOD / validCompletedONWCOD.length).toFixed(1) : 0;
  console.log(`  Average days to close for ONWCOD: ${avgCloseONWCOD}`);

  console.log(`Calculating average days to close for OFFWCOD&WSD...`);
  console.log(`  Total completed OFFWCOD&WSD requests: ${completedOFFWCODWSD.length}`);

  const avgDaysOFFWCODWSD = completedOFFWCODWSD.reduce((sum, r) => {
    const created  = new Date(r.record.Created);
    const lorIssueDate = new Date(r.record.lorIssueDate);
    if (lorIssueDate < created) {
      console.log(`  Warning: LOR Issue Date is earlier than Created date for request ${r.record.ID}. Skipping this record.`);
      return sum;
    }
    const diff = diffInDays(lorIssueDate, created);
    console.log(`  Request ${r.record.ID}: Diff ${diff} days`);
    return sum + diff;
  }, 0);

  const validCompletedOFFWCODWSD = completedOFFWCODWSD.filter(r => {
    const created  = new Date(r.record.Created);
    const lorIssueDate = new Date(r.record.lorIssueDate);
    return lorIssueDate >= created;
  });

  const avgCloseOFFWCODWSD = validCompletedOFFWCODWSD.length ? (avgDaysOFFWCODWSD / validCompletedOFFWCODWSD.length).toFixed(1) : 0;
  console.log(`  Average days to close for OFFWCOD&WSD: ${avgCloseOFFWCODWSD}`);

  /* ---- Populate KPI cards ---- */
  document.getElementById('total-req').textContent = totalReq;
  document.getElementById('active-req').textContent = active.length;
  document.getElementById('completed-req').textContent = completed.length;

  // Remove the existing avg-days element
  const avgDaysElement = document.getElementById('avg-days');
  if (avgDaysElement) {
    avgDaysElement.parentNode.removeChild(avgDaysElement);
  }

  // Create new elements for ONWCOD and OFFWCOD&WSD
  const kpiGrid = document.querySelector('.kpi-grid');
  const onwcodAvgDaysElement = document.createElement('div');
  onwcodAvgDaysElement.className = 'kpi-card';
  onwcodAvgDaysElement.innerHTML = `
    <div class="icon">⏱️</div>
    <div class="value" id="avg-days-onwcod">${avgCloseONWCOD}</div>
    <div class="label">Avg. Days to Complete ONWCOD Requests</div>
  `;
  kpiGrid.appendChild(onwcodAvgDaysElement);

  const offwcodwsdAvgDaysElement = document.createElement('div');
  offwcodwsdAvgDaysElement.className = 'kpi-card';
  offwcodwsdAvgDaysElement.innerHTML = `
    <div class="icon">⏱️</div>
    <div class="value" id="avg-days-offwcodwsd">${avgCloseOFFWCODWSD}</div>
    <div class="label">Avg. Days to Complete OFFWCOD&WSD Requests</div>
  `;
  kpiGrid.appendChild(offwcodwsdAvgDaysElement);

  /* ---- Side‑menu tiles (counts per list) ---- */
  const menu = document.getElementById('menu');
  const menuHTML = listConfig.map(cfg=>`
    <div class="tile" data-name="${cfg.friendly}">
      <h3>${cfg.friendly}</h3>
      <p>${allRecords.filter(r=>r.listName===cfg.friendly).length}</p>
    </div>
  `).join('');
  menu.innerHTML = menuHTML;   // .table class already on #menu

  /* ---- Render ONWCOD tiles ---- */
  await renderTiles('onwcod-grid', listConfig.find(c=>c.friendly==='ONWCOD'));

  /* ---- Render OFFWCOD&WSD (Barge) tiles ---- */
  await renderTiles('barges-grid', listConfig.find(c=>c.friendly==='OFFWCOD&WSD'));

  /* ---- Hide spinner if everything succeeded ---- */
  document.getElementById('spinner').style.display = 'none';
  }catch(err){
    console.error('Dashboard error →',err);
    const sp = document.getElementById('spinner');
    sp.textContent = '❌ Unable to load data – see console for details.';
  }
})();