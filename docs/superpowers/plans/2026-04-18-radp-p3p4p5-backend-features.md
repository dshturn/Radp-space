# RADP Phase 3–5: Audit Log, Notifications & Reporting

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full compliance audit trail, proactive expiry notification system, CSV export, and bulk-delete operations across personnel and equipment lists.

**Architecture:**
- Phase 3 (Audit Log): New `audit_log` Supabase table + `logAudit()` in `shared.js` + admin viewer tab
- Phase 4 (Notifications): New `notifications` table + Supabase Edge Function (Deno, daily cron) + in-app notification bell in header
- Phase 5 (Reporting & Bulk): Client-side CSV generation + bulk-select UI layer on existing lists

**Tech Stack:** Vanilla JS, Supabase REST API, Supabase Edge Functions (Deno/TypeScript), no new client-side dependencies.

**Prerequisites:** Phase 1–2 plan must be complete (uses `showToast`, `debounce`, `apiFetch` as fixed).

---

## Phase 3: Audit Log

---

### Task 11: Create `audit_log` Table in Supabase

**Files:**
- Create: `supabase/migrations/001_audit_log.sql`

- [ ] **Create the migration file** at `supabase/migrations/001_audit_log.sql`:

```sql
-- Audit log: immutable record of all significant actions in RADP
create table if not exists audit_log (
  id          uuid        default gen_random_uuid() primary key,
  actor_id    uuid        references auth.users(id) on delete set null,
  entity_type text        not null,  -- 'personnel' | 'equipment' | 'document' | 'assessment' | 'site' | 'user'
  entity_id   text,                  -- stringified id of the affected row
  action      text        not null,  -- 'created' | 'updated' | 'deleted' | 'approved' | 'rejected' | 'assigned' | 'uploaded'
  label       text,                  -- human-readable: "John Smith — Medical Report"
  metadata    jsonb,                 -- optional snapshot of key fields at time of action
  created_at  timestamptz default now()
);

-- Admins can read all rows; contractors can read their own actions only
alter table audit_log enable row level security;

create policy "admins read all audit_log"
  on audit_log for select
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and status = 'admin'
    )
  );

create policy "contractors read own audit_log"
  on audit_log for select
  using (actor_id = auth.uid());

-- Anyone authenticated can insert (logAudit() is called client-side)
create policy "authenticated insert audit_log"
  on audit_log for insert
  with check (auth.uid() is not null);
```

- [ ] **Run this SQL in the Supabase dashboard** — open your project → SQL Editor → paste and run.

- [ ] **Verify:** In Supabase Table Editor, confirm `audit_log` table exists with all columns.

- [ ] **Commit:**
```bash
git add supabase/migrations/001_audit_log.sql
git commit -m "feat: add audit_log Supabase table with RLS policies"
```

---

### Task 12: `logAudit` Helper in `shared.js`

**Files:**
- Modify: `js/shared.js`

- [ ] **Add `logAudit` function to `js/shared.js`** — insert after `showConfirm` function (after line ~187):

```js
// ─── Audit logging ───
async function logAudit(entityType, entityId, action, label, metadata = {}) {
  const u = getUser();
  if (!u?.id) return; // not logged in, skip
  // Fire-and-forget: audit failures must never block the user action
  fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
    method: 'POST',
    headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({
      actor_id:    u.id,
      entity_type: entityType,
      entity_id:   String(entityId),
      action,
      label:       label || null,
      metadata:    Object.keys(metadata).length ? metadata : null
    })
  }).catch(() => {}); // silently swallow network errors on audit writes
}
```

- [ ] **Commit:**
```bash
git add js/shared.js
git commit -m "feat: add logAudit() fire-and-forget helper to shared.js"
```

---

### Task 13: Instrument Audit Logging Across Modules

**Files:**
- Modify: `js/personnel.js`, `js/equipment.js`, `js/operations.js`, `js/assessment.js`, `js/admin.js`

Call `logAudit()` immediately after each confirmed successful action. Never call it before the API confirms success.

- [ ] **`js/personnel.js` — `addPersonnel`** — after `showToast('Personnel added', 'success')`:
```js
logAudit('personnel', _newP.id, 'created', name);
```

- [ ] **`js/personnel.js` — `savePersDocument`** — before `closeModal`:
```js
logAudit('document', window._justAddedPersDocId || editId, editId ? 'updated' : 'uploaded', `${typeName} — ${document.getElementById('persDocTypeName').textContent}`);
```

- [ ] **`js/personnel.js` — `deletePersDoc`** — inside the `animateRemoveEl` callback, after the delete succeeds:
```js
if (r.ok) logAudit('document', id, 'deleted', 'Personnel document');
```

- [ ] **`js/personnel.js` — `deletePersRecord`** — inside the `animateRemoveEl` callback, after the delete succeeds:
```js
if (r.ok) logAudit('personnel', id, 'deleted', 'Personnel record');
```

- [ ] **`js/personnel.js` — `markPersAssessed`** — after the successful PATCH (before `loadPersonnel`):
```js
logAudit('personnel', personId, 'updated', 'Marked as assessed');
```

- [ ] **`js/equipment.js` — `saveDocument`** — before `closeModal('addDocModal')`:
```js
logAudit('document', window._justAddedDocId, 'uploaded', typeName);
```

- [ ] **`js/equipment.js` — `deleteDoc`** — inside `animateRemoveEl` callback after success:
```js
if (r.ok) logAudit('document', id, 'deleted', 'Equipment document');
```

- [ ] **`js/equipment.js` — `deleteEquipItem`** — after successful delete:
```js
logAudit('equipment', id, 'deleted', 'Equipment item');
```

- [ ] **`js/equipment.js` — `markEquipAssessed`** — after successful PATCH:
```js
logAudit('equipment', itemId, 'updated', 'Marked as assessed');
```

- [ ] **`js/operations.js` — `createSite`** — after successful POST:
```js
logAudit('site', newSite.id, 'created', title);
```
(Read `createSite` first to find where the POST response is handled, then add.)

- [ ] **`js/operations.js` — `archiveSite`** — after successful PATCH/DELETE:
```js
logAudit('site', id, 'deleted', 'Site archived');
```

- [ ] **`js/assessment.js` — `createAssessment`** — after `showDetail(data[0].id)` succeeds:
```js
logAudit('assessment', data[0].id, 'created', fieldWell);
```

- [ ] **`js/admin.js` — `deleteUser`** — after successful delete:
```js
logAudit('user', id, 'deleted', 'User account deleted');
```

- [ ] **`js/admin.js` — user approval/rejection** — `updateStatus` uses `adminToken`, not `getHeaders()`, so `logAudit()` won't work directly. Instead, add an inline fire-and-forget fetch after the successful status PATCH in `updateStatus`:

```js
async function updateStatus(id, status) {
  await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, Prefer: 'return=minimal' },
    body: JSON.stringify({ status })
  });
  // Audit log using admin token
  fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, Prefer: 'return=minimal' },
    body: JSON.stringify({ actor_id: null, entity_type: 'user', entity_id: String(id), action: status === 'approved' ? 'approved' : 'rejected', label: `User ${status}` })
  }).catch(() => {});
  loadUsers();
}
```

- [ ] **Verify manually:** Perform a few actions (add personnel, upload doc, mark assessed). Then in Supabase Table Editor → audit_log → confirm rows are being inserted with correct entity_type, action, and label.

- [ ] **Commit:**
```bash
git add js/personnel.js js/equipment.js js/operations.js js/assessment.js js/admin.js
git commit -m "feat: instrument audit logging across all significant RADP actions"
```

---

### Task 14: Audit Log Viewer in Admin Dashboard

**Files:**
- Modify: `js/admin.js`
- Modify: `index.html` (add tab and list container to admin dashboard section)

- [ ] **Add "Audit Log" tab to the admin dashboard in `index.html`** — find the admin dashboard section and add a tab button and content container. Find the existing admin tabs (Users / Pending) and add:

```html
<!-- Add to admin tab bar -->
<button class="tab" onclick="showAdminTab('auditLog', this)">Audit Log</button>

<!-- Add as sibling to existing admin tab panels -->
<div id="auditLogTab" style="display:none;">
  <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
    <select id="auditEntityFilter" onchange="loadAuditLog()" style="padding:6px 10px;font-size:13px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-1);">
      <option value="">All types</option>
      <option value="personnel">Personnel</option>
      <option value="equipment">Equipment</option>
      <option value="document">Documents</option>
      <option value="assessment">Assessments</option>
      <option value="site">Sites</option>
      <option value="user">Users</option>
    </select>
    <input type="date" id="auditDateFrom" onchange="loadAuditLog()" style="padding:6px 10px;font-size:13px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-1);">
    <input type="date" id="auditDateTo"   onchange="loadAuditLog()" style="padding:6px 10px;font-size:13px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-1);">
  </div>
  <div id="auditLogList"></div>
  <div id="auditLogPagination"></div>
</div>
```

- [ ] **Add `showAdminTab` helper and `loadAuditLog` to `js/admin.js`**:

```js
function showAdminTab(tab, el) {
  ['usersTab','pendingTab','auditLogTab'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.querySelectorAll('#adminPage .tab').forEach(t => t.classList.remove('active'));
  const target = document.getElementById(tab + 'Tab');
  if (target) target.style.display = 'block';
  if (el) el.classList.add('active');
  if (tab === 'auditLog') loadAuditLog();
}

let _auditPage = 0;
const _AUDIT_PAGE_SIZE = 50;

async function loadAuditLog() {
  _auditPage = 0; // always reset to first page when filters change
  await _renderAuditLog();
}

async function _renderAuditLog() {
  const entityFilter = document.getElementById('auditEntityFilter')?.value || '';
  const dateFrom     = document.getElementById('auditDateFrom')?.value || '';
  const dateTo       = document.getElementById('auditDateTo')?.value || '';

  let url = `${SUPABASE_URL}/rest/v1/audit_log?order=created_at.desc&offset=${_auditPage * _AUDIT_PAGE_SIZE}&limit=${_AUDIT_PAGE_SIZE}`;
  if (entityFilter) url += `&entity_type=eq.${entityFilter}`;
  if (dateFrom)     url += `&created_at=gte.${dateFrom}T00:00:00Z`;
  if (dateTo)       url += `&created_at=lte.${dateTo}T23:59:59Z`;

  // Admin uses its own token stored in `adminToken` (module-level var in admin.js)
  const adminH = { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const res = await fetch(url, { headers: { ...adminH, Prefer: 'count=exact' } });
  if (!res.ok) { showToast('Failed to load audit log', 'error'); return; }
  const rows = await res.json();
  const total = parseInt(res.headers.get('Content-Range')?.split('/')[1] || '0', 10);

  const list = document.getElementById('auditLogList');
  if (!rows.length) { list.innerHTML = '<div class="empty">No audit entries found</div>'; document.getElementById('auditLogPagination').innerHTML = ''; return; }

  list.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="border-bottom:1px solid var(--border);text-align:left;">
          <th style="padding:8px 10px;color:var(--text-3);font-weight:500;">Time</th>
          <th style="padding:8px 10px;color:var(--text-3);font-weight:500;">Type</th>
          <th style="padding:8px 10px;color:var(--text-3);font-weight:500;">Action</th>
          <th style="padding:8px 10px;color:var(--text-3);font-weight:500;">Label</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px 10px;color:var(--text-3);white-space:nowrap;">${new Date(r.created_at).toLocaleString()}</td>
            <td style="padding:8px 10px;"><span style="font-size:11px;padding:2px 6px;border-radius:4px;background:var(--surface-3,#334155);color:var(--text-2);">${esc(r.entity_type)}</span></td>
            <td style="padding:8px 10px;color:var(--text-1);">${esc(r.action)}</td>
            <td style="padding:8px 10px;color:var(--text-2);">${esc(r.label || '—')}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  const totalPages = Math.ceil(total / _AUDIT_PAGE_SIZE);
  const pagEl = document.getElementById('auditLogPagination');
  if (totalPages <= 1) { pagEl.innerHTML = ''; return; }
  pagEl.innerHTML = `
    <div class="pagination">
      <button class="pag-btn" onclick="_auditPage=Math.max(0,_auditPage-1);_renderAuditLog()" ${_auditPage===0?'disabled':''}>← Prev</button>
      <span class="pag-info">Page ${_auditPage+1} of ${totalPages}</span>
      <button class="pag-btn" onclick="_auditPage=Math.min(${totalPages-1},_auditPage+1);_renderAuditLog()" ${_auditPage>=totalPages-1?'disabled':''}>Next →</button>
    </div>`;
}
```

Note: `getAdminHeaders()` should already exist in `admin.js`. If it uses a different name, match the existing pattern.

- [ ] **Verify manually:** Log into admin dashboard, click "Audit Log" tab. Confirm entries appear. Filter by "Personnel" → only personnel entries show. Filter by date range → filters correctly.

- [ ] **Commit:**
```bash
git add js/admin.js index.html
git commit -m "feat: audit log viewer tab in admin dashboard with entity type and date filters"
```

---

## Phase 4: Expiry Notifications

---

### Task 15: Create `notifications` Table in Supabase

**Files:**
- Create: `supabase/migrations/002_notifications.sql`

- [ ] **Create `supabase/migrations/002_notifications.sql`:**

```sql
create table if not exists notifications (
  id            uuid        default gen_random_uuid() primary key,
  contractor_id uuid        not null references auth.users(id) on delete cascade,
  type          text        not null,  -- 'expiry_warning' | 'expiry_urgent' | 'expiry_critical'
  entity_type   text        not null,  -- 'personnel_document' | 'equipment_document'
  entity_id     text        not null,
  entity_label  text,                  -- e.g. "John Smith — Medical Report"
  days_until    integer,               -- negative = already expired
  read          boolean     default false,
  created_at    timestamptz default now(),
  -- One notification per contractor+entity+type combo (upsert target)
  unique(contractor_id, entity_id, type)
);

alter table notifications enable row level security;

-- Contractors can only read/write their own notifications
create policy "contractors manage own notifications"
  on notifications
  using (contractor_id = auth.uid())
  with check (contractor_id = auth.uid());

-- Service role (used by Edge Function) bypasses RLS automatically
```

- [ ] **Run in Supabase SQL Editor and verify** the table and unique constraint exist.

- [ ] **Commit:**
```bash
git add supabase/migrations/002_notifications.sql
git commit -m "feat: add notifications Supabase table for expiry alerts"
```

---

### Task 16: Supabase Edge Function — Daily Expiry Check

**Files:**
- Create: `supabase/functions/check-expiries/index.ts`

This Deno function runs daily, scans all documents with expiry dates within the next 30 days (or already expired), and upserts rows into `notifications`.

- [ ] **Create directory and file:**
```bash
mkdir -p supabase/functions/check-expiries
```

- [ ] **Create `supabase/functions/check-expiries/index.ts`:**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function classifyDays(days: number): 'expiry_critical' | 'expiry_urgent' | 'expiry_warning' | null {
  if (days <= 0)  return 'expiry_critical';
  if (days <= 7)  return 'expiry_urgent';
  if (days <= 30) return 'expiry_warning';
  return null;
}

Deno.serve(async (_req) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  const todayStr = today.toISOString().split('T')[0];
  const in30Str  = in30.toISOString().split('T')[0];

  // ── Personnel documents ──
  const { data: persDocs, error: persErr } = await supabase
    .from('personnel_documents')
    .select('id, doc_type_name, expiry_date, personnel(id, full_name, contractor_id)')
    .lte('expiry_date', in30Str)
    .not('expiry_date', 'is', null);

  if (persErr) console.error('persDocs error:', persErr);

  for (const doc of (persDocs || [])) {
    const exp   = new Date(doc.expiry_date!);
    const days  = Math.round((exp.getTime() - today.getTime()) / 86400000);
    const type  = classifyDays(days);
    if (!type) continue;
    const contractor_id = doc.personnel?.contractor_id;
    if (!contractor_id) continue;

    await supabase.from('notifications').upsert({
      contractor_id,
      type,
      entity_type:  'personnel_document',
      entity_id:    String(doc.id),
      entity_label: `${doc.personnel?.full_name} — ${doc.doc_type_name}`,
      days_until:   days,
      read:         false,
    }, { onConflict: 'contractor_id,entity_id,type', ignoreDuplicates: false });
  }

  // ── Equipment documents ──
  const { data: equipDocs, error: equipErr } = await supabase
    .from('documents')
    .select('id, doc_type_name, expiry_date, equipment_items(id, name, contractor_id)')
    .lte('expiry_date', in30Str)
    .not('expiry_date', 'is', null);

  if (equipErr) console.error('equipDocs error:', equipErr);

  for (const doc of (equipDocs || [])) {
    const exp   = new Date(doc.expiry_date!);
    const days  = Math.round((exp.getTime() - today.getTime()) / 86400000);
    const type  = classifyDays(days);
    if (!type) continue;
    const contractor_id = doc.equipment_items?.contractor_id;
    if (!contractor_id) continue;

    await supabase.from('notifications').upsert({
      contractor_id,
      type,
      entity_type:  'equipment_document',
      entity_id:    String(doc.id),
      entity_label: `${doc.equipment_items?.name} — ${doc.doc_type_name}`,
      days_until:   days,
      read:         false,
    }, { onConflict: 'contractor_id,entity_id,type', ignoreDuplicates: false });
  }

  // ── Clean up notifications older than 90 days ──
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 90);
  await supabase.from('notifications').delete().lt('created_at', cutoff.toISOString());

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
```

- [ ] **Deploy the Edge Function** (requires Supabase CLI):
```bash
# If supabase CLI is installed:
supabase functions deploy check-expiries --project-ref fslleuedqlxpjnerruzt

# Otherwise, deploy via Supabase Dashboard:
# → Functions → New Function → paste the code above
```

- [ ] **Set up the cron schedule in Supabase** — go to Supabase Dashboard → Integrations → Cron → Add cron job:
  - Name: `daily-expiry-check`
  - Schedule: `0 6 * * *` (06:00 UTC daily)
  - HTTP method: POST
  - URL: `https://fslleuedqlxpjnerruzt.supabase.co/functions/v1/check-expiries`
  - Headers: `Authorization: Bearer <your-anon-key>`

- [ ] **Test manually:** Trigger the function once from the dashboard or via `curl`. Then check `notifications` table in Table Editor — confirm rows appear for documents within 30 days.

- [ ] **Commit:**
```bash
git add supabase/functions/check-expiries/index.ts
git commit -m "feat: add Supabase Edge Function for daily expiry notification scan"
```

---

### Task 17: Notification Bell in App Header

**Files:**
- Modify: `index.html` (add bell to nav)
- Modify: `js/shared.js` (add notification fetch + polling)
- Modify: `styles.css` (bell and badge styles)

- [ ] **Add bell icon to nav in `index.html`** — find `<div class="nav-right">` and add before the logout button:

```html
<button class="notif-bell" id="notifBell" onclick="toggleNotifPanel()" aria-label="Notifications" aria-expanded="false">
  🔔
  <span class="notif-badge" id="notifBadge" hidden>0</span>
</button>
<div class="notif-panel" id="notifPanel" hidden aria-label="Notifications panel">
  <div class="notif-panel-header">
    <span>Notifications</span>
    <button class="notif-mark-read" onclick="markAllNotifsRead()">Mark all read</button>
  </div>
  <div id="notifList"><div class="notif-empty">No notifications</div></div>
</div>
```

- [ ] **Add notification CSS to `styles.css`:**

```css
/* ── Notification Bell ── */
.notif-bell { position:relative; background:none; border:none; cursor:pointer; font-size:18px; padding:4px 8px; color:var(--text-2); }
.notif-bell:hover { color:var(--text-1); }
.notif-badge { position:absolute; top:0; right:0; background:var(--bad,#ef4444); color:#fff; border-radius:999px; font-size:10px; font-weight:700; min-width:16px; height:16px; display:flex; align-items:center; justify-content:center; padding:0 4px; }
.notif-panel { position:absolute; top:52px; right:16px; width:320px; max-height:420px; overflow-y:auto; background:var(--surface-2,#1e293b); border:1px solid var(--border,#334155); border-radius:10px; box-shadow:0 8px 32px rgba(0,0,0,0.4); z-index:200; }
.notif-panel-header { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border); font-size:13px; font-weight:600; color:var(--text-1); }
.notif-mark-read { background:none; border:none; color:var(--accent,#f59e0b); font-size:12px; cursor:pointer; }
.notif-item { padding:10px 16px; border-bottom:1px solid var(--border); font-size:13px; }
.notif-item.unread { background:var(--surface-3,#334155); }
.notif-item-label { color:var(--text-1); margin-bottom:2px; }
.notif-item-meta  { color:var(--text-3); font-size:11px; }
.notif-empty { padding:20px 16px; color:var(--text-3); font-size:13px; text-align:center; }
.notif-critical { border-left:3px solid var(--bad,#ef4444); }
.notif-urgent   { border-left:3px solid var(--warn,#f59e0b); }
.notif-warning  { border-left:3px solid var(--accent,#f59e0b); opacity:0.85; }
/* nav needs position:relative for the panel to anchor */
#mainNav { position:relative; }
```

- [ ] **Add notification functions to `js/shared.js`** — insert before the closing of the IIFE or at the end of the file:

```js
// ─── Notifications ───
let _notifPanelOpen = false;
let _notifInterval  = null;

function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  const bell  = document.getElementById('notifBell');
  _notifPanelOpen = !_notifPanelOpen;
  panel.hidden = !_notifPanelOpen;
  bell.setAttribute('aria-expanded', String(_notifPanelOpen));
  if (_notifPanelOpen) loadNotifications();
}

// Close panel when clicking outside
document.addEventListener('click', e => {
  if (_notifPanelOpen && !e.target.closest('#notifBell') && !e.target.closest('#notifPanel')) {
    _notifPanelOpen = false;
    document.getElementById('notifPanel').hidden = true;
    document.getElementById('notifBell').setAttribute('aria-expanded', 'false');
  }
});

async function loadNotifUnreadCount() {
  const u = getUser();
  if (!u?.id) return;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/notifications?contractor_id=eq.${u.id}&read=eq.false&select=id`,
    { headers: { ...getHeaders(), Prefer: 'count=exact' } }
  );
  if (!res.ok) return;
  const count = parseInt(res.headers.get('Content-Range')?.split('/')[1] || '0', 10);
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.hidden = false; }
  else           { badge.textContent = '0'; badge.hidden = true; }
}

async function loadNotifications() {
  const u = getUser();
  if (!u?.id) return;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/notifications?contractor_id=eq.${u.id}&order=created_at.desc&limit=30`,
    { headers: getHeaders() }
  );
  if (!res.ok) return;
  const items = await res.json();
  const list  = document.getElementById('notifList');
  if (!items.length) { list.innerHTML = '<div class="notif-empty">No notifications</div>'; return; }

  list.innerHTML = items.map(n => {
    const typeClass = n.type === 'expiry_critical' ? 'notif-critical' : n.type === 'expiry_urgent' ? 'notif-urgent' : 'notif-warning';
    const daysText  = n.days_until === null ? '' : n.days_until <= 0 ? 'Expired' : `Expires in ${n.days_until}d`;
    return `<div class="notif-item ${n.read ? '' : 'unread'} ${typeClass}" onclick="markNotifRead('${n.id}',this)">
      <div class="notif-item-label">${esc(n.entity_label || '—')}</div>
      <div class="notif-item-meta">${daysText}</div>
    </div>`;
  }).join('');
}

async function markNotifRead(id, el) {
  el?.classList.remove('unread');
  await fetch(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${id}`, {
    method: 'PATCH', headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ read: true })
  });
  loadNotifUnreadCount();
}

async function markAllNotifsRead() {
  const u = getUser();
  if (!u?.id) return;
  await fetch(`${SUPABASE_URL}/rest/v1/notifications?contractor_id=eq.${u.id}&read=eq.false`, {
    method: 'PATCH', headers: { ...getHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ read: true })
  });
  loadNotifications();
  loadNotifUnreadCount();
}

function startNotifPolling() {
  loadNotifUnreadCount();
  _notifInterval = setInterval(loadNotifUnreadCount, 5 * 60 * 1000); // every 5 minutes
}

function stopNotifPolling() {
  clearInterval(_notifInterval);
}
```

- [ ] **Call `startNotifPolling()` on login** — in `js/auth.js`, find where the app transitions to the contractor page after login, and add `startNotifPolling()` there. Also call `stopNotifPolling()` in the `logout()` function.

- [ ] **Verify manually:** Manually insert a test notification into the `notifications` table via Supabase Table Editor (matching your test user's contractor_id). Reload the app → confirm the bell shows a badge with count. Click bell → panel opens with the test notification. Click notification → it marks as read, badge updates.

- [ ] **Commit:**
```bash
git add index.html styles.css js/shared.js js/auth.js
git commit -m "feat: in-app notification bell with unread count badge and 5-minute polling"
```

---

## Phase 5: Reporting & Bulk Operations

---

### Task 18: CSV Export Utility + Personnel Export

**Files:**
- Modify: `js/shared.js` (add `exportToCsv`)
- Modify: `js/personnel.js` (add export button + function)
- Modify: `index.html` (add export button to personnel list header)

- [ ] **Add `exportToCsv` utility to `js/shared.js`:**

```js
// ─── CSV Export ───
function exportToCsv(rows, filename) {
  if (!rows.length) { showToast('Nothing to export', 'warn'); return; }
  const headers = Object.keys(rows[0]);
  const escape  = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv     = [headers.map(escape).join(','), ...rows.map(r => headers.map(k => escape(r[k])).join(','))].join('\r\n');
  const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
```

- [ ] **Add `exportPersonnelCsv` function to `js/personnel.js`:**

```js
async function exportPersonnelCsv() {
  const h = getHeaders();
  const people = await apiFetch(`${SUPABASE_URL}/rest/v1/personnel?select=*&order=created_at`, { headers: h });
  if (!people) return;
  const personIds = people.map(p => p.id).join(',');
  let docs = [];
  if (personIds) docs = await apiFetch(`${SUPABASE_URL}/rest/v1/personnel_documents?personnel_id=in.(${personIds})&select=*`, { headers: h }) || [];
  const docsByPerson = {};
  docs.forEach(d => { (docsByPerson[d.personnel_id] = docsByPerson[d.personnel_id] || []).push(d); });

  const rows = people.map(p => {
    const pDocs    = docsByPerson[p.id] || [];
    const allMand  = PERS_DOC_TYPES.filter(t => t.mandatory).every(t => pDocs.some(d => d.doc_type_name === t.name));
    const earliest = pDocs.filter(d => d.expiry_date).map(d => d.expiry_date).sort()[0] || '';
    return {
      'Full Name':      p.full_name,
      'Position':       p.position || '',
      'National ID':    p.national_id || '',
      'Assessed':       p.assessed ? 'Yes' : 'No',
      'Next Expiry':    earliest,
      'Missing Mandatory Docs': allMand ? 'No' : 'Yes',
    };
  });
  exportToCsv(rows, `personnel-${new Date().toISOString().slice(0,10)}.csv`);
}
```

- [ ] **Add export button to the personnel list header in `index.html`** — find the personnel section header (near the "Add Personnel" button) and add:

```html
<button class="btn-ghost btn-sm" onclick="exportPersonnelCsv()" aria-label="Export personnel to CSV">↓ CSV</button>
```

- [ ] **Verify manually:** Click "↓ CSV" in the personnel section. Confirm a `.csv` file downloads. Open in Excel/Sheets → confirm columns and data are correct.

- [ ] **Commit:**
```bash
git add js/shared.js js/personnel.js index.html
git commit -m "feat: CSV export for personnel list"
```

---

### Task 19: Equipment CSV Export + Site Summary

**Files:**
- Modify: `js/equipment.js` (add export function)
- Modify: `js/operations.js` (add site summary print view)
- Modify: `index.html` (export buttons)

- [ ] **Add `exportEquipmentCsv` to `js/equipment.js`:**

```js
async function exportEquipmentCsv() {
  const h = getHeaders();
  const items = await apiFetch(`${SUPABASE_URL}/rest/v1/equipment_items?dismissed=is.false&parent_id=is.null&select=*,equipment_templates(name)&order=created_at`, { headers: h });
  if (!items) return;
  const ids  = items.map(i => i.id).join(',');
  let docs = [];
  if (ids) docs = await apiFetch(`${SUPABASE_URL}/rest/v1/documents?equipment_item_id=in.(${ids})&select=*`, { headers: h }) || [];
  const docsByItem = {};
  docs.forEach(d => { (docsByItem[d.equipment_item_id] = docsByItem[d.equipment_item_id] || []).push(d); });

  const rows = items.map(i => {
    const iDocs   = docsByItem[i.id] || [];
    const earliest = iDocs.filter(d => d.expiry_date).map(d => d.expiry_date).sort()[0] || '';
    return {
      'Name':         i.equipment_templates?.name || i.name || '',
      'Model':        i.model || '',
      'Serial Number':i.serial_number || '',
      'Assessed':     i.assessed ? 'Yes' : 'No',
      'Next Expiry':  earliest,
      'Docs':         iDocs.length,
    };
  });
  exportToCsv(rows, `equipment-${new Date().toISOString().slice(0,10)}.csv`);
}
```

- [ ] **Add equipment export button to `index.html`** — near the "Add Equipment" button:
```html
<button class="btn-ghost btn-sm" onclick="exportEquipmentCsv()" aria-label="Export equipment to CSV">↓ CSV</button>
```

- [ ] **Add `printSiteSummary` to `js/operations.js`** — call this from the site detail view:

```js
async function printSiteSummary() {
  const h = getHeaders();
  const [siteRes, persRes, equipRes] = await Promise.all([
    apiFetch(`${SUPABASE_URL}/rest/v1/operation_sites?id=eq.${currentSiteId}`, { headers: h }),
    apiFetch(`${SUPABASE_URL}/rest/v1/operation_site_personnel?site_id=eq.${currentSiteId}&select=*,personnel(full_name,position,national_id,expiry_date)`, { headers: h }),
    apiFetch(`${SUPABASE_URL}/rest/v1/operation_site_equipment?site_id=eq.${currentSiteId}&select=*,equipment_items(name,model,serial_number,expiry_date,equipment_templates(name))`, { headers: h }),
  ]);
  if (!siteRes || !persRes || !equipRes) return;
  const site = siteRes[0];
  const today = new Date().toLocaleDateString('en-GB');
  const persRows = persRes.map(r => `
    <tr>
      <td>${esc(r.personnel?.full_name || '—')}</td>
      <td>${esc(r.personnel?.position || '—')}</td>
      <td>${esc(r.personnel?.national_id || '—')}</td>
      <td>${esc(r.personnel?.expiry_date || '—')}</td>
    </tr>`).join('');
  const equipRows = equipRes.map(r => `
    <tr>
      <td>${esc(r.equipment_items?.equipment_templates?.name || r.equipment_items?.name || '—')}</td>
      <td>${esc(r.equipment_items?.model || '—')}</td>
      <td>${esc(r.equipment_items?.serial_number || '—')}</td>
      <td>${esc(r.equipment_items?.expiry_date || '—')}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Site Summary — ${esc(site.title)}</title>
    <style>
      body { font-family:Arial,sans-serif; font-size:12px; margin:20px; color:#000; }
      h1 { font-size:16px; margin-bottom:4px; }
      h2 { font-size:13px; margin:16px 0 6px; background:#1e3a5f; color:#fff; padding:5px 10px; }
      table { width:100%; border-collapse:collapse; margin-bottom:12px; }
      th { text-align:left; padding:5px 8px; font-size:11px; background:#e8edf2; border:1px solid #bbb; }
      td { padding:4px 8px; border:1px solid #ddd; font-size:11px; }
      .meta { color:#555; font-size:11px; margin-bottom:12px; }
      @media print { @page { size:A4; margin:12mm; } }
    </style>
  </head><body>
    <h1>Operation Site Summary</h1>
    <div class="meta"><strong>${esc(site.title)}</strong> · Printed ${today}</div>
    <h2>Personnel (${persRes.length})</h2>
    <table>
      <thead><tr><th>Name</th><th>Position</th><th>National ID</th><th>Expiry</th></tr></thead>
      <tbody>${persRows || '<tr><td colspan="4">No personnel assigned</td></tr>'}</tbody>
    </table>
    <h2>Equipment (${equipRes.length})</h2>
    <table>
      <thead><tr><th>Description</th><th>Model</th><th>Serial No.</th><th>Expiry</th></tr></thead>
      <tbody>${equipRows || '<tr><td colspan="4">No equipment assigned</td></tr>'}</tbody>
    </table>
    <div style="margin-top:16px;"><button onclick="window.print()" style="background:#1e3a5f;color:white;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;">🖨 Print / Save PDF</button></div>
  </body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
```

- [ ] **Add "Print Summary" button to the site detail view in `index.html`** — in the operations site detail header actions:
```html
<button class="btn-ghost btn-sm" onclick="printSiteSummary()">🖨 Print Summary</button>
```

- [ ] **Verify manually:** Open a site → click "Print Summary" → new tab opens with personnel and equipment tables. Click "Print / Save PDF" → print dialog appears.

- [ ] **Commit:**
```bash
git add js/equipment.js js/operations.js index.html
git commit -m "feat: equipment CSV export and operation site print summary"
```

---

### Task 20: Bulk Select UI for Personnel

**Files:**
- Modify: `js/personnel.js`
- Modify: `index.html`
- Modify: `styles.css`

- [ ] **Add bulk-mode state to `js/personnel.js`:**

```js
let _persBulkMode = false;
```

- [ ] **Add bulk mode toggle and bulk action functions to `js/personnel.js`:**

```js
function togglePersBulkMode() {
  _persBulkMode = !_persBulkMode;
  document.getElementById('persBulkBar').style.display = _persBulkMode ? 'flex' : 'none';
  document.getElementById('persBulkToggleBtn').textContent = _persBulkMode ? 'Cancel' : 'Select';
  document.querySelectorAll('#personnelList .bulk-check').forEach(cb => {
    cb.style.display = _persBulkMode ? 'block' : 'none';
    cb.checked = false;
  });
  updatePersBulkCount();
}

function updatePersBulkCount() {
  const count = document.querySelectorAll('#personnelList .bulk-check:checked').length;
  document.getElementById('persBulkCount').textContent = `${count} selected`;
}

async function bulkDeletePersonnel() {
  const checked = [...document.querySelectorAll('#personnelList .bulk-check:checked')];
  if (!checked.length) { showToast('Select at least one person', 'warn'); return; }
  const count = checked.length;
  if (!await showConfirm(`Delete ${count} personnel record${count > 1 ? 's' : ''}? This cannot be undone.`)) return;

  const ids = checked.map(cb => cb.dataset.id);
  const h   = { ...getHeaders(), Prefer: 'return=minimal' };
  await Promise.all(ids.map(id => Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/assessment_personnel?personnel_id=eq.${id}`, { method: 'DELETE', headers: h }),
    fetch(`${SUPABASE_URL}/rest/v1/personnel_documents?personnel_id=eq.${id}`, { method: 'DELETE', headers: h })
  ]).then(() => fetch(`${SUPABASE_URL}/rest/v1/personnel?id=eq.${id}`, { method: 'DELETE', headers: h }))));

  showToast(`${count} personnel record${count > 1 ? 's' : ''} deleted`, 'success');
  togglePersBulkMode();
  loadPersonnel();
}
```

- [ ] **Modify `personnelCard` in `js/personnel.js`** to include a hidden checkbox — add at the start of the returned card HTML, before `.card-header`:

```js
  return `<div class="app-card" data-id="p${parseInt(p.id)}">
    <input type="checkbox" class="bulk-check" data-id="${parseInt(p.id)}" style="display:${_persBulkMode ? 'block' : 'none'};margin:8px;" onchange="updatePersBulkCount()">
    <div class="card-header">
    ...
```

- [ ] **Add bulk bar and toggle button to `index.html`** — in the personnel section header (near the Add Personnel button):

```html
<button id="persBulkToggleBtn" class="btn-ghost btn-sm" onclick="togglePersBulkMode()">Select</button>

<!-- Bulk action bar (hidden by default) -->
<div id="persBulkBar" style="display:none;" class="bulk-bar">
  <span id="persBulkCount" class="bulk-count">0 selected</span>
  <button class="btn-danger btn-sm" onclick="bulkDeletePersonnel()">Delete Selected</button>
</div>
```

- [ ] **Add bulk bar CSS to `styles.css`:**

```css
/* ── Bulk Actions ── */
.bulk-bar { display:flex; align-items:center; gap:12px; padding:8px 0; flex-wrap:wrap; }
.bulk-count { font-size:13px; color:var(--text-3); }
.bulk-check { width:18px; height:18px; accent-color:var(--accent,#f59e0b); cursor:pointer; }
```

- [ ] **Verify manually:** Click "Select" → checkboxes appear on each card. Select 2 cards → counter updates. Click "Delete Selected" → confirm dialog shows count. Confirm → records deleted, mode exits.

- [ ] **Commit:**
```bash
git add js/personnel.js index.html styles.css
git commit -m "feat: bulk select and bulk delete for personnel list"
```

---

### Task 21: Bulk Select UI for Equipment

**Files:**
- Modify: `js/equipment.js`
- Modify: `index.html`

Follow the exact same pattern as Task 20 for equipment.

- [ ] **Add `_equipBulkMode` state and `toggleEquipBulkMode`, `updateEquipBulkCount`, `bulkDeleteEquipment` functions to `js/equipment.js`:**

```js
let _equipBulkMode = false;

function toggleEquipBulkMode() {
  _equipBulkMode = !_equipBulkMode;
  document.getElementById('equipBulkBar').style.display = _equipBulkMode ? 'flex' : 'none';
  document.getElementById('equipBulkToggleBtn').textContent = _equipBulkMode ? 'Cancel' : 'Select';
  document.querySelectorAll('#equipmentList .equip-bulk-check').forEach(cb => {
    cb.style.display = _equipBulkMode ? 'block' : 'none';
    cb.checked = false;
  });
  updateEquipBulkCount();
}

function updateEquipBulkCount() {
  const count = document.querySelectorAll('#equipmentList .equip-bulk-check:checked').length;
  document.getElementById('equipBulkCount').textContent = `${count} selected`;
}

async function bulkDeleteEquipment() {
  const checked = [...document.querySelectorAll('#equipmentList .equip-bulk-check:checked')];
  if (!checked.length) { showToast('Select at least one item', 'warn'); return; }
  const count = checked.length;
  if (!await showConfirm(`Delete ${count} equipment item${count > 1 ? 's' : ''} and all sub-items? This cannot be undone.`)) return;

  const ids = checked.map(cb => cb.dataset.id);
  const h   = { ...getHeaders(), Prefer: 'return=minimal' };
  await Promise.all(ids.map(id =>
    fetch(`${SUPABASE_URL}/rest/v1/equipment_items?id=eq.${id}`, { method: 'DELETE', headers: h })
  ));
  showToast(`${count} equipment item${count > 1 ? 's' : ''} deleted`, 'success');
  toggleEquipBulkMode();
  loadEquipment();
}
```

- [ ] **Add a hidden checkbox to each top-level equipment card** in the `equipmentCard` render function (similar to personnelCard). Add before the card header:

```js
return `<div class="app-card" data-id="${parseInt(item.id)}">
  <input type="checkbox" class="equip-bulk-check" data-id="${parseInt(item.id)}" style="display:${_equipBulkMode ? 'block' : 'none'};margin:8px;" onchange="updateEquipBulkCount()">
  <div class="card-header">
  ...
```

Note: Find the exact function that renders the top-level equipment card (search for `function equipCard` or similar in `equipment.js`).

- [ ] **Add bulk toggle button and bulk bar to `index.html`** equipment section:

```html
<button id="equipBulkToggleBtn" class="btn-ghost btn-sm" onclick="toggleEquipBulkMode()">Select</button>
<div id="equipBulkBar" style="display:none;" class="bulk-bar">
  <span id="equipBulkCount" class="bulk-count">0 selected</span>
  <button class="btn-danger btn-sm" onclick="bulkDeleteEquipment()">Delete Selected</button>
</div>
```

- [ ] **Verify manually:** Select mode works on equipment list. Bulk delete removes selected items and their sub-items (cascades via ON DELETE CASCADE in DB).

- [ ] **Commit:**
```bash
git add js/equipment.js index.html
git commit -m "feat: bulk select and bulk delete for equipment list"
```

---

## Phase 3–5 Complete

- [ ] **Full smoke test:** Login → check notification bell badge → open panel → open audit log in admin → export personnel CSV → try bulk delete on 2 personnel records → print site summary.
- [ ] **Check git log:** `git log --oneline -20`
- [ ] **Check Supabase Tables:** Confirm `audit_log` has entries, `notifications` table exists.
