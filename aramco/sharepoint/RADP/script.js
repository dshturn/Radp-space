/* ==============================================================
   script.js – core UI logic for the RADP portal
   ============================================================== */

/* ------------------------------------------------------------------
   1️⃣  Tab handling – sliding animation
   ------------------------------------------------------------------ */
let currentIdx = 0;               // index of the currently visible panel
let tabButtons = [];              // <button class="tab-button" …>
let tabPanels  = [];              // <section class="tab-content" …>

/* --------------------------------------------------------------
   Initialise the tab system
   -------------------------------------------------------------- */
function initTabs() {
  tabButtons = Array.from(document.querySelectorAll('.tab-button[data-tab]'));
  tabPanels  = Array.from(document.querySelectorAll('.tab-content'));

  // first panel & button are active on load
  tabPanels.forEach((p, i) => p.classList.toggle('active', i === 0));
  tabButtons.forEach((b, i) => {
    b.classList.toggle('active', i === 0);
    b.setAttribute('aria-selected', i === 0);
    b.setAttribute('aria-controls', tabPanels[i].id);
  });
}

/* --------------------------------------------------------------
   Switch to a different tab
   -------------------------------------------------------------- */
function switchTab(ev, targetIdx) {
  if (targetIdx === currentIdx) return;               // nothing to do

  const curPanel = tabPanels[currentIdx];
  const newPanel = tabPanels[targetIdx];

  // 1️⃣ clean any old state
  curPanel.classList.remove('active', 'prev', 'next');
  newPanel.classList.remove('active', 'prev', 'next');

  // 2️⃣ decide direction
  const forward = targetIdx > currentIdx;

  // 3️⃣ move the *old* panel out of view
  if (forward) {
    curPanel.classList.add('prev');   // slide left
  } else {
    curPanel.classList.add('next');   // slide right
  }

  // 4️⃣ bring the *new* panel in
  newPanel.classList.add('active');   // translateX(0)

  // 5️⃣ update button states (ARIA + visual)
  tabButtons[currentIdx].classList.remove('active');
  tabButtons[currentIdx].setAttribute('aria-selected', 'false');

  tabButtons[targetIdx].classList.add('active');
  tabButtons[targetIdx].setAttribute('aria-selected', 'true');

  // 6️⃣ store the new index
  currentIdx = targetIdx;
}

/* --------------------------------------------------------------
   Wire the buttons – they carry a data‑tab attribute that matches
   the id of the panel they should show.
   -------------------------------------------------------------- */
function bindTabClicks() {
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const targetId = btn.getAttribute('data-tab');
      const targetIdx = tabPanels.findIndex(p => p.id === targetId);
      if (targetIdx !== -1) switchTab(e, targetIdx);
    });
  });
}

/* ------------------------------------------------------------------
   2️⃣ Request‑count – fetch the three SharePoint‑like lists
   ------------------------------------------------------------------ */
async function getActiveRequestsCount() {
  const urls = [
    'https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle(\'ONWCOD Assessment Requests\')/items',
    'https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle(\'OFFWCOD&WSD Assessment Requests\')/items',
    'https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle(\'ONWSD Assessment Requests\')/items',
    'https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle(\'SAOWCOD\')/items',
    'https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle(\'SAGWCOD\')/items'
  ];

  try {
    const allItems = [];

    for (const url of urls) {
      console.log(`Fetching items from ${url}...`);
      let currentPageUrl = `${url}?$top=100`;
      let hasNextPage = true;
      let itemCount = 0;

      while (hasNextPage) {
        const response = await fetch(currentPageUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json; odata=verbose' }
        });

        if (!response.ok) {
          console.error(`Error fetching ${url}: ${response.status}`);
          break;
        }

        const jsonData = await response.json();
        const items = jsonData.d?.results ?? jsonData.d?.value ?? jsonData.d ?? [];

        console.log(`Fetched ${items.length} items from ${url}...`);
        itemCount += items.length;

        allItems.push(...items);

        const nextPageUrl = jsonData.d.__next;
        if (nextPageUrl) {
          currentPageUrl = nextPageUrl;
        } else {
          hasNextPage = false;
        }
      }

      console.log(`Fetched a total of ${itemCount} items from ${url}.`);
    }

    console.log(`Fetched a total of ${allItems.length} items from all lists.`);

    // newest first (by Modified date)
    allItems.sort((a, b) => {
      if (!a.Modified || !b.Modified) return 0;
      return new Date(b.Modified) - new Date(a.Modified);
    });

    console.log(`Sorted ${allItems.length} items by Modified date.`);

    const badge = document.getElementById('request-count');
    if (badge) {
      console.log(`Updating request count badge with value ${allItems.length}...`);
      badge.textContent = allItems.length;
    }
  } catch (err) {
    console.error('❌  Error while calculating request‑count:', err);
  }
}

/* ------------------------------------------------------------------
   3️⃣ Current user – fetch the logged‑in user from SharePoint
   ------------------------------------------------------------------ */
async function getCurrentUser() {
  const baseUrl = 'https://sharek.aramco.com.sa';
  try {
    const resp = await fetch(`${baseUrl}/_api/web/currentuser`, {
      method: 'GET',
      headers: { 'Accept': 'application/json; odata=verbose' }
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const json = await resp.json();
    const user = json?.d ?? {};

    return {
      id: user.Id,
      title: user.Title,
      email: user.Email
    };
  } catch (err) {
    console.error('❌  Error getting current user:', err);
    return null;
  }
}

/* ------------------------------------------------------------------
   4️⃣ Initialise everything once the DOM is ready
   ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();          // cache buttons & panels, set first active
  bindTabClicks();     // attach click listeners
  getActiveRequestsCount();   // update the badge
  const user = await getCurrentUser();
  if (user?.title) {
    document.getElementById('username').textContent = user.title;
  }
});