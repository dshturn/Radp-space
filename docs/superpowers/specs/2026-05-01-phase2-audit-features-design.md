# RADP Phase 2 — Audit Features Design Spec
**Date:** 2026-05-01  
**Status:** Ready for Implementation  
**Scope:** Audit export, search, and admin notification features

---

## Context

Phase 1 (foundation + audit log viewer) is complete. Phase 2 adds export, search, and admin-action notifications to make the audit log operational for compliance reviews and accountability.

**Assumes**: Phase 1 complete (audit_log table, audit log viewer tab, error boundaries, toast system)

---

## Feature 1: Audit Log Export (PDF + CSV)

### Problem
Regulators require downloadable audit reports. Current audit log viewer is web-only, forcing manual screenshot/copy-paste for compliance documentation.

### Requirements
- **Export formats**: PDF (preferred for readability) and CSV (preferred for analysis)
- **Filters**: date range, entity type, action, contractor/actor
- **Output**: timestamped file (e.g., `audit_export_2026-05-01.pdf`)
- **Performance**: < 5s for 100-entry report, < 30s for 500-entry report
- **Permissions**: Admins export all; contractors export only their own company's audit trail
- **Data included**: timestamp, actor (name + company), entity type, entity name, action, metadata (if present)

### Design

#### 1.1 UI Layout

**Location**: Audit Log tab (admin-only view), new "Export" panel above the table.

```
┌─────────────────────────────────────────────┐
│ Audit Log Export                         [?] │
├─────────────────────────────────────────────┤
│ Date Range:  [From] _____ [To] _____        │
│ Entity Type: [Dropdown: All, Personnel...] │
│ Action:      [Dropdown: All, Created...] │
│ Contractor:  [Dropdown: All, Company A...] │ (admin only)
│                                             │
│ Format: ⦿ PDF   ◯ CSV                       │
│                                             │
│                     [Cancel] [Export]       │
└─────────────────────────────────────────────┘
```

**Interaction**:
- Dropdowns are optional; leaving blank means "all values"
- Date pickers use native `<input type="date">`
- Clicking Export shows a spinner ("Generating report...") and disables the button
- On success: browser downloads the file, spinner disappears, success toast shows
- On failure: error toast with reason (e.g., "Export failed: too many rows. Narrow date range and retry.")

#### 1.2 PDF Format

**Layout** (portrait, 8.5" × 11"):

```
┌────────────────────────────────────────────┐
│                                            │
│     READINESS ASSESSMENT DIGITAL PLATFORM  │
│              AUDIT LOG EXPORT              │
│                                            │
│  Date Range: 2026-04-01 to 2026-05-01     │
│  Generated:  2026-05-01 14:32 UTC         │
│  Filters:    Entity: Personnel             │
│              Action: All                   │
│                                            │
├────────────────────────────────────────────┤
│ Timestamp        │ Actor      │ Type   │ A… │
├────────────────────────────────────────────┤
│ 2026-05-01 10:15 │ Jane (A)   │ Person │ Up │
│ 2026-05-01 09:44 │ John (C)   │ Person │ Cr │
│ ...              │ ...        │ ...    │ .. │
├────────────────────────────────────────────┤
│ Total entries: 42                          │
│ Page 1 of 3                                │
└────────────────────────────────────────────┘
```

**Columns**:
- Timestamp (YYYY-MM-DD HH:MM UTC)
- Actor (Name, Company code in parentheses)
- Entity Type (Personnel, Equipment, Assessment, Site, User)
- Action (Created, Updated, Deleted, Approved, Rejected, Assigned, Uploaded — abbreviated if needed)
- Metadata (if present; first 50 chars, e.g., "Changed status to: approved")

**Pagination**: Page footer shows "Page X of Y"; 30 rows per page to keep report readable.

#### 1.3 CSV Format

**Headers**:
```
timestamp,actor_name,actor_company,entity_type,entity_id,entity_label,action,metadata_summary
```

**Example**:
```
2026-05-01T10:15:00Z,Jane Smith,Aramco,personnel,uuid-123,John Doe,updated,status_change: pending→approved
2026-05-01T09:44:00Z,John Contractor,AliBaba Energy,personnel,uuid-456,Jane Contractor,created,role: supervisor
```

**Notes**:
- `entity_label` is a human-readable name (person name, equipment name, assessment ID)
- `metadata_summary` is the first 100 chars of the metadata JSON (for import into Excel)
- All timestamps in ISO 8601 format (UTC)

#### 1.4 Backend Implementation

**Endpoint**: `POST /functions/v1/audit_export` (new Supabase Edge Function)

**Input** (request body):
```json
{
  "format": "pdf|csv",
  "from_date": "2026-04-01",
  "to_date": "2026-05-01",
  "entity_type": null,
  "action": null,
  "contractor_id": null
}
```

**Output**:
- PDF: returns binary blob, response header: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="..."`
- CSV: returns text, response header: `Content-Type: text/csv`

**Query Logic**:
1. Build WHERE clause from filters
2. Add RLS check: admin sees all rows; contractor sees only rows where `actor_id` matches OR `entity_id` is a row they own
3. ORDER BY created_at DESC
4. LIMIT 10000 (safety cap; show error if exceeds)
5. Format result into PDF or CSV
6. Return blob with download headers

**Performance Optimization**:
- Query audit_log with selective columns: `id, created_at, actor_id, entity_type, entity_id, action, metadata`
- Join auth.users once for actor name; no N+1 queries
- Use `batch` processing if > 1000 rows (process in 500-row chunks to avoid memory spike)

#### 1.5 Frontend Implementation

**Location**: `js/admin.js`, new `initExportPanel()` function

**Steps**:
1. Add HTML panel to Audit Log tab (hidden by default)
2. Add "Export" button above the audit table (shows/hides the panel)
3. Bind form submission to API call:
   - Collect form values
   - Call `POST /functions/v1/audit_export`
   - Handle response: if success, trigger download; if error, show toast
4. Manage button state: disabled during request, re-enabled after

**Code Pattern** (follows Phase 1 error boundary pattern):
```javascript
async function handleExportClick() {
  const format = document.querySelector('input[name="format"]:checked').value;
  const fromDate = document.querySelector('input[name="from_date"]').value;
  // ... collect other fields

  const exportBtn = document.querySelector('#export-button');
  exportBtn.disabled = true;
  showToast('Generating report...', 'info');

  try {
    const response = await apiFetch('/functions/v1/audit_export', {
      method: 'POST',
      body: { format, from_date: fromDate, ... }
    });
    
    // Trigger download
    const blob = new Blob([response], { type: format === 'pdf' ? 'application/pdf' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_export_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'csv'}`;
    a.click();
    showToast('Export complete', 'success');
  } catch (error) {
    showToast(`Export failed: ${error.message}`, 'error');
  } finally {
    exportBtn.disabled = false;
  }
}
```

**Testing**:
- [ ] Export 10, 50, 100, 500 entries; verify all present
- [ ] Verify RLS: contractor can't export other company's data
- [ ] Verify filters: date range, entity type, action all work independently and combined
- [ ] Verify PDF formatting: readable, no text overflow, proper pagination
- [ ] Verify CSV import into Excel: all columns present, UTF-8 encoding correct
- [ ] Performance: < 5s for 100 entries, < 30s for 500 entries
- [ ] Verify download filename includes date

---

## Feature 2: Audit Log Search (Real-Time)

### Problem
Audit log table shows all rows in date order. Finding a specific action requires scrolling or manually filtering. Need fast text search.

### Requirements
- **Search scope**: actor name, entity label, action
- **Performance**: < 200ms response (real-time as user types)
- **Interaction**: debounced search input, results update immediately
- **Scoping**: search respects current filters (date range, entity type)
- **Empty state**: if no results match, show "No audit entries found"

### Design

#### 2.1 UI Layout

**Location**: Audit Log tab, above the table, new search row.

```
┌─────────────────────────────────────────────┐
│ [🔍 Search logs...           🔄]            │
└─────────────────────────────────────────────┘
```

- Placeholder text: "Search logs by person, action, or entity..."
- Search icon on left
- Subtle spinner on right (appears during debounce window, ~100ms)
- Clears on Escape key
- Combines with existing filter dropdowns (date range, entity type, action)

#### 2.2 Query Strategy

**PostgREST query with ILIKE**:

Current audit log query (without search):
```
GET /rest/v1/audit_log?actor_id=eq.ACTOR_ID&created_at=gte.START_DATE&created_at=lte.END_DATE&order=created_at.desc&limit=50
```

With search:
```
GET /rest/v1/audit_log?actor_id=eq.ACTOR_ID&created_at=gte.START_DATE&created_at=lte.END_DATE&or=(actor_name.ilike.%SEARCH%,entity_label.ilike.%SEARCH%,action.ilike.%SEARCH%)&order=created_at.desc&limit=50
```

**Debounce**: 300ms. User stops typing, 300ms delay, then fire the query.

#### 2.3 Frontend Implementation

**Location**: `js/admin.js`, extend `initAuditLogTab()` function

**Steps**:
1. Add search input HTML to audit log tab
2. Bind input `keyup` event to debounced search handler
3. Debounced handler rebuilds the audit log query with search param
4. Show spinner during fetch; hide on completion
5. Update table rows; if empty, show "No results" message

**Code Pattern**:
```javascript
const searchInput = document.querySelector('#audit-search');
const debouncedSearch = debounce(async (query) => {
  const spinner = document.querySelector('#audit-search-spinner');
  spinner.style.display = 'block';

  try {
    // Rebuild table with new query (reuses existing loadAuditLog function with new search param)
    await loadAuditLog({ search: query, dateFrom, dateTo, entityType });
    spinner.style.display = 'none';
  } catch (error) {
    showToast(`Search failed: ${error.message}`, 'error');
    spinner.style.display = 'none';
  }
}, 300);

searchInput.addEventListener('keyup', (e) => {
  const query = e.target.value.trim();
  debouncedSearch(query);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchInput.value = '';
    debouncedSearch('');
  }
});
```

**Testing**:
- [ ] Search "John" finds all rows with "John" in actor_name or entity_label
- [ ] Search "created" finds all rows with action containing "created"
- [ ] Search is case-insensitive
- [ ] Debounce works: rapid typing fires only one query
- [ ] Empty search clears results and reloads all
- [ ] Search respects other filters (date range, entity type)

---

## Feature 3: Email Alerts on Admin Actions

### Problem
Contractors don't know when an admin edits their personnel/equipment records. This erodes transparency and accountability. Need notifications + emails.

### Requirements
- **Trigger**: Any PATCH/DELETE on personnel, equipment, documents by user with admin role
- **Action**: Insert notification record + queue email
- **Email content**: "Admin [name] edited your [personnel/equipment] record: [entity label]. [Change summary]"
- **Recipient**: contractor company admin (role = 'contractor' + is_company_admin = true)
- **Frequency**: Real-time trigger (immediate email; no digest batching for Phase 2)

### Design

#### 3.1 Database Schema

New table: `admin_action_notifications` (tracks sent notifications to avoid duplicates)

```sql
CREATE TABLE admin_action_notifications (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id uuid REFERENCES auth.users(id),
  admin_id    uuid REFERENCES auth.users(id),
  entity_type text NOT NULL,  -- 'personnel', 'equipment', 'document'
  entity_id   uuid NOT NULL,
  entity_label text,
  action      text NOT NULL,  -- 'updated', 'deleted'
  change_summary text,        -- e.g., "status_change: pending → approved"
  email_sent  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
```

#### 3.2 Postgres Trigger

When admin user UPDATEs or DELETEs personnel/equipment/document, trigger fires:

```sql
CREATE OR REPLACE FUNCTION notify_on_admin_action()
RETURNS TRIGGER AS $$
DECLARE
  admin_role text;
  contractor_id uuid;
  change_summary text;
BEGIN
  -- Check if updater is admin
  SELECT role INTO admin_role FROM auth.users WHERE id = current_user_id;
  IF admin_role != 'admin' THEN
    RETURN NEW;  -- Ignore non-admin actions
  END IF;

  -- Get contractor ID (owner of this entity)
  IF TG_TABLE_NAME = 'personnel' THEN
    SELECT company_id INTO contractor_id FROM personnel WHERE id = NEW.id;
    change_summary := CONCAT('Updated: ', NEW.name);
  ELSIF TG_TABLE_NAME = 'equipment' THEN
    SELECT company_id INTO contractor_id FROM equipment WHERE id = NEW.id;
    change_summary := CONCAT('Updated: ', NEW.name);
  -- ... similar for documents
  END IF;

  -- Insert notification
  INSERT INTO admin_action_notifications (
    contractor_id, admin_id, entity_type, entity_id, entity_label, action, change_summary
  ) VALUES (
    contractor_id, current_user_id, TG_TABLE_NAME, NEW.id, NEW.name, TG_OP, change_summary
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER personnel_admin_action AFTER UPDATE OR DELETE ON personnel
  FOR EACH ROW EXECUTE FUNCTION notify_on_admin_action();
```

**Complexity Note**: This approach requires `current_user_id` context from the JWT. Supabase edge functions can set this via `Authorization` header, but the trigger needs careful testing.

**Alternative (Simpler)**: Log admin actions in the application layer (JS) and send email from the frontend after successful API call. This avoids trigger complexity and is more testable.

#### 3.3 Email Service (Simpler Approach)

Instead of a Postgres trigger, handle in the application:

1. **In admin.js**, when updating/deleting personnel/equipment:
   ```javascript
   async function updatePersonnel(id, data) {
     const result = await apiFetch(`/rest/v1/personnel/${id}`, {
       method: 'PATCH',
       body: data
     });
     
     // On success, send notification email
     if (result) {
       await sendAdminActionEmail({
         contractor_id: data.company_id,
         admin_name: currentUser.email,
         entity_type: 'personnel',
         entity_label: result.name,
         action: 'updated'
       });
     }
     return result;
   }
   ```

2. **New endpoint**: `POST /functions/v1/send_admin_notification_email`
   - Input: contractor_id, admin_name, entity_type, entity_label, action
   - Queries contractors' admin email
   - Sends email via Resend or Supabase email

#### 3.4 Email Content

**Subject**: `RADP Alert: Record Updated`

**Body**:
```
Hello [Contractor Admin Name],

An administrator has updated your [personnel/equipment] record:

Entity:    [John Doe | Equipment XYZ-123]
Updated:   2026-05-01 10:15 UTC
By:        Jane Smith (Aramco)

Please log in to RADP to review the changes.

Questions? Contact your Aramco account manager.

---
READINESS ASSESSMENT DIGITAL PLATFORM
https://radp.example.com
```

**Assumptions**:
- Email service already configured (Resend or Supabase email)
- Contractor company admin email address in auth.users table

#### 3.5 Backend Implementation

**New Edge Function**: `send_admin_notification_email.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { contractor_id, admin_name, entity_type, entity_label, action } = await req.json();

  // Fetch contractor company admin email
  const { data: admin } = await supabase
    .from("auth.users")
    .select("email, full_name")
    .eq("id", contractor_id)
    .single();

  if (!admin) return new Response("Admin not found", { status: 404 });

  // Send email (example: Resend)
  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "noreply@radp.example.com",
      to: admin.email,
      subject: "RADP Alert: Record Updated",
      html: `<p>Hello ${admin.full_name},</p><p>An administrator has updated your ${entity_type} record: ${entity_label}</p>...`
    })
  });

  if (emailRes.ok) {
    // Log success
    return new Response(JSON.stringify({ sent: true }), { status: 200 });
  } else {
    console.error("Email send failed:", await emailRes.text());
    return new Response("Email send failed", { status: 500 });
  }
});
```

**Testing**:
- [ ] Admin edits personnel → contractor admin receives email within 1 min
- [ ] Email includes: entity name, what changed, admin name, timestamp
- [ ] Contractor from other company doesn't receive email (RLS respected)
- [ ] No email for non-admin edits
- [ ] Email service failure doesn't block the update (async, fire-and-forget)

---

## Feature 4: Code Refactoring (assessment.js Split)

### Problem
`js/assessment.js` is 31KB, hard to maintain. Functions for list view, create form, detail view, personnel add/remove, equipment add/remove are all mixed together. Splitting into modules improves readability and makes testing easier.

### Design

#### 4.1 Module Structure

**Before**: `js/assessment.js` (31KB, ~900 lines)

**After**:
- `js/assessment-list.js` — load list, pagination, search, filters, delete (500 lines)
- `js/assessment-create.js` — create form, submission, validation (250 lines)
- `js/assessment-detail.js` — detail view, tabs, readonly display (300 lines)
- `js/assessment-personnel.js` — add/remove personnel from assessment (150 lines)
- `js/assessment-equipment.js` — add/remove equipment from assessment (150 lines)
- `js/assessment-utils.js` — shared helpers: formatStatus, calculateExpiry, buildAssessmentUI (100 lines)

**Shared state**: Stored in window.assessmentState or a module closure; accessed via getters.

#### 4.2 Import Order (in index.html)

```html
<script src="js/assessment-utils.js"></script>
<script src="js/assessment-list.js"></script>
<script src="js/assessment-create.js"></script>
<script src="js/assessment-detail.js"></script>
<script src="js/assessment-personnel.js"></script>
<script src="js/assessment-equipment.js"></script>
```

**Rationale**: Utilities first, then list/create (most common), then detail + modals.

#### 4.3 Module Public Interface

Each module exports a single initialization function:

```javascript
// assessment-list.js
window.assessmentList = {
  init: async () => { /* load list, set up event listeners */ },
  render: async (filters) => { /* re-render with filters */ },
  clearSelection: () => { /* reset UI */ }
};

// assessment-create.js
window.assessmentCreate = {
  openForm: () => { /* show create form modal */ },
  close: () => { /* hide form, reset */ }
};

// assessment-detail.js
window.assessmentDetail = {
  open: async (id) => { /* fetch and display detail */ },
  close: () => { /* hide detail panel */ }
};
```

**Called from main flow**:
```javascript
// In shared.js router
if (currentPage === 'assessments') {
  assessmentList.init();
}
```

#### 4.4 No Behavior Changes

- All tests pass (if any exist)
- Same buttons, same flows, same validation
- Only code organization changes
- No new dependencies

#### 4.5 Migration Path

1. Create new files with code extracted from assessment.js
2. Update index.html script tags
3. Test all assessment flows (list, create, detail, add personnel, add equipment, delete)
4. Delete old assessment.js once confirmed working
5. Commit with message: "Refactor: split assessment.js into focused modules"

**Testing**:
- [ ] Assessment list loads and renders
- [ ] Create new assessment works
- [ ] View assessment detail works
- [ ] Add personnel to assessment works
- [ ] Remove personnel from assessment works
- [ ] Add equipment to assessment works
- [ ] Remove equipment from assessment works
- [ ] Delete assessment works with confirmation
- [ ] No console errors

---

## Implementation Priority & Timeline

| Feature | Owner | Effort | Dates | Blocker |
|---------|-------|--------|-------|---------|
| **Audit Export** | Dev 1 | 4d | May 2–7 | None |
| **Audit Search** | Dev 1 | 1d | May 8 | Export done |
| **Email Alerts** | Dev 2 | 2d | May 9–10 | None |
| **Code Refactor** | Dev 2 | 3d | May 11–13 | None |

**Total Phase 2 Effort**: 10 days (2 weeks with testing/buffer)

---

## Success Criteria

- [ ] Audit export works for PDF and CSV formats
- [ ] Export performance: < 5s for 100 entries
- [ ] RLS respected: contractors can't export other companies' data
- [ ] Audit search is real-time with 300ms debounce
- [ ] Email alerts send within 1 minute of admin action
- [ ] assessment.js split into 5 modules with no behavior changes
- [ ] All existing tests pass (or added if needed)
- [ ] Code review approved by tech lead
