# Development Rules

Code style, git, database, and testing conventions.

## JavaScript

**Format**:
- 2 spaces indentation
- camelCase for functions/vars, UPPER_CASE for constants
- Single quotes, semicolons required
- Private vars prefix with `_` (e.g., `_equipPage`)

**Comments**: Only explain *why*, not *what*. Well-named functions are self-documenting.

```javascript
// Why: UTC boundaries match server batch processing.
// Timezone-aware dates cause 1-day offsets in scheduled jobs.
function daysUntilExpiry(certDate) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const cert = new Date(certDate);
  cert.setUTCHours(0, 0, 0, 0);
  return Math.round((cert - today) / 86400000);
}
```

**Section headers**:
```javascript
// ═══════════════════ ASSESSMENT ═══════════════════
```

## HTML / CSS

- Semantic tags (`<main>`, `<nav>`, `<section>`)
- ARIA labels for accessibility (`aria-label`, `aria-expanded`)
- Form labels with `for` attribute
- Dark theme only, navy + amber palette
- No framework; semantic BEM-ish naming (`.app-card`, `.is-active`)

## Git Workflow

### Commits

Type + description (50 chars max):
```
[feature] Add CSV bulk import for personnel
[fix] Personnel expiry timezone bug
[refactor] Extract assessment validation to utils
[docs] Update README
```

Atomic commits: one feature per commit.

### Branches

- `main` — production (always deployable)
- `feature/description` — feature work
- `hotfix/description` — urgent prod fixes

**Before pushing**:
- Test in browser (F12 console for errors)
- Run `supabase db lint`
- Rebase on latest `main`

### Pull Requests

Checklist:
- [ ] Code reviewed
- [ ] Tested (happy path + edge cases)
- [ ] No console errors
- [ ] Audit log entries added (if data-relevant)

## Database

### Migrations

Files in `/supabase/migrations/` numbered sequentially.

```sql
-- 008_add_equipment_condition.sql
-- Track condition (operational/maintenance/decommissioned)
-- Allows filtering equipment by availability in assessments.

alter table equipment_items 
  add column if not exists condition text default 'operational';
```

**Rules**:
- Idempotent (`if not exists`, `if exists`)
- Never drop columns/tables in prod
- Test locally: `supabase db push`

### Schema

- Tables: `plural_snake_case` (equipment_items)
- Primary keys: `id bigint ... generated always as identity`
- Foreign keys: `{table}_id` → `{table}.id`
- Timestamps: `created_at`, `updated_at`
- Statuses: text, not enum (easier to extend)
- RLS policies required on all user-facing tables

### Data Integrity

- Every user action = audit log entry
- Soft deletes only (use `dismissed` flag)
- Immutable: `audit_log`, `notifications` (no update/delete)
- Check constraints on status fields

## Frontend

### Forms

Validate on submit, not real-time:

```javascript
function addPersonnel() {
  const name = document.getElementById('name').value.trim();
  if (!name) {
    showToast('Name required', 'error');
    return;
  }
  // Submit...
}
```

### API Calls

Always use `apiFetch()` wrapper:

```javascript
const data = await apiFetch(url, {
  method: 'GET',
  headers: getHeaders()
});

if (!data) {
  if (response.status === 401) {
    // Token expired, re-login
    localStorage.removeItem('radp_token');
    showPage('login');
  }
  return;
}
```

### Audit Logging

Every data-changing action must log:

```javascript
async function approveAssessment(assessmentId) {
  await apiFetch(`${SUPABASE_URL}/rest/v1/assessments/${assessmentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved' })
  });
  
  await logAudit({
    entity_type: 'assessment',
    entity_id: String(assessmentId),
    action: 'approved',
    label: `Assessment ${assessmentId} approved`
  });
}
```

### Accessibility

- Every interactive element must have a label (visible or ARIA)
- Form inputs: `<label for="id">` + `<input id="id">`
- Buttons: text content or `aria-label`
- Color is not the only status indicator (use badges + text)

## Testing

**Manual checklist**:
- [ ] Happy path works
- [ ] Edge cases (empty state, 0 items, slow network)
- [ ] Form validation shows errors
- [ ] Mobile responsive
- [ ] Offline mode works
- [ ] All roles tested (contractor, assessor, ops, admin)
- [ ] Audit log entries created
- [ ] No console errors (F12)

**Browser support**: Chrome 90+, Safari 14+, Firefox 88+

## Performance

**Targets**:
- API response: < 500ms
- Page transition: < 300ms
- Page load: < 2 sec
- JS module: < 50KB each
- CSS: < 100KB
- Pagination: 25 items/page

**Techniques**:
- Lazy-load modals and off-screen content
- Index common queries (contractor_id, service_line)
- Cache stable data (templates, service lines)

## Security Checklist

Before deploying:
- [ ] No hardcoded secrets
- [ ] RLS policies tested for all roles
- [ ] File uploads validated (type + size)
- [ ] HTTPS enforced
- [ ] No sensitive data in audit log
- [ ] Tokens in localStorage (not URL)

## Deployment

**Pre-deployment**:
- [ ] Tested locally
- [ ] No console errors
- [ ] Audit logging works
- [ ] All 3 roles tested
- [ ] Mobile responsive
- [ ] Performance < 500ms API, < 2s page load

**Process**:
1. Create PR with changes
2. Code review + testing
3. Merge to `main`
4. Vercel auto-deploys (~1 min)
5. Smoke test in prod

## Tools

- Node.js 18+ (Supabase CLI)
- Git
- Modern browser (Chrome/Safari for testing)

---

**Last updated**: 2026-04-24
