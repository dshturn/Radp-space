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

## Performance

Targets:
- API call: < 500ms
- Page load: < 2s
- Field lookup (3G): < 2 min
- JS module: < 50KB each
- CSS: < 100KB

Optimization:
- Pagination: 25 items/page
- Lazy-load modals (don't render until opened)
- Cache stable data (templates, service lines, crew rosters)
- Index database on: contractor_id, service_line, status, created_at

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
