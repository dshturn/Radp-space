# RADP Phase 1–2: Foundation Fixes & Performance

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden error handling, add file upload validation, fix silent failures, and add pagination + debounced search across all list views.

**Architecture:** All utilities go into `js/shared.js`. Each module file (`personnel.js`, `equipment.js`, `operations.js`, `assessment.js`) is patched in place — no new files created. Pagination uses Supabase REST `?limit=N&offset=N` query params.

**Tech Stack:** Vanilla JS, Supabase REST API, no new dependencies.

**Note on testing:** This codebase has no test suite. Each task includes manual verification steps in place of automated tests. Run each verification before committing.

---

## Pre-flight check

- [ ] Confirm you're on the `main` branch and working tree is clean: `git status`
- [ ] Open the app in a browser at the dev URL so you can verify changes live

---

## Task 1: File Upload Validation Utility

**Files:**
- Modify: `js/shared.js` (add after the `debounce` function — see Task 2)

The two upload functions (`savePersDocument` in `personnel.js` and `saveDocument` in `equipment.js`) send files directly to Supabase Storage with no client-side type or size check.

- [ ] **Add `validateUploadFile` to `js/shared.js`** — insert after the `esc` function (after line 21):

```js
// ─── File upload validation ───
const UPLOAD_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function validateUploadFile(file) {
  if (!UPLOAD_ALLOWED_TYPES.includes(file.type)) {
    showToast('Only PDF, JPEG, PNG, or WebP files are allowed', 'warn');
    return false;
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    showToast('File must be smaller than 10 MB', 'warn');
    return false;
  }
  return true;
}
```

- [ ] **Add validation to `savePersDocument` in `js/personnel.js`** — insert immediately after the `if (!file)` guard at line 304:

```js
  if (!file) { showToast('Please attach a new file — a file is required to save changes', 'warn'); document.getElementById('persDocFileBtn').style.borderColor = 'var(--bad)'; return; }
  if (!validateUploadFile(file)) return;
```

The existing line already handles the missing-file case. Add `if (!validateUploadFile(file)) return;` on the line directly after it.

- [ ] **Add validation to `saveDocument` in `js/equipment.js`** — insert after the `if (!file)` guard at line 601:

```js
  if (!file) { showToast('Please attach a file — attachment is required', 'warn'); document.getElementById('docFileBtn').style.borderColor = 'var(--bad)'; return; }
  if (!validateUploadFile(file)) return;
```

- [ ] **Fix silent upload failure in `js/equipment.js` `saveDocument`** — replace lines 608–613:

Current:
```js
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/equipment-docs/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${getToken()}`, 'Content-Type': file.type },
      body: file
    });
    if (uploadRes.ok) fileUrl = `${SUPABASE_URL}/storage/v1/object/public/equipment-docs/${path}`;
```

Replace with:
```js
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/equipment-docs/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${getToken()}`, 'Content-Type': file.type },
      body: file
    });
    if (!uploadRes.ok) { showToast('File upload failed. Please try again.', 'error'); return; }
    fileUrl = `${SUPABASE_URL}/storage/v1/object/public/equipment-docs/${path}`;
```

- [ ] **Verify manually:** In the app, open a personnel document upload modal. Try uploading a `.exe` file → should see "Only PDF, JPEG, PNG, or WebP files are allowed" toast. Try a >10 MB file → should see "File must be smaller than 10 MB" toast. Upload a valid PDF → should succeed.

- [ ] **Commit:**
```bash
git add js/shared.js js/personnel.js js/equipment.js
git commit -m "feat: add file upload validation (type + size) before Supabase Storage"
```

---

## Task 2: Fix `apiFetch` Error Handling

**Files:**
- Modify: `js/shared.js` lines 24–34

Currently `apiFetch` returns `[]` silently for any non-401 API error. A 500 or 409 is indistinguishable from "no results." This masks real failures.

- [ ] **Replace the `apiFetch` function in `js/shared.js`** (lines 24–34) with:

```js
// ─── API fetch with 401 guard and error surfacing ───
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (res.status === 401) {
      localStorage.removeItem('radp_token');
      localStorage.removeItem('radp_user');
      showPage('login');
      return null;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data?.message || data?.error || `Request failed (${res.status})`;
      showToast(msg, 'error');
      return null;
    }
    return Array.isArray(data) ? data : (data ? [data] : []);
  } catch {
    showToast('Network error — check your connection and try again.', 'error');
    return null;
  }
}
```

- [ ] **Verify manually:** Open browser DevTools → Network tab. In the app, temporarily change one API URL to an invalid path in the console (or use DevTools to block a request). Confirm a red toast appears instead of a silent empty list.

- [ ] **Commit:**
```bash
git add js/shared.js
git commit -m "fix: apiFetch now surfaces non-2xx errors via toast instead of silently returning []"
```

---

## Task 3: Add `debounce` Utility to `shared.js`

**Files:**
- Modify: `js/shared.js` (add near top, after `esc`)

- [ ] **Add `debounce` to `js/shared.js`** — insert after the `validateUploadFile` block added in Task 1:

```js
// ─── Debounce ───
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
```

- [ ] **Commit:**
```bash
git add js/shared.js
git commit -m "feat: add debounce utility to shared.js"
```

---

## Task 4: Add Missing Success Toasts

**Files:**
- Modify: `js/personnel.js`, `js/equipment.js`, `js/operations.js`, `js/assessment.js`

Several create/save operations give no feedback on success — the modal just closes. Users can't tell if the action worked.

- [ ] **`addPersonnel` in `js/personnel.js`** — add success toast before `closeModal`:

Find:
```js
  if (_pRes.ok) { const [_newP] = await _pRes.json(); window._justAddedPersId = _newP?.id; }
  closeModal('ctPersModal'); loadPersonnel();
```

Replace with:
```js
  if (_pRes.ok) { const [_newP] = await _pRes.json(); window._justAddedPersId = _newP?.id; showToast('Personnel added', 'success'); }
  else { showToast('Failed to add personnel', 'error'); return; }
  closeModal('ctPersModal'); loadPersonnel();
```

- [ ] **`savePersDocument` in `js/personnel.js`** — add success toast before `closeModal`:

Find:
```js
  closeModal('addPersDocModal');
  loadPersonnel();
```

Replace with:
```js
  showToast('Document saved', 'success');
  closeModal('addPersDocModal');
  loadPersonnel();
```

- [ ] **`saveDocument` in `js/equipment.js`** — add success toast before `closeModal`:

Find:
```js
  closeModal('addDocModal');
  loadEquipment(true);
```

Replace with:
```js
  showToast('Document saved', 'success');
  closeModal('addDocModal');
  loadEquipment(true);
```

- [ ] **`createSite` in `js/operations.js`** — find the function and add a success toast after the POST succeeds. Read the function first to find the exact lines, then add `showToast('Site created', 'success');` after a successful create response before closing the modal.

- [ ] **`saveEditSite` in `js/operations.js`** — similarly add `showToast('Site renamed', 'success');` after a successful PATCH.

- [ ] **`createAssessment` in `js/assessment.js`** — the function navigates to the detail view on success, which is sufficient feedback. No change needed here.

- [ ] **Verify manually:** Add a personnel record → confirm green "Personnel added" toast appears. Upload a document → confirm "Document saved" toast.

- [ ] **Commit:**
```bash
git add js/personnel.js js/equipment.js js/operations.js
git commit -m "feat: add success toasts for personnel/document/site create and save operations"
```

---

## Task 5: Toast CSS — Verify Styles Exist

**Files:**
- Read: `styles.css` (search for `.toast`)

The `showToast` function in `shared.js` creates elements with classes `.toast`, `.toast-success`, `.toast-error`, `.toast-warn`, `.toast-info`, `.toast-show`.

- [ ] **Search for toast styles:**
```bash
grep -n "toast" styles.css
```

- [ ] **If toast styles are missing or incomplete**, add this block at the end of `styles.css`:

```css
/* ── Toast Notifications ── */
#toastContainer {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.toast {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background: var(--surface-2, #1e293b);
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  opacity: 0;
  transform: translateX(24px);
  transition: opacity 0.22s ease, transform 0.22s ease;
  max-width: 320px;
  line-height: 1.4;
  pointer-events: auto;
}
@media (prefers-reduced-motion: reduce) {
  .toast { transition: opacity 0.22s ease; transform: none; }
}
.toast.toast-show { opacity: 1; transform: translateX(0); }
.toast-success { background: #16a34a; }
.toast-error   { background: #dc2626; }
.toast-warn    { background: #d97706; color: #fff; }
.toast-info    { background: #2563eb; }
```

- [ ] **If styles already exist**, confirm `.toast-success` class is defined. Skip adding if complete.

- [ ] **Commit (only if changes were made):**
```bash
git add styles.css
git commit -m "fix: ensure toast notification CSS covers all four types"
```

---

## Task 6: Pagination — Personnel List

**Files:**
- Modify: `js/personnel.js`
- Modify: `index.html` (add pagination controls to personnel section)

Supabase REST supports `?limit=N&offset=N` query params. Add `Prefer: count=exact` header to get total count from `Content-Range` response header.

- [ ] **Add pagination state at the top of `js/personnel.js`** (after line 11, after the `PERS_DOC_TYPES` declaration):

```js
let _persPage = 0;
const _PERS_PAGE_SIZE = 25;
```

- [ ] **Replace the personnel fetch in `loadPersonnel`** — find:

```js
  const people = await apiFetch(`${SUPABASE_URL}/rest/v1/personnel?select=*&order=created_at`, { headers: h });
  if (!people) return;
```

Replace with:

```js
  const from = _persPage * _PERS_PAGE_SIZE;
  const to   = from + _PERS_PAGE_SIZE - 1;
  const res  = await fetch(
    `${SUPABASE_URL}/rest/v1/personnel?select=*&order=created_at&offset=${from}&limit=${_PERS_PAGE_SIZE}`,
    { headers: { ...h, Prefer: 'count=exact' } }
  );
  if (res.status === 401) { localStorage.removeItem('radp_token'); localStorage.removeItem('radp_user'); showPage('login'); return; }
  if (!res.ok) { showToast('Failed to load personnel', 'error'); return; }
  const people = await res.json();
  const totalCount = parseInt(res.headers.get('Content-Range')?.split('/')[1] || '0', 10);
  if (!people) return;
```

- [ ] **Add pagination controls rendering** — at the end of `loadPersonnel`, after the list is rendered, add:

```js
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
```

- [ ] **Reset page on search** — find the personnel search input handler (in `index.html`) that calls `filterCards`. The current search filters client-side. Change it so typing resets to page 0:

In `index.html`, find the personnel search input (look for `filterCards('personnelList'`). Change its `oninput` handler to:
```
oninput="_persPage=0;filterCards('personnelList',this.value)"
```

- [ ] **Add `#personnelPagination` div to `index.html`** — find the `<div id="personnelList">` element and add a sibling div after it:
```html
<div id="personnelPagination"></div>
```

- [ ] **Add pagination CSS to `styles.css`:**
```css
/* ── Pagination ── */
.pagination { display:flex; align-items:center; gap:12px; padding:12px 0; justify-content:center; }
.pag-btn { padding:6px 14px; border-radius:6px; border:1px solid var(--border,#334155); background:var(--surface-2,#1e293b); color:var(--text-1,#f1f5f9); font-size:12px; cursor:pointer; }
.pag-btn:disabled { opacity:0.4; cursor:default; }
.pag-info { font-size:12px; color:var(--text-3,#64748b); }
```

- [ ] **Verify manually:** Add 30+ personnel records (or temporarily change `_PERS_PAGE_SIZE` to 3). Confirm pagination controls appear, Previous/Next navigate correctly, and page 2 shows the next batch.

- [ ] **Commit:**
```bash
git add js/personnel.js index.html styles.css
git commit -m "feat: add server-side pagination (25/page) to personnel list"
```

---

## Task 7: Pagination — Equipment List

**Files:**
- Modify: `js/equipment.js`
- Modify: `index.html`

- [ ] **Add pagination state at top of `js/equipment.js`** (after the `let currentDocItemId` or similar module-level vars):

```js
let _equipPage = 0;
const _EQUIP_PAGE_SIZE = 25;
```

- [ ] **Find `loadEquipment` in `js/equipment.js`** — locate the top-level equipment fetch (the fetch for root items with `parent_id=is.null`). Replace it with a paginated version following the same pattern as Task 6:

```js
  const from = _equipPage * _EQUIP_PAGE_SIZE;
  const res  = await fetch(
    `${SUPABASE_URL}/rest/v1/equipment_items?dismissed=is.false&parent_id=is.null&select=*,equipment_templates(name)&order=created_at&offset=${from}&limit=${_EQUIP_PAGE_SIZE}`,
    { headers: { ...h, Prefer: 'count=exact' } }
  );
  if (res.status === 401) { localStorage.removeItem('radp_token'); localStorage.removeItem('radp_user'); showPage('login'); return; }
  if (!res.ok) { showToast('Failed to load equipment', 'error'); return; }
  const items = await res.json();
  const totalCount = parseInt(res.headers.get('Content-Range')?.split('/')[1] || '0', 10);
```

- [ ] **Add pagination controls rendering to `loadEquipment`** — after the list is rendered:

```js
  const totalPages = Math.ceil(totalCount / _EQUIP_PAGE_SIZE);
  const pagEl = document.getElementById('equipmentPagination');
  if (pagEl) {
    if (totalPages <= 1) { pagEl.innerHTML = ''; }
    else {
      pagEl.innerHTML = `
        <div class="pagination">
          <button class="pag-btn" onclick="_equipPage=Math.max(0,_equipPage-1);loadEquipment()" ${_equipPage === 0 ? 'disabled' : ''}>← Prev</button>
          <span class="pag-info">Page ${_equipPage + 1} of ${totalPages}</span>
          <button class="pag-btn" onclick="_equipPage=Math.min(${totalPages-1},_equipPage+1);loadEquipment()" ${_equipPage >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
        </div>`;
    }
  }
```

- [ ] **Add `#equipmentPagination` div to `index.html`** — find `<div id="equipmentList">` and add after it:
```html
<div id="equipmentPagination"></div>
```

- [ ] **Verify manually:** Confirm equipment list paginates at 25 items.

- [ ] **Commit:**
```bash
git add js/equipment.js index.html
git commit -m "feat: add server-side pagination (25/page) to equipment list"
```

---

## Task 8: Pagination — Operation Sites & Assessments

**Files:**
- Modify: `js/operations.js`, `js/assessment.js`
- Modify: `index.html`

- [ ] **Add pagination state to `js/operations.js`:**
```js
let _sitesPage = 0;
const _SITES_PAGE_SIZE = 25;
```

- [ ] **Paginate `loadOperations` in `js/operations.js`** — same pattern as Tasks 6–7. Find the fetch for operation sites and replace with:

```js
  const from = _sitesPage * _SITES_PAGE_SIZE;
  const res  = await fetch(
    `${SUPABASE_URL}/rest/v1/operation_sites?contractor_id=eq.${u.id}&status=eq.active&order=created_at.desc&offset=${from}&limit=${_SITES_PAGE_SIZE}`,
    { headers: { ...h, Prefer: 'count=exact' } }
  );
  if (!res.ok) { showToast('Failed to load sites', 'error'); return; }
  const sites = await res.json();
  const totalCount = parseInt(res.headers.get('Content-Range')?.split('/')[1] || '0', 10);
```

- [ ] **Render pagination controls after sites list** and add `<div id="sitesPagination"></div>` to `index.html` in the operations list view.

- [ ] **Add pagination state to `js/assessment.js`:**
```js
let _assessPage = 0;
const _ASSESS_PAGE_SIZE = 25;
```

- [ ] **Paginate `loadAssessments` in `js/assessment.js`** — replace the `apiFetch` call with a paginated `fetch`:

```js
  const from = _assessPage * _ASSESS_PAGE_SIZE;
  const res  = await fetch(
    `${SUPABASE_URL}/rest/v1/assessments?contractor_id=eq.${u.id}&order=created_at.desc&offset=${from}&limit=${_ASSESS_PAGE_SIZE}`,
    { headers: { ...getHeaders(), Prefer: 'count=exact' } }
  );
  if (!res.ok) { showToast('Failed to load assessments', 'error'); return; }
  const assessments = await res.json();
  const totalCount = parseInt(res.headers.get('Content-Range')?.split('/')[1] || '0', 10);
```

- [ ] **Render pagination controls and add `<div id="assessmentPagination"></div>` to `index.html`** in the assessment list view.

- [ ] **Verify manually:** Operations and assessment lists paginate correctly.

- [ ] **Commit:**
```bash
git add js/operations.js js/assessment.js index.html
git commit -m "feat: add server-side pagination to operation sites and assessments lists"
```

---

## Task 9: Debounce Search Inputs

**Files:**
- Modify: `js/app.js` or add a `DOMContentLoaded` block to `js/shared.js`

The search inputs in the contractor page (`personnelSearch`, `equipmentSearch`) call `filterCards` on every keystroke directly via `oninput` attributes. Debouncing prevents excessive DOM manipulation on large lists.

- [ ] **Add debounced search wiring in `js/app.js`** — at the bottom of `app.js`, add:

```js
document.addEventListener('DOMContentLoaded', () => {
  const persSearch  = document.getElementById('personnelSearch');
  const equipSearch = document.getElementById('equipmentSearch');

  if (persSearch) {
    const debouncedPersFilter = debounce(q => { _persPage = 0; filterCards('personnelList', q); }, 300);
    persSearch.addEventListener('input', e => debouncedPersFilter(e.target.value));
    persSearch.removeAttribute('oninput');
  }
  if (equipSearch) {
    const debouncedEquipFilter = debounce(q => { _equipPage = 0; filterCards('equipmentList', q); }, 300);
    equipSearch.addEventListener('input', e => debouncedEquipFilter(e.target.value));
    equipSearch.removeAttribute('oninput');
  }
});
```

- [ ] **Remove the `oninput` attributes** from the personnel and equipment search inputs in `index.html` (so they don't fire twice):

Find the personnel search input and remove `oninput="filterCards('personnelList',this.value)"` attribute.
Find the equipment search input and remove its `oninput` attribute.

- [ ] **Verify manually:** Type quickly in the personnel search box. Using DevTools performance tab or a `console.log` inside `filterCards`, confirm it only fires after you stop typing for 300ms, not on every keystroke.

- [ ] **Commit:**
```bash
git add js/app.js index.html
git commit -m "perf: debounce personnel and equipment search inputs (300ms)"
```

---

## Task 10: Optimistic UI for Assessed Toggle

**Files:**
- Modify: `js/personnel.js`, `js/equipment.js`

When a user clicks "Mark as Assessed" on a personnel or equipment card, the UI currently waits for the API round-trip before updating. Apply the state change optimistically and roll back on failure.

- [ ] **Replace `markPersAssessed` in `js/personnel.js`:**

Current:
```js
async function markPersAssessed(personId) {
  await fetch(`${SUPABASE_URL}/rest/v1/personnel?id=eq.${personId}`, {
    method: 'PATCH', headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ assessed: true })
  });
  loadPersonnel(true);
}
```

Replace with:
```js
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
  loadPersonnel(true);
}
```

- [ ] **Replace `markEquipAssessed` in `js/equipment.js`** with the same optimistic pattern:

```js
async function markEquipAssessed(itemId) {
  const card = document.querySelector(`[data-id="${itemId}"]`);
  const badge = card?.querySelector('.sbadge-awaiting');
  if (badge) { badge.className = 'sbadge sbadge-ready'; badge.textContent = 'READY'; }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/equipment_items?id=eq.${itemId}`, {
    method: 'PATCH', headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ assessed: true })
  });
  if (!r.ok) {
    if (badge) { badge.className = 'sbadge sbadge-awaiting'; badge.textContent = 'AWAITING REVIEW'; }
    showToast('Failed to mark as assessed', 'error');
    return;
  }
  loadEquipment(true);
}
```

- [ ] **Verify manually:** Click "Mark as Assessed" on a personnel card. The badge should flip to READY immediately, before the spinner finishes. Use DevTools to throttle to "Slow 3G" to see the optimistic update clearly.

- [ ] **Commit:**
```bash
git add js/personnel.js js/equipment.js
git commit -m "feat: optimistic UI for mark-as-assessed toggles with rollback on failure"
```

---

## Phase 1–2 Complete

- [ ] Run a full manual smoke test: login, add personnel, upload doc, add equipment, create assessment, open operations site — confirm no console errors and all toasts appear correctly.
- [ ] Check the git log: `git log --oneline -10`
