/* --------------------------------------------------------------
   export‑tables‑v2.js
   One‑click “Export to Excel” – works for every <table id="…">
   on the page, even when the tables live inside hidden tabs,
   use Ajax, paging, or DataTables deferred rendering.
   Includes an optional “export only the active tab” mode.
   -------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  /* -----------------------------------------------------------------
     0️⃣ CONFIGURATION
     ----------------------------------------------------------------- */
  // Set to true if you want to export **only** the table that belongs to
  // the currently visible tab.  Set to false to export every table.
  const EXPORT_ONLY_ACTIVE_TAB = true;   // <-- change here

  // If you prefer a UI toggle instead of editing the constant, uncomment
  // the block at the end of the file (creates a second button).

  // -----------------------------------------------------------------
  // 1️⃣ Grab the main export button
  // -----------------------------------------------------------------
  const exportBtn = document.getElementById('export-all-btn');
  if (!exportBtn) {
    console.warn('❗ Export button (id="export-all-btn") not found.');
    return;
  }

  // -----------------------------------------------------------------
  // 2️⃣ UI helper – spinner / disabled state while we work
  // -----------------------------------------------------------------
  const setLoading = (on) => {
    exportBtn.disabled = on;
    exportBtn.textContent = on ? '⏳ Exporting…' : '📥 Export to Excel';
    exportBtn.classList.toggle('loading', on);
  };

  // -----------------------------------------------------------------
  // 3️⃣ Helper – clean a single <td> cell (plain text only)
  // -----------------------------------------------------------------
  const cleanCell = (td) => {
    let txt = td.textContent || '';

    const link = td.querySelector('a[data-record]');
    if (link) {
      try {
        const decoded = decodeURIComponent(link.dataset.record);
        const obj = JSON.parse(decoded);
        txt = obj.Title || obj.title || txt;
      } catch (_) { /* keep original txt */ }
    }

    return txt.replace(/\s+/g, ' ').trim();
  };

  // -----------------------------------------------------------------
  // 4️⃣ Ensure a DataTable has *all* its data ready.
  //    Returns a promise that resolves when the table can be read.
  // -----------------------------------------------------------------
  const ensureDataTableReady = (table) => {
    // No DataTables on this element → nothing to do.
    if (!$.fn.DataTable || !$.fn.DataTable.isDataTable(table)) {
      return Promise.resolve();
    }

    const $tbl = $(table);
    const api = $tbl.DataTable();

    // ---------------------------------------------------------------
    // 4a) Ajax / server‑side tables – force a reload and wait for XHR.
    // ---------------------------------------------------------------
    const ajaxOption = api.settings()[0].ajax;
    const usesAjax = typeof ajaxOption === 'function' ||
                     typeof ajaxOption === 'string' ||
                     !!ajaxOption?.url;

    if (usesAjax) {
      return new Promise((resolve) => {
        // Resolve when the Ajax response arrives.
        api.one('xhr', () => resolve());

        // Trigger a reload (keep current page, do not reset paging).
        api.ajax.reload(null, false);

        // Safety timeout – if the server never answers we still continue.
        setTimeout(() => {
          console.warn('⚠️ DataTables Ajax timeout – exporting whatever we have.');
          resolve();
        }, 15000); // 15 s
      });
    }

    // ---------------------------------------------------------------
    // 4b) Table is client‑side but hidden (display:none).  DataTables
    //     needs the element to be visible at least once to calculate
    //     column widths.  We temporarily reveal it off‑screen.
    // ---------------------------------------------------------------
    if (window.getComputedStyle(table).display === 'none') {
      const originalStyle = table.getAttribute('style') || '';
      table.style.cssText = `${originalStyle};position:absolute;visibility:hidden;display:block;`;
      // Force DataTables to recalc its internal caches.
      api.columns.adjust().draw();

      // Restore the original style on the next animation frame.
      return new Promise((resolve) => {
        requestAnimationFrame(() => {
          table.setAttribute('style', originalStyle);
          resolve();
        });
      });
    }

    // Table is already ready.
    return Promise.resolve();
  };

  // -----------------------------------------------------------------
  // 5️⃣ Turn a <table> (plain HTML or DataTable) into an ExcelJS sheet
  // -----------------------------------------------------------------
// -----------------------------------------------------------------
// 5️⃣ Turn a <table> (plain HTML or DataTable) into an ExcelJS sheet
// -----------------------------------------------------------------
const tableToWorksheet = (table, ws) => {
  // ----- Header ----------------------------------------------------
  const headerEls = table.querySelectorAll('thead th');
  const headers = Array.from(headerEls).map(th => cleanCell(th));
  ws.addRow(headers);

  // ----- Body ------------------------------------------------------
  const $tbl = $(table);
  const isDataTable = $.fn.DataTable && $.fn.DataTable.isDataTable(table);

  if (isDataTable) {
    // Use the real DOM rows that DataTables has rendered.
    const api = $tbl.DataTable();

    // Get rows that survive the current search filter.
    const rowNodes = api.rows({ search: 'applied' }).nodes().toArray();

    rowNodes.forEach(tr => {
      const cells = tr.querySelectorAll('td');
      const values = Array.from(cells).map(td => cleanCell(td));
      ws.addRow(values);
    });
  } else {
    // Plain HTML table – read each <td> cell.
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(tr => {
      const cells = tr.querySelectorAll('td');
      const values = Array.from(cells).map(td => cleanCell(td));
      ws.addRow(values);
    });
  }

  // ----- Auto‑size columns (nice to have) -------------------------
  headers.forEach((_, i) => {
    const col = ws.getColumn(i + 1);
    let maxLen = headers[i].length;
    col.eachCell({ includeEmpty: true }, cell => {
      const txt = cell.value ? cell.value.toString() : '';
      if (txt.length > maxLen) maxLen = txt.length;
    });
    col.width = Math.max(maxLen * 1.2, 10);
  });
};

// -----------------------------------------------------------------
// 6️⃣ Core export – builds a workbook and triggers the download
// -----------------------------------------------------------------
const exportAllTables = async () => {
  /* -------------------------------------------------------------
     6a) Find every table that has an id attribute.
     ------------------------------------------------------------- */
  const tables = Array.from(document.querySelectorAll('table[id]'));

  if (!tables.length) {
    alert('❌ No tables with an id attribute were found on this page.');
    return;
  }

  // -------------------------------------------------------------
  // Remember which tables are currently visible so we can restore
  // them after the export finishes.
  // -------------------------------------------------------------
  const visibilityMap = new Map(); // table → original display style
  tables.forEach(tbl => {
    visibilityMap.set(tbl, tbl.style.display || '');
  });

  // -------------------------------------------------------------
  // 6b) Build a workbook – one sheet per table.
  // -------------------------------------------------------------
  const workbook = new ExcelJS.Workbook();

  // Walk through the tables **sequentially** – we need to wait for each
  // hidden table (and its DataTable, if any) to become ready before we
  // move on to the next one.
  for (const table of tables) {
    // ---------------------------------------------------------
    // Make the table visible (if it was hidden) so DataTables can
    // calculate widths / finish Ajax.
    // ---------------------------------------------------------
    if (window.getComputedStyle(table).display === 'none') {
      // Show it off‑screen – we don’t want a flash for the user.
      table.style.position = 'absolute';
      table.style.visibility = 'hidden';
      table.style.display = 'block';
    }

    // ---------------------------------------------------------
    // Wait for any DataTable inside this table to be ready.
    // ---------------------------------------------------------
    await ensureDataTableReady(table);

    // ---------------------------------------------------------
    // Add a worksheet for this table.
    // ---------------------------------------------------------
    const sheetName = (table.id || `Sheet${workbook.worksheets.length + 1}`).substring(0, 31);
    const ws = workbook.addWorksheet(sheetName);
    tableToWorksheet(table, ws);
  }

  // -------------------------------------------------------------
  // 6c) Restore the original visibility of every table.
  // -------------------------------------------------------------
  tables.forEach(tbl => {
    const original = visibilityMap.get(tbl);
    tbl.style.display = original;
    tbl.style.position = '';
    tbl.style.visibility = '';
  });

  // -------------------------------------------------------------
  // 6d) Write the workbook to a Blob and trigger the download.
  // -------------------------------------------------------------
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const now = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19); // e.g. 2026-02-11T08-10-02
  const fileName = `Export_${now}.xlsx`;

  saveAs(blob, fileName);
};

  // -----------------------------------------------------------------
  // 7️⃣ Click handler – disable UI, run export, re‑enable UI
  // -----------------------------------------------------------------
  exportBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await exportAllTables();
    } catch (err) {
      console.error('❌ Export failed', err);
      alert('Something went wrong while exporting. Check the console for details.');
    } finally {
      setLoading(false);
    }
  });

  /* -----------------------------------------------------------------
     OPTIONAL UI – a second button that toggles the “active‑tab only”
     mode at runtime (instead of editing the constant above).
     ----------------------------------------------------------------- */
  // Uncomment the block below if you want a toggle button next to the
  // main export button.  It will automatically flip the mode and update
  // its own label.

  /*
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'export-active-tab-btn';
  toggleBtn.style.marginLeft = '0.5rem';
  toggleBtn.textContent = EXPORT_ONLY_ACTIVE_TAB
    ? 'Export All Tabs'
    : 'Export Active Tab Only';
  exportBtn.parentNode.insertBefore(toggleBtn, exportBtn.nextSibling);

  toggleBtn.addEventListener('click', () => {
    // Flip the flag
    window.EXPORT_ONLY_ACTIVE_TAB = !window.EXPORT_ONLY_ACTIVE_TAB;
    // Update button label
    toggleBtn.textContent = window.EXPORT_ONLY_ACTIVE_TAB
      ? 'Export All Tabs'
      : 'Export Active Tab Only';
    // Optionally give visual feedback
    alert(
      window.EXPORT_ONLY_ACTIVE_TAB
        ? 'Now exporting only the active tab.'
        : 'Now exporting all tables.'
    );
  });
  */

});