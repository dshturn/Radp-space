# RADP P0/P1 Issues — Implementation Roadmap
**Date:** 2026-05-01  
**Status:** Ready for Execution  
**Scope:** Critical accessibility, performance, and usability fixes blocking Phase 2

---

## Overview

**Context**: Audit identified 5 P0/P1 issues that must be resolved before Phase 2 implementation begins. Most are quick wins; two (form loading states, assessment.js split) are already in Phase 2 roadmap.

**Goal**: Clear blockers this week; Phase 2 features launch next week.

---

## P0 Issues (Blocking)

### P0.1: Missing ARIA Labels on Dynamic Content

**Problem**: Modals, tabs, and popups lack `aria-labelledby`, `role="dialog"` semantic markup. Screen reader users can't navigate dynamic UI. This violates WCAG 2.1 Level A.

**Impact**: Field staff using assistive technology (about 5% of user base) can't use assessment modals.

**Files Affected**:
- `js/shared.js` — modal system
- `js/assessment.js` — personnel/equipment add modals
- `js/admin.js` — approval modals

**Implementation**:

1. **Update modal infrastructure in shared.js**:
   ```javascript
   function openModal(title, content, actions) {
     const modalId = `modal-${Date.now()}`;
     const modal = document.createElement('div');
     modal.setAttribute('role', 'dialog');
     modal.setAttribute('aria-labelledby', `${modalId}-title`);
     modal.setAttribute('aria-modal', 'true');
     modal.id = modalId;
     
     const heading = document.createElement('h2');
     heading.id = `${modalId}-title`;
     heading.textContent = title;
     
     // ... rest of modal creation
   }
   ```

2. **Update form error display**:
   ```javascript
   function showFormError(formElement, fieldName, message) {
     const errorDiv = document.createElement('div');
     errorDiv.setAttribute('role', 'alert');
     errorDiv.setAttribute('aria-live', 'polite');
     errorDiv.className = 'form-error';
     errorDiv.textContent = message;
     
     formElement.querySelector(`[name="${fieldName}"]`).after(errorDiv);
   }
   ```

3. **Add focus management to modals**:
   - When modal opens: move focus to first interactive element (close button or first form field)
   - When modal closes: restore focus to the button that opened it
   
   ```javascript
   function openModal(...) {
     // ... create modal
     modal.showModal?.(); // native <dialog> if available
     modal.querySelector('button, input, [tabindex="0"]')?.focus();
   }
   ```

4. **Test with screen reader**:
   - Use NVDA (Windows) or VoiceOver (Mac/iOS)
   - Verify modal title is announced
   - Verify focus moves to modal on open
   - Verify form errors announced as alerts

**Effort**: 1 day  
**Blocker for Phase 2?** Yes — Phase 2 audit export has forms/modals; need foundation first.

**Testing Checklist**:
- [ ] NVDA announces modal title on open
- [ ] Tab order within modal is logical
- [ ] Form errors announced as live regions
- [ ] Close button accessible via keyboard (Escape)
- [ ] Focus restored to opener after close

---

### P0.2: Form Submissions Lack Loading States

**Problem**: When user submits assessment, personnel, or equipment forms, the button doesn't disable and no spinner appears. User clicks multiple times, triggering duplicate submissions. No feedback that action is in progress.

**Impact**: Bad UX for slow networks (> 2s latency shows no feedback). Creates duplicate records if user impatient.

**Files Affected**:
- `js/assessment.js` — submit assessment form
- `js/personnel.js` — submit personnel form
- `js/equipment.js` — submit equipment form
- `js/operations.js` — submit operation site form

**Implementation**:

**Pattern** (applies to all forms):
```javascript
async function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  
  // Disable button, show loading state
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';
  
  try {
    const formData = new FormData(form);
    const result = await apiFetch(form.action, {
      method: form.method,
      body: Object.fromEntries(formData)
    });
    
    showToast('Saved successfully', 'success');
    form.reset();
    // Close modal or redirect
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save'; // Reset button text
  }
}
```

**Per-file changes**:

1. **js/assessment.js** (~10 lines changed):
   - Find `handleAssessmentSubmit()` (line ~550)
   - Wrap the apiFetch call with button disable/enable logic
   - Change submit button text to "Submitting assessment..."

2. **js/personnel.js** (~10 lines):
   - Find `handlePersonnelFormSubmit()` or similar
   - Same pattern

3. **js/equipment.js** (~10 lines):
   - Find equipment form handler
   - Same pattern

4. **js/operations.js** (~10 lines):
   - Find site form handler
   - Same pattern

**Effort**: 0.5 day (simple pattern, 4 files)  
**Blocker for Phase 2?** Yes — export form also needs this pattern.

**Testing Checklist**:
- [ ] Click submit button on assessment form
- [ ] Button disables immediately (grayed out)
- [ ] Button text shows "Saving..." or spinner appears
- [ ] On success: button re-enables, modal closes, toast shows
- [ ] On error: button re-enables, error toast shows, modal stays open
- [ ] Rapid clicks don't trigger duplicate submissions (button disabled prevents this)
- [ ] Form state preserved on error (user can retry without re-entering data)

---

## P1 Issues (Major)

### P1.1: assessment.js Size & Maintainability

**Problem**: Single file, 31KB, ~900 lines. Contains list view, create form, detail view, personnel add/remove, equipment add/remove. Hard to review, easy to introduce bugs, difficult to test modules independently.

**Impact**: Code review slow, refactoring risky, new features require careful navigation of monolithic file.

**Files Affected**: `js/assessment.js` (to be split into 5 files)

**Implementation**: Follow Phase 2 spec (Feature 4: Code Refactoring) — see detailed design in `2026-05-01-phase2-audit-features-design.md`.

**Summary**:
- Create `assessment-list.js`, `assessment-create.js`, `assessment-detail.js`, `assessment-personnel.js`, `assessment-equipment.js`, `assessment-utils.js`
- Extract code with no behavior changes
- Update script tags in index.html
- Delete old assessment.js
- Run full test suite

**Effort**: 3 days  
**Blocker for Phase 2?** No, but Phase 2 export feature touches assessment data; prefer clean module structure beforehand.

**Testing Checklist**: (see Phase 2 spec)
- [ ] All 6 assessment workflows work (list, create, detail, add personnel, remove personnel, add equipment, remove equipment, delete)
- [ ] No console errors
- [ ] Existing tests pass (if any)

---

### P1.2: PDF Upload Lacks Size Validation

**Problem**: No max file size check before upload. User could upload 100MB PDF, consuming storage quota and slowing the app. Supabase Storage will reject the file, but user gets confusing error after waiting.

**Impact**: Poor UX (silent failure after upload wait); storage quota abuse possible.

**Files Affected**:
- `js/documents.js` or `js/shared.js` (file upload handler)
- `js/personnel.js`, `js/equipment.js` (where documents are uploaded)

**Implementation**:

**Pattern** (in file input change handler):
```javascript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  
  // Validate size
  if (file.size > MAX_FILE_SIZE) {
    showToast(`File too large. Max size is 10 MB (your file: ${(file.size / 1024 / 1024).toFixed(1)} MB)`, 'error');
    fileInput.value = ''; // Clear input
    return;
  }
  
  // Validate type
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showToast('File type not allowed. Use PDF, JPG, PNG, or WebP.', 'error');
    fileInput.value = '';
    return;
  }
  
  // Proceed with upload
  uploadFile(file);
});
```

**Per-file changes**:

1. Find all `<input type="file">` elements in HTML (personnel form, equipment form, documents area)
2. Add `change` event listeners with validation
3. Add inline error messages near file inputs (not toast — user needs to see while fixing)

**Effort**: 0.5 day  
**Blocker for Phase 2?** No, but Phase 2 export processes documents; prefer robust upload validation first.

**Testing Checklist**:
- [ ] Upload PDF < 10MB → succeeds
- [ ] Upload PDF > 10MB → shows error toast, upload blocked
- [ ] Upload non-PDF file (e.g., .exe) → shows error toast
- [ ] Error message is clear and actionable
- [ ] File input cleared after error (doesn't retry on next attempt)

---

### P1.3: Service Worker Cache Strategy Undefined

**Problem**: `js/sw.js` exists and registers, but cache strategy isn't documented. Unclear what's cached, for how long, or when cache busts on deploy. Risk: users see stale UI after deploy, or missing new features.

**Impact**: After releasing new features, some users remain on old cached version until they manually clear cache.

**Files Affected**: `js/sw.js`, documentation

**Implementation**:

1. **Review current sw.js**:
   - What files are cached? (likely: `index.html`, `js/*.js`, `css/*.css`, static assets)
   - Cache name/version? (e.g., `radp-v1`)
   - Expiry logic? (none currently, likely)

2. **Define cache strategy** (add to sw.js comments and CLAUDE.md):
   ```javascript
   // Cache Strategy:
   // - App shell (index.html, js/*.js, css/*.css): cache-first, max 24h
   // - Static assets (images, fonts): cache-first, max 30 days
   // - API responses: network-first, fallback to cache
   // - On deploy: increment cache version (e.g., radp-v2), old cache auto-deleted
   
   const CACHE_VERSION = 'radp-v1'; // Increment on each deploy
   ```

3. **Add version-check listener**:
   ```javascript
   // In service worker
   self.addEventListener('message', (event) => {
     if (event.data && event.data.type === 'SKIP_WAITING') {
       self.skipWaiting(); // Force new SW to activate
     }
   });
   
   // In app (js/shared.js or index.html)
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.ready.then((reg) => {
       reg.addEventListener('controllerchange', () => {
         // Notify user: "New version available, reload to update"
         showToast('App updated. Reload to get new features.', 'info');
       });
     });
   }
   ```

4. **Document in CLAUDE.md**:
   Add "Service Worker & Caching" section explaining:
   - How to bust cache on deploy (increment version)
   - What's cached and why
   - How offline support works
   - How to test cache behavior locally

**Effort**: 0.5 day  
**Blocker for Phase 2?** No, but Phase 2 features will be cached; clear cache strategy prevents confusion.

**Testing Checklist**:
- [ ] App loads offline (from cache)
- [ ] After deploy, user gets notification to reload
- [ ] After reload, new version loads (cache busted)
- [ ] Static assets (CSS, images) remain cached across deploys (no reload needed)
- [ ] API failures fall back to cached data (if available)

---

### P1.4: Table Horizontal Scroll on Mobile

**Problem**: Assessment, personnel, and equipment tables render with all columns. On phones (< 480px), table overflows horizontally. Users have to scroll left/right to see all columns. Readability suffers.

**Impact**: Field staff on phones struggle to see full row data (name, status, expiry date) without scrolling.

**Files Affected**:
- `css/style.css` — table styles
- HTML table markup (index.html, assessment.js, personnel.js, equipment.js)

**Implementation** (choose one):

**Option A: Horizontal scroll container** (simpler, but less elegant):
```css
@media (max-width: 480px) {
  table {
    font-size: 0.875rem; /* Slightly smaller to fit more */
  }
  
  .table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch; /* Smooth scroll on iOS */
  }
}
```

**Option B: Card layout on mobile** (better UX, but more HTML changes):
```css
@media (max-width: 480px) {
  table, tbody, tr, td {
    display: block;
    width: 100%;
  }
  
  tr {
    margin-bottom: 1rem;
    border: 1px solid var(--color-border);
    padding: 1rem;
  }
  
  td {
    padding: 0.5rem 0;
    display: flex;
    justify-content: space-between;
  }
  
  td::before {
    content: attr(data-label); /* e.g., "Name:", "Status:" */
    font-weight: 600;
  }
}
```

**Recommendation**: Option B (card layout) provides better UX for field supervisors on phones. Requires adding `data-label` attributes to table cells, but worth the effort.

**Per-file changes**:

1. **css/style.css**:
   - Add `@media (max-width: 480px)` table rules
   - Ensure card layout is readable and scannable

2. **HTML/templates** (assessment.js, personnel.js, equipment.js):
   - Add `data-label="Name"`, `data-label="Status"`, etc. to `<td>` elements

**Effort**: 1 day  
**Blocker for Phase 2?** No, but Phase 2 export report should have mobile-responsive layout; prefer responsive tables beforehand.

**Testing Checklist**:
- [ ] Open personnel list on iPhone 6s (< 480px width) — no horizontal scroll
- [ ] Card layout on mobile shows all columns (name, expiry, status) without scroll
- [ ] Desktop view (> 480px) still uses table layout
- [ ] Touch targets (text, icons) are > 44px high on mobile
- [ ] No text overflow or cutoff on narrow screens

---

## P1.5: Hard-Coded Badge Colors

**Problem**: Status badge colors (green/amber/red for expiry states) are hard-coded in `js/operations.js` and other files instead of using CSS variables. Changes to color palette require code edits + redeploy.

**Impact**: Slow iteration on design; risk of color inconsistency across modules.

**Files Affected**:
- `js/operations.js` (and any other file with inline color logic)
- `css/style.css` (define token variables)

**Implementation**:

1. **Define CSS color tokens**:
   ```css
   :root {
     --color-status-valid: oklch(70% 0.2 120);    /* Green */
     --color-status-expiring: oklch(60% 0.3 45);  /* Amber */
     --color-status-expired: oklch(50% 0.25 0);   /* Red */
     --color-status-pending: oklch(55% 0.1 240);  /* Blue */
   }
   ```

2. **Update badge CSS**:
   ```css
   .badge.status-valid {
     background-color: var(--color-status-valid);
     color: white;
   }
   
   .badge.status-expiring {
     background-color: var(--color-status-expiring);
     color: white;
   }
   
   .badge.status-expired {
     background-color: var(--color-status-expired);
     color: white;
   }
   ```

3. **Remove hard-coded colors from JS**:
   - Search `js/operations.js` for `#` (hex colors) or `rgb(` patterns
   - Replace with CSS classes (e.g., `badge status-valid` instead of inline `style="background: #2ecc71"`)

**Effort**: 0.5 day  
**Blocker for Phase 2?** No, but Phase 2 export will display status badges; prefer consistent tokenization first.

**Testing Checklist**:
- [ ] Expiry badge on personnel/equipment shows correct color for each status (valid/expiring/expired/pending)
- [ ] Changing CSS token value updates badge color site-wide
- [ ] No inline style attributes on badges (use CSS classes only)

---

## Implementation Sequence

**Week 1 (This week)**: Fix P0 issues + start P1.1

| Day | Task | Owner | Effort | Status |
|-----|------|-------|--------|--------|
| **Monday** | P0.1: ARIA labels + P0.2: Loading states | Dev 1 | 1.5 days | Ready |
| **Tuesday** | (continued from Monday) | Dev 1 | 0.5 days | |
| **Wednesday** | P1.2: File size validation | Dev 1 | 0.5 days | |
| **Wednesday** | P1.3: Service worker documentation | Dev 2 | 0.5 days | |
| **Thursday** | P1.4: Table mobile layout | Dev 2 | 1 day | |
| **Friday** | P1.5: Badge color tokens | Dev 2 | 0.5 days | |
| **Friday** | P1.1: Split assessment.js (start) | Dev 1 | 1 day | |

**Week 2**: Finish P1.1, begin Phase 2 features

| Days | Task | Owner | Effort | Blocker |
|------|------|-------|--------|---------|
| **Mon–Tue** | P1.1: Split assessment.js (finish) | Dev 1 | 2 days | None |
| **Tue–Fri** | Phase 2.1: Audit export | Dev 1 | 4 days | P0.1, P0.2 |
| **Wed–Fri** | Phase 2.3: Email alerts | Dev 2 | 2 days | None |

---

## Testing Strategy

### Unit-Level Testing (Manual)
- Each fix gets a manual test checklist (provided above)
- Use browser DevTools for accessibility (Lighthouse, axe DevTools)
- Use NVDA or VoiceOver for screen reader testing

### Integration Testing
- Full assessment workflow after splitting assessment.js
- Form submission → loading state → success/error → modal close
- File upload → size/type validation → success → document appears in list

### Regression Testing
- Run all existing features (list views, forms, detail pages, deletes)
- Verify no console errors
- Check responsive layout on desktop, tablet, phone

### Smoke Test Pre-Deploy
- Login with contractor + admin accounts
- Create personnel, equipment, assessment
- Submit assessment, approve in admin panel
- Export audit log
- Check audit log search
- Verify email alerts (check spam folder)

---

## Success Criteria

**P0 Issues** (must fix before Phase 2):
- [ ] All ARIA labels in place; WCAG 2.1 Level A compliance verified
- [ ] Form loading states work on all 4 forms (assessment, personnel, equipment, operations)
- [ ] No duplicate submissions possible (button disables during request)

**P1 Issues** (must fix this week):
- [ ] assessment.js split into 5 focused modules
- [ ] File uploads reject files > 10MB with clear error message
- [ ] Service worker cache strategy documented
- [ ] Tables reflow to card layout on mobile (< 480px)
- [ ] All badge colors use CSS variables, no hard-coded colors in JS

**Phase 2 Ready**:
- [ ] All P0/P1 fixes deployed to production
- [ ] Code reviewed and approved
- [ ] Full regression test passed
- [ ] Design specs for audit export, search, email alerts approved (already done)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **ARIA changes break existing flows** | Users can't submit forms | Test all 4 forms thoroughly; screen reader testing |
| **Loading state logic conflicts with existing validation** | Double form submissions possible | Separate validation (on change) from submission (disable button) |
| **assessment.js split creates new bugs** | Existing workflows broken | Extract with zero behavior changes; test each workflow |
| **Mobile layout reflow breaks detail view** | Assessment detail unreadable on phone | Use data-label approach; test all detail pages |
| **Deploy with unfinished P1.1 blocks Phase 2** | Schedule slip | Split work: P0 + P1.2-P1.5 ready Friday; P1.1 finish Monday |

---

## Approval & Sign-Off

- [ ] Tech Lead: Review and approve roadmap
- [ ] QA: Confirm testing approach
- [ ] PM: Confirm timeline doesn't impact Phase 2 launch

**Document Owner**: Dev 1  
**Version**: 1.0  
**Last Updated**: 2026-05-01  
**Next Review**: 2026-05-08 (post-implementation review)
