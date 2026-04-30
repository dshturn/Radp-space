# Development Rules

Code style, git, database, and quality standards.

## JavaScript

Format:
- 2 spaces indentation
- camelCase for functions/vars, UPPER_CASE for constants
- Single quotes, semicolons required
- Comments explain why, not what

Naming:
- _private (underscore prefix for private state)
- onEventName for event handlers
- loadX for data fetch, showX for UI, addX for create

Section headers:
// ═══════════════════ ASSESSMENT ═══════════════════

## Data Validation

Client-side (UX feedback only):
- Form: required fields, email format, date sanity
- File upload: type check (PDF, JPG only), size < 10MB
- Never trust client validation for security

Server-side (enforced at DB):
- RLS policies (who can see what)
- Check constraints (status in ('draft', 'submitted', 'approved', 'rejected'))
- Foreign key constraints (crew must exist, certs must exist)
- Triggers (auto-set updated_at timestamp)

Expiry Validation:
// Use UTC midnight to match server batch jobs
function expiryStatus(certDate) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const cert = new Date(certDate);
  cert.setUTCHours(0, 0, 0, 0);
  const days = Math.round((cert - today) / 86400000);
  
  if (days <= 0) return 'expired';
  if (days <= 30) return 'warning';
  return 'valid';
}

## Git Workflow

Commits (atomic):
[feature] Add CSV bulk import for personnel
[fix] Expiry calculation timezone bug
[refactor] Extract audit logging to shared.js
[docs] Update README

Branches: main (production) | feature/name | hotfix/name

Before pushing:
- Test in browser (F12 console)
- Run supabase db lint
- Rebase on latest main

Pre-deployment:
- [ ] No console errors
- [ ] All 3 roles tested (contractor, assessor, admin)
- [ ] Mobile responsive
- [ ] Audit log entries created
- [ ] Offline mode works (read-only cached data)

## API Calls

Always use apiFetch() wrapper:

const data = await apiFetch(url, { headers: getHeaders() });
if (!data) {
  if (response.status === 401) { 
    localStorage.removeItem('radp_token'); 
    showPage('login'); 
  }
  return;
}

Headers:
function getHeaders() {
  const token = localStorage.getItem('radp_token');
  return {
    'Authorization': `Bearer ${token}`,
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  };
}

## Audit Logging

Every data mutation must log:

async function approveAssessment(assessmentId) {
  // 1. Make change
  await apiFetch(`/rest/v1/assessments/${assessmentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved' })
  });
  
  // 2. Log action (immutable)
  await logAudit({
    entity_type: 'assessment',
    entity_id: String(assessmentId),
    action: 'approved',
    label: `Assessment ${assessmentId} approved by ${user.email}`,
    metadata: { status_before: 'submitted', status_after: 'approved' }
  });
}

## Data Deduplication

When fetching related records (personnel with documents, equipment with certs):
- **Query filtering**: Only fetch documents for entities in current context (not system-wide)
  - Wrong: `fetch(/personnel_documents)` → returns ALL personnel docs
  - Right: `fetch(/personnel_documents?personnel_id=in.(1,2,3))` → only docs for these 3 people
- **Client-side deduplication**: Remove exact duplicates before rendering
  - Use Set to track already-seen combinations: `${entity_id}:${type_name}`
  - Filter array to keep only first occurrence of each combination
- **Apply to both frontend and backend**: Keep logic consistent across display and PDF generation

Example:
```javascript
const seenDocs = new Set();
const uniqueDocs = allDocs.filter(d => {
  const key = `${d.personnel_id}:${d.doc_type_name}`;
  if (seenDocs.has(key)) return false;
  seenDocs.add(key);
  return true;
});
```

## PDF Generation

Document-to-PDF conversion uses `html-pdf` library (wkhtmltopdf backend):
- **Link handling**: `<a href="...">text</a>` tags convert to clickable PDF annotations
- **HTML structure**: All styling must be inline (no external CSS)
- **Payload size**: Increased Express limit to 5MB for large HTML payloads
- **Error handling**: Always check response status; return user-friendly error message

Endpoints:
- `/api/generate-html-pdf`: Generic HTML→PDF conversion (for dynamic LoR display)
- `/api/generate-lor-pdf`: Assessment-specific LoR with data fetching and deduplication

## Performance

Targets:
- API call: < 500ms
- Page load: < 2s
- Field lookup (3G): < 2 min
- JS module: < 50KB each
- CSS: < 100KB
- PDF generation: < 3s for complex LoR tables

Optimization:
- Pagination: 25 items/page
- Lazy-load modals (don't render until opened)
- Cache stable data (templates, service lines, crew rosters)
- Index database on: contractor_id, service_line, status, created_at
- PDF queries: Fetch only assessment-specific data (not all records)

## Database Migrations

Location: /supabase/migrations/NNN_feature.sql

Rules:
- Idempotent (if not exists, if exists)
- Test locally: supabase db push
- Never drop columns/tables in production
- Use soft-delete (add dismissed flag)

Example:
-- 008_add_equipment_condition.sql
-- Track equipment condition for availability filtering.

alter table equipment_items 
  add column if not exists condition text default 'operational'
  check (condition in ('operational', 'maintenance', 'decommissioned'));

create index if not exists idx_equipment_condition 
  on equipment_items(condition);

## Accessibility

- Form labels: <label for="id">Name</label><input id="id">
- Buttons: text content or aria-label
- Color + text: never color alone for status (use badges)
- ARIA: aria-expanded, role="alert", etc.

## Security

Before deploying:
- [ ] No hardcoded secrets
- [ ] RLS policies tested for all roles
- [ ] File uploads validated (type + size)
- [ ] Tokens in localStorage (XSS mitigated by CSP)
- [ ] No PII in audit log (except actor email)

## Anti-Patterns

🚫 Rewriting full files (use Edit tool)
🚫 Explaining what code does (names should be clear)
🚫 Features beyond task scope
🚫 Long comments (only explain WHY non-obvious behavior)
🚫 New abstractions for 1–2 use cases
🚫 Ignoring existing code patterns

---

Owner: Tech Lead | Last updated: 2026-04-24
