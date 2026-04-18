# RADP Improvement Program — Design Spec
**Date:** 2026-04-18  
**Status:** Approved  
**Scope:** Foundation fixes, performance, audit log, expiry notifications, reporting & bulk ops

---

## Context

RADP is a PWA for oil & gas contractor compliance management. It tracks personnel qualifications, equipment certifications, readiness assessments, and operation site assignments. Stack: Vanilla JS + Supabase (PostgreSQL + Auth + Edge Functions) + Vercel. ~3,800 lines across 8 modules. No test suite.

The improvement program is sequenced so each phase is stable before the next builds on it.

---

## Phase 1 — Foundation Fixes

### 1.1 Toast Notification System

**Problem:** All feedback is either `alert()` (blocking) or silent. Errors disappear into the void.

**Design:**
- Add `showToast(message, type)` to `shared.js` — types: `success`, `error`, `warning`, `info`
- Toast renders as a fixed-position overlay (bottom-right), auto-dismisses after 4s, stackable
- Single `#toast-container` div injected into `index.html` once on app load
- Replace every `alert()` call across all modules with `showToast()`
- All silent failure paths (currently returning `null`) get an error toast

**CSS:** Uses existing design tokens — `--color-success`, `--color-warning`, `--color-error`. Slides in from the right, fades out. Respects `prefers-reduced-motion`.

### 1.2 API Error Boundaries

**Problem:** `apiFetch` returns `null` on failure; callers rarely check.

**Design:**
- Modify `apiFetch` in `shared.js` to throw on non-2xx responses instead of returning null
- Each module's list/render function wraps its top-level call in `try/catch`
- Catch handler calls `showToast(error.message, 'error')`
- Network-level failures (offline) get a distinct "You appear to be offline" toast
- Loading states: set a `loading` attribute on the triggering button/section, clear on completion

### 1.3 File Upload Validation

**Problem:** No client-side checks before sending files to Supabase Storage.

**Design:**
- Allowed types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`
- Max size: 10 MB
- Validation runs in the `change` event handler before any upload begins
- On failure: inline error message adjacent to the input (not a toast — user needs to see it while fixing)
- Filenames sanitized: strip non-alphanumeric except `.`, `-`, `_` before upload

### 1.4 Request Deduplication

**Problem:** Rapid clicks trigger multiple identical API calls.

**Design:**
- Add a simple in-flight request tracker in `shared.js`: `const pendingRequests = new Set()`
- Key = method + URL + body hash
- If key already in-flight, return the existing promise instead of making a new request
- Automatically removes key on resolve/reject
- Separately: debounce all search input handlers to 300 ms

### 1.5 Delete Confirmations

**Problem:** Delete actions on personnel, equipment, documents, and sites are immediate with no undo.

**Design:**
- Reuse the existing modal system in `shared.js`
- `confirmDelete(entityName)` — generic confirm modal: "Delete [name]? This cannot be undone."
- Two buttons: Cancel (dismisses, no action) and Delete (red, destructive)
- No new UI pattern — leverages existing `openModal` / `closeModal` infrastructure

### 1.6 LoR PDF Completion

**Problem:** Letter of Readiness PDF generation is likely a stub or partially implemented.

**Design:**
- Inspect current `generateLoR()` in `assessment.js`; replace any stub with a full print-template implementation
- LoR document structure:
  - Header: company logo placeholder, document title "Letter of Readiness", date of issue
  - Assessment metadata: field/well name, type of job, SharePoint request ID, objective
  - Personnel table: name, position, national ID, document expiry dates
  - Equipment table: name, model, serial number, document expiry dates
  - Footer: contractor name, signature line
- Use PDF.js (already bundled) or native `window.print()` on a hidden print-ready HTML template
- Prefer print template approach (no additional library code, works offline, printable)

---

## Phase 2 — Performance

### 2.1 Pagination

**Problem:** Lists fetch all rows. A contractor with 500 personnel will see slow renders and high memory usage.

**Design:**
- Page size: 25 items
- Supabase `.range(from, to)` for server-side pagination
- UI: Previous / Next buttons + "Showing X–Y of Z" label, placed below each list
- State: `currentPage` integer per module, reset to 0 on search or filter change
- Applies to: personnel list, equipment list, operation sites list, assessment list
- Search still works — pagination resets to page 0 on new search term

### 2.2 Debounced Search

**Problem:** Search fires an API call on every keystroke.

**Design:**
- 300 ms debounce on all search inputs
- Use `shared.js` utility: `debounce(fn, delay)`
- Show a subtle spinner in the search input during the debounce window

### 2.3 Optimistic UI

**Problem:** Status changes (e.g., marking a document as reviewed) feel slow — UI waits for API round-trip.

**Design:**
- For toggle-style actions (dismiss equipment, mark assessed), apply the visual change immediately
- On API failure: revert to previous state + show error toast
- Applies to: equipment `dismissed` toggle, personnel `assessed` toggle

---

## Phase 3 — Audit Log

### 3.1 Database Schema

New table in Supabase:

```sql
CREATE TABLE audit_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id    uuid REFERENCES auth.users(id),
  entity_type text NOT NULL,  -- 'personnel', 'equipment', 'document', 'assessment', 'site', 'user'
  entity_id   uuid,
  action      text NOT NULL,  -- 'created', 'updated', 'deleted', 'approved', 'rejected', 'assigned', 'uploaded'
  metadata    jsonb,          -- entity snapshot or relevant fields at time of action
  created_at  timestamptz DEFAULT now()
);

-- RLS: admins can read all; contractors read own actor_id rows only
```

### 3.2 Events Logged

| Entity | Actions |
|--------|---------|
| user | approved, rejected |
| personnel | created, updated, deleted |
| document (personnel) | uploaded, deleted |
| equipment | created, updated, deleted |
| document (equipment) | uploaded, deleted |
| assessment | created, status changed (pending→approved/rejected) |
| site | created, archived |
| site_personnel | assigned, removed |
| site_equipment | assigned, removed |

### 3.3 Logging Implementation

- `logAudit(entityType, entityId, action, metadata)` helper in `shared.js`
- Called immediately after each successful API mutation (not before — only log confirmed actions)
- `metadata` captures a minimal snapshot: entity name, status change (from → to), actor's company

### 3.4 Audit Log Viewer

- Location: Admin dashboard, new "Audit Log" tab
- Displays: timestamp, actor (name + company), entity type, entity name, action
- Filters: entity type dropdown, date range picker (native `<input type="date">`)
- Paginated: 50 rows per page
- Read-only — no actions available from this view

---

## Phase 4 — Expiry Notifications

### 4.1 Database Schema

```sql
CREATE TABLE notifications (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id uuid REFERENCES auth.users(id),
  type         text NOT NULL,  -- 'expiry_warning', 'expiry_urgent', 'expiry_critical'
  entity_type  text NOT NULL,  -- 'personnel_document', 'equipment_document'
  entity_id    uuid NOT NULL,
  entity_label text,           -- human-readable: "John Smith — Medical Report"
  days_until   integer,        -- negative = already expired
  read         boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);
```

### 4.2 Expiry Rules

| Days until expiry | Type | Label |
|-------------------|------|-------|
| ≤ 0 | `expiry_critical` | Expired |
| 1–7 | `expiry_urgent` | Expires in N days |
| 8–30 | `expiry_warning` | Expires in N days |

### 4.3 Supabase Edge Function (Daily Cron)

- Function name: `check-expiries`
- Schedule: daily at 06:00 UTC
- Logic:
  1. Query all `personnel_documents` and equipment `documents` with `expiry_date` within 30 days or already past
  2. For each: upsert a notification (unique on `contractor_id + entity_id + type` to avoid duplicates)
  3. Send email digest to contractor if they have any new critical/urgent items (via Supabase email or Resend)
- Email: plain text summary — "You have N documents expiring within 7 days. Log in to review."

### 4.4 In-App Notification Bell

- Bell icon in the app header (top-right), shows unread count badge
- Click opens a dropdown panel listing unread notifications, sorted by urgency
- "Mark all read" action; individual dismiss
- Polling: fetch unread count every 5 minutes (simple interval, no websocket needed)
- Notifications older than 90 days are auto-deleted by the Edge Function cleanup pass

---

## Phase 5 — Reporting & Bulk Operations

### 5.1 CSV Export

**What's exported:**

| Export | Columns |
|--------|---------|
| Personnel | Name, Position, National ID, Assessed, Expiry Date, Missing Docs |
| Equipment | Name, Model, Serial, Type, Assessed, Expiry Date, Missing Docs |
| Site Summary | Site Name, Personnel Count, Equipment Count, Next Expiry Date |

**Implementation:**
- `exportToCsv(rows, filename)` utility in `shared.js`
- Builds a CSV string client-side (no server round-trip)
- Triggers `<a download>` to save file
- Export button added to each list view header

### 5.2 Site Summary Print View

- "Print Summary" button on operation site detail page
- Opens a `window.print()` on a hidden print-ready HTML section
- Includes: site name, date printed, personnel table, equipment table, expiry status column
- CSS `@media print` rules already partially present — extend them

### 5.3 Bulk Operations

**Design:**
- Checkbox column appears on personnel and equipment list when user enters "select mode" (toggle button)
- Select mode shows: checkbox per row, "Select All" checkbox in header, bulk action bar at bottom
- Bulk actions available:
  - Personnel: bulk delete
  - Equipment: bulk delete
  - Both: bulk mark as dismissed
- Confirmation required before bulk delete (shows count: "Delete 12 personnel?")
- No bulk document upload — too complex without a clear UX pattern for multi-file assignment

---

## Architecture Decisions

**No new dependencies.** All phases use:
- Existing Supabase client
- Existing PDF.js / print approach for LoR
- Native browser APIs (CSV download, `<input type="date">`, `window.print()`)
- Supabase Edge Functions (Deno) for scheduled jobs

**Module boundaries stay the same.** New utilities (`showToast`, `debounce`, `logAudit`, `exportToCsv`, `confirmDelete`) all go into `shared.js`. No new JS files unless a module exceeds ~700 lines, at which point it splits at a natural boundary.

**Database migrations** handled via Supabase dashboard SQL editor — no migration tooling introduced.

---

## Explicitly Out of Scope

- SharePoint integration (no spec)
- Offline-first data sync (high complexity, low ROI)
- Multi-language support
- Unit or integration tests (not blocked, but not part of this program)

---

## Implementation Order

1. Phase 1 (Foundation) — all 6 items together, no dependencies between them
2. Phase 2 (Performance) — after Phase 1; pagination requires stable error handling
3. Phase 3 (Audit Log) — after Phase 1; needs confirmed-action pattern from error boundaries
4. Phase 4 (Notifications) — after Phase 3; shares DB patterns
5. Phase 5 (Reporting + Bulk) — independent, lowest risk, can go anytime after Phase 1
