/**
 * excelViewer.js
 * ---------------------------------------------------------------
 * 1️⃣  Injects a Bootstrap‑5 modal that will host the preview.
 * 2️⃣  Provides three preview helpers:
 *      • SharePoint embed (private, uses current auth cookies)
 *      • Public Office‑Online embed (needs a public HTTPS URL)
 *      • SheetJS preview (pure‑JS HTML table)
 * 3️⃣  Listens for clicks on any element that has:
 *        class   = "excel-preview-btn"
 *        data-xlsx = absolute URL of the .xlsx file
 *      The user can pick the preview mode from a small dropdown that
 *      appears in the modal header.
 * ---------------------------------------------------------------
 * Dependencies:
 *   • Bootstrap 5 (already on your page)
 *   • OPTIONAL: SheetJS – the script will load it lazily the first
 *                time the user selects “SheetJS”.
 * ---------------------------------------------------------------
 */

(() => {
  // -----------------------------------------------------------------
  // 0️⃣  Tiny helper to load an external script only once (used for SheetJS)
  // -----------------------------------------------------------------
  const loadScriptOnce = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        // already present – resolve immediately
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  };

  // -----------------------------------------------------------------
  // 1️⃣  Insert the modal markup (once) – runs as soon as the script loads.
  // -----------------------------------------------------------------
  const modalHTML = `
    <!-- Excel‑viewer modal (injected by excelViewer.js) -->
    <div class="modal fade" id="excelModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header d-flex align-items-center">
            <h5 class="modal-title mb-0 me-3">Spreadsheet preview</h5>

            <!-- ---------- Mode selector ---------- -->
            <div class="dropdown me-2">
              <button class="btn btn-sm btn-outline-secondary dropdown-toggle"
                      type="button"
                      id="previewModeBtn"
                      data-bs-toggle="dropdown"
                      aria-expanded="false">
                Mode: SharePoint
              </button>
              <ul class="dropdown-menu" aria-labelledby="previewModeBtn">
                <li><a class="dropdown-item preview-mode-item" href="#" data-mode="sharepoint">SharePoint embed</a></li>
                <li><a class="dropdown-item preview-mode-item" href="#" data-mode="public">Public Office‑Online</a></li>
                <li><a class="dropdown-item preview-mode-item" href="#" data-mode="sheetjs">SheetJS (HTML table)</a></li>
              </ul>
            </div>

            <!-- ---------- Full‑screen link (only for iframe modes) ---------- -->
            <a id="excelFullScreen" href="#" target="_blank"
               class="btn btn-sm btn-outline-secondary me-2 d-none"
               title="Open in a new tab">↗ Open in new tab</a>

            <button type="button" class="btn-close"
                    data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <div class="modal-body p-0" style="height:80vh;">
            <!-- The iframe is used for the two Office‑Online modes -->
            <iframe id="excelIframe"
                    src=""
                    frameborder="0"
                    style="width:100%;height:100%;display:none;"></iframe>

            <!-- The div below will hold the SheetJS‑generated HTML -->
            <div id="sheetjsContainer"
                 style="width:100%;height:100%;overflow:auto;display:none;"></div>
          </div>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // -----------------------------------------------------------------
  // 2️⃣  URL‑builder helpers
  // -----------------------------------------------------------------
  /**
   * Public Office‑Online embed (requires a publicly reachable HTTPS URL).
   */
  function officeOnlineUrl(fileUrl) {
    const encoded = encodeURIComponent(fileUrl);
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`;
  }

  /**
   * SharePoint native embed (keeps the file private – works for files in the
   * same tenant/site collection as the dashboard).
   */
  function sharepointEmbedUrl(fileUrl) {
    const base = fileUrl.split('?')[0];
    return `${base}?web=1&action=embedview`;
  }

  // -----------------------------------------------------------------
  // 3️⃣  SheetJS preview – loads the library on‑demand and renders HTML.
  // -----------------------------------------------------------------
  async function previewWithSheetJS(url) {
    // Load SheetJS from CDN if it hasn't been loaded yet.
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');

    // Fetch the workbook as an ArrayBuffer.
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
    const arrayBuffer = await resp.arrayBuffer();

    // Parse the workbook.
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // For simplicity we render the *first* sheet only.
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];

    // Convert to an HTML table.
    const html = XLSX.utils.sheet_to_html(firstSheet, {
      // You can tweak these options if you want a different look.
      id: 'sheetjs-table',
      editable: false,
      // hide the sheet name header
      header: '',
    });

    // Put the HTML into the container.
    const container = document.getElementById('sheetjsContainer');
    container.innerHTML = html;
  }

  // -----------------------------------------------------------------
  // 4️⃣  Modal handling – keep a single instance.
  // -----------------------------------------------------------------
  const excelModal = new bootstrap.Modal(document.getElementById('excelModal'));

  const iframe = document.getElementById('excelIframe');
  const sheetjsContainer = document.getElementById('sheetjsContainer');
  const fullScreenLink = document.getElementById('excelFullScreen');
  const modeBtn = document.getElementById('previewModeBtn');

  // Default preview mode (can be changed by the user via the dropdown)
  let currentMode = 'sharepoint'; // values: 'sharepoint' | 'public' | 'sheetjs'

  // -----------------------------------------------------------------
  // 5️⃣  Mode selector UI – updates button text & remembers the choice.
  // -----------------------------------------------------------------
  document.querySelectorAll('.preview-mode-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const mode = e.currentTarget.dataset.mode;
      if (!mode) return;
      currentMode = mode;
      modeBtn.textContent = `Mode: ${{
        sharepoint: 'SharePoint',
        public: 'Public Office‑Online',
        sheetjs: 'SheetJS (HTML)'
      }[mode]}`;
    });
  });

  // -----------------------------------------------------------------
  // 6️⃣  Click delegation – any element with class `excel-preview-btn`
  //     and a `data-xlsx` attribute will trigger the preview.
  // -----------------------------------------------------------------
  const PREVIEW_CLASS = 'excel-preview-btn';

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest(`.${PREVIEW_CLASS}`);
    if (!btn) return; // not a preview button

    const fileUrl = btn.dataset.xlsx;
    if (!fileUrl) {
      console.warn('excelViewer.js → data-xlsx attribute missing on', btn);
      return;
    }

    // Reset UI state
    iframe.style.display = 'none';
    sheetjsContainer.style.display = 'none';
    fullScreenLink.classList.add('d-none');

    try {
      if (currentMode === 'sharepoint') {
        const embedSrc = sharepointEmbedUrl(fileUrl);
        iframe.src = embedSrc;
        iframe.style.display = 'block';
        fullScreenLink.href = embedSrc;
        fullScreenLink.classList.remove('d-none');
      } else if (currentMode === 'public') {
        const embedSrc = officeOnlineUrl(fileUrl);
        iframe.src = embedSrc;
        iframe.style.display = 'block';
        fullScreenLink.href = embedSrc;
        fullScreenLink.classList.remove('d-none');
      } else if (currentMode === 'sheetjs') {
        // Clear any previous HTML, then render the new workbook.
        sheetjsContainer.innerHTML = '<p class="p-3">Loading…</p>';
        sheetjsContainer.style.display = 'block';
        await previewWithSheetJS(fileUrl);
        // No full‑screen link for SheetJS (it’s already in‑page)
      }

      // Finally, show the modal.
      excelModal.show();
    } catch (err) {
      console.error('excelViewer.js → preview error:', err);
      alert('Sorry, something went wrong while loading the preview. Check the console for details.');
    }
  });

  // -----------------------------------------------------------------
  // 7️⃣  Expose a tiny API on `window.ExcelViewer` (optional, for debugging)
  // -----------------------------------------------------------------
  window.ExcelViewer = {
    officeOnlineUrl,
    sharepointEmbedUrl,
    previewWithSheetJS,
    /**
     * Manually open a file with a specific mode.
     * @param {string} fileUrl  – absolute URL of the .xlsx file
     * @param {'sharepoint'|'public'|'sheetjs'} mode
     */
    show: async (fileUrl, mode = 'sharepoint') => {
      currentMode = mode;
      modeBtn.textContent = `Mode: ${{
        sharepoint: 'SharePoint',
        public: 'Public Office‑Online',
        sheetjs: 'SheetJS (HTML)'
      }[mode]}`;

      // Simulate a click – reuse the same logic above.
      const fakeBtn = { dataset: { xlsx: fileUrl } };
      const event = new Event('click');
      document.dispatchEvent(Object.assign(event, { target: fakeBtn }));
    }
  };
})();