# Development Rules & Conventions

Guidelines for maintaining code quality, consistency, and readiness for Aramco's high-reliability standards.

## Code Style

### JavaScript

**Format**:
- Indentation: 2 spaces (no tabs)
- Line length: ~100 characters soft limit (comments/strings can exceed)
- Semicolons: required
- Quotes: single quotes for strings, backticks for templates

**Naming**:
- `camelCase` for functions and variables
- `UPPER_CASE` for constants
- `PascalCase` for classes (if used)
- Prefix private vars with `_` (e.g., `_equipPage`, `_assessPage`)
- Prefix jQuery-style DOM queries with `El` or `$` (e.g., `modalEl`, `$form`)

**Comments**:
- Only write comments that explain *why*, not *what*
- Section headers as ASCII dividers (see app.js style: `// ═══════════════ FEATURE ═══════════════`)
- Avoid over-commenting; well-named functions are self-documenting

**Example**:
```javascript
// ── Personnel expiry calculation ──
// Expired certs don't trigger warnings; they simply fail RLS on assignment.
// Days calculation uses UTC to avoid timezone confusion in batch processing.
function daysUntilExpiry(certDate) {
  if (!certDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cert = new Date(certDate);
  cert.setHours(0, 0, 0, 0);
  return Math.round((cert - today) / 86400000);
}
```

### HTML

- Semantic elements: `<main>`, `<nav>`, `<section>` (not div wrappers)
- ARIA attributes for accessibility: `aria-label`, `aria-expanded`, `role`
- Form labels always associated (explicit `for` attribute)
- Data attributes for JS hooks: `data-id`, `data-status`

### CSS

**Organization**:
- Group by component/feature (not property type)
- Custom properties for colors: `--color-ok`, `--color-warn`, `--color-bad`
- Utility classes for spacing: `.mb-0`, `.mt-1`, `.gap-1`

**Naming**:
- BEM-inspired: `.component`, `.component__element`, `.component--modifier`
- Status classes: `.is-active`, `.is-disabled`
- State classes: `.has-error`, `.is-loading`

**Dark theme**:
- Base colors: `--bg-dark` (#0f172a), `--bg-card` (#1e293b), `--text-light` (#e2e8f0)
- Alert colors: `--color-ok` (#10b981), `--color-warn` (#f59e0b), `--color-bad` (#ef4444)
- All new features must work in dark mode only; no light mode support

## Git Workflow

### Commits

**Rules**:
- One feature or fix per commit (atomic commits)
- No merge commits (rebase, don't merge from main)
- Message format: `[type] brief description` (50 chars max)

**Types**:
- `[feature]` — new capability
- `[fix]` — bug fix
- `[refactor]` — non-behavioral code change
- `[docs]` — documentation or comments
- `[style]` — formatting, no logic change
- `[test]` — test additions or fixes

**Examples**:
```
[feature] Add bulk personnel import from CSV
[fix] Personnel expiry calculation timezone bug
[refactor] Extract assessment validation to shared module
[docs] Update README with deployment steps
```

### Branches

- `main` — production-ready code, always deployable
- Feature branches: `feature/description` (created for review, deleted after merge)
- Hotfix branches: `hotfix/description` (for urgent production fixes)

**Before pushing**:
- Rebase on latest `main`
- Test locally in browser
- Run `supabase db lint` to catch SQL issues
- Check console for errors (F12 DevTools)

### Pull Requests

**Required before merge**:
- [ ] Code review by at least one peer
- [ ] Testing: happy path + edge cases
- [ ] No console errors or warnings
- [ ] Audit log entries created for compliance-relevant actions

**PR description template**:
```
## What
Brief description of change

## Why
Context or issue being addressed

## How to test
Steps to verify the change works

## Checklist
- [ ] Tested locally
- [ ] No breaking changes
- [ ] Audit logging added (if data/compliance-relevant)
```

## Database

### Migrations

**Rules**:
- Always create `.sql` file in `/supabase/migrations/`
- Number sequentially: `008_feature_name.sql`
- Use `if not exists` / `if exists` to make idempotent
- Test locally: `supabase db push`
- Never drop columns or tables in production

**Example**:
```sql
-- 008_add_equipment_condition.sql
-- Track condition of equipment (operational/maintenance/decommissioned)
-- Allows filtering equipment by availability in assessments.

alter table equipment_items add column if not exists condition text default 'operational';
create index if not exists idx_equipment_condition on equipment_items(condition);
```

### Schema Conventions

- Table names: `plural_snake_case` (equipment_items, not equipment_item)
- Primary keys: `id bigint primary key generated always as identity` (serial IDs)
- Foreign keys: end with `_id`, reference primary key of target table
- Timestamps: `created_at` and `updated_at` on all tables
- Flags: boolean columns (nullable if optional, not null default false if required)
- Statuses: text enum values stored as varchar (not enum type; simpler to extend)

**RLS policy naming**:
- `{table}_can_{action}_{subject}` (e.g., `personnel_can_view_own_docs`)
- Always test in Supabase Studio to ensure rule works

### Data Integrity

- All user-actionable data must have corresponding audit log entry
- Soft deletes only: use `dismissed` or `status = 'archived'` flag (don't hard delete)
- Immutable tables: `audit_log`, `notifications` (no update/delete)
- Check constraints on status fields: `status in ('draft', 'submitted', 'approved', 'rejected')`

## Frontend

### Page Routing

- Add page to `PAGE_ORDER` and `PAGE_URLS` dictionaries in app.js
- Register RLS policies for new data tables
- Test navigation with different user roles

### Form Validation

**Rule**: Validate on submit, not in real-time (reduces API calls)

```javascript
function addPersonnel() {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const errors = [];
  
  if (!name) errors.push('Name required');
  if (!email || !email.includes('@')) errors.push('Valid email required');
  
  if (errors.length > 0) {
    showToast(errors.join('; '), 'error');
    return;
  }
  
  // Proceed with submission...
}
```

### API Calls

**Always use `apiFetch()` wrapper** (defined in shared.js):
```javascript
const data = await apiFetch(url, {
  method: 'GET',
  headers: getHeaders()  // adds JWT + apikey
});
```

**Patterns**:
- GET for reads (no side effects)
- POST for creates
- PATCH for updates (partial)
- DELETE for hard deletes (rare; usually soft delete instead)

**Error handling**:
```javascript
if (!response.ok) {
  if (response.status === 401) {
    // Token expired, re-login
    localStorage.removeItem('radp_token');
    showPage('login');
  } else {
    showToast('Failed to load data', 'error');
  }
  return null;
}
```

### Audit Logging

**Every user action that changes data must log an audit entry**:

```javascript
async function approveAssessment(assessmentId) {
  await apiFetch(`${SUPABASE_URL}/rest/v1/assessments/${assessmentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved' })
  });
  
  // Log the action
  await logAudit({
    entity_type: 'assessment',
    entity_id: String(assessmentId),
    action: 'approved',
    label: `Assessment ${assessmentId} approved`,
    metadata: { status_before: 'submitted', status_after: 'approved' }
  });
}
```

See `logAudit()` in shared.js for implementation.

### Accessibility

- Every interactive element must have a label (visible or ARIA)
- Form inputs require `<label>` with `for` attribute
- Buttons require text content or `aria-label`
- Links must be real `<a>` tags or buttons (not divs with click handlers)
- Color must not be the only way to convey information (use badges + text)

**Example**:
```html
<!-- Good -->
<button class="badge-ok" aria-label="Approved">✓</button>

<!-- Bad -->
<div class="badge-ok" onclick="approve()"></div>
```

## Testing

### Manual Testing Checklist

Before marking a feature complete:

- [ ] All happy paths work (happy path testing)
- [ ] Edge cases handled (empty state, 0 items, max items, slow network)
- [ ] Form validation shows meaningful error messages
- [ ] Mobile responsiveness (test on phone/tablet)
- [ ] Offline mode works (disable network, reload, verify cached data loads)
- [ ] User roles tested (contractor, assessor, operations, admin)
- [ ] Audit log entries created correctly
- [ ] No console errors (F12 DevTools)
- [ ] Cross-browser (Chrome, Safari, Firefox)

### Browser Support

- Chrome/Edge 90+
- Safari 14+
- Firefox 88+
- Mobile: iOS Safari 14+, Chrome Android 90+

## Performance

### Rules

- **API responses**: must return < 500ms for field users (may be on slow 3G)
- **Page transitions**: < 300ms (animation + render)
- **Pagination**: 25 items per page default (balance between load time and scroll depth)
- **Asset sizes**:
  - JS modules: < 50KB each (app.js is at limit; consider splitting)
  - CSS: < 100KB (current: 43KB, ok)
  - Images: optimize before upload (no uncompressed PNGs/JPEGs)

### Optimization Techniques

- Lazy-load modals and off-screen content
- Use `loading="lazy"` for images
- Defer non-critical JS with `async`/`defer`
- Index common queries in Supabase (e.g., contractor_id, service_line)
- Cache stable data in localStorage (templates, service lines)

## Security Checklist

Before deploying:

- [ ] No hardcoded secrets (API keys in env vars only)
- [ ] All user inputs sanitized (no SQL injection possible via RLS)
- [ ] File uploads validated (type + size check)
- [ ] HTTPS enforced (CSP headers in Vercel config)
- [ ] JWT tokens not exposed in URL (stored in localStorage)
- [ ] No sensitive data in audit log metadata (passwords, cert scans)
- [ ] RLS policies tested for all roles
- [ ] CORS policy reviewed (Supabase handles this)

## Documentation

### Code Comments

Write comments for the *why*, not the *what*:

```javascript
// Why: Days calculation uses UTC boundaries to match server-side batch processing.
// Timezone-aware date math causes discrepancies in scheduled jobs.
function daysUntilExpiry(dateStr) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);  // UTC, not local
  const cert = new Date(dateStr);
  cert.setUTCHours(0, 0, 0, 0);
  return Math.round((cert - today) / 86400000);
}
```

### README Updates

- Update README.md when adding new features or major changes
- Keep `/context/*.md` files in sync with code decisions
- Add migration instructions if breaking changes

## Deployment

### Pre-Deployment Checklist

- [ ] All tests pass
- [ ] No console errors in DevTools
- [ ] Tested in production-like environment (use supabase start)
- [ ] Audit logging working
- [ ] No secrets in code or logs
- [ ] Performance acceptable (load times < 500ms)
- [ ] Mobile-responsive
- [ ] All 3 roles tested (contractor, assessor, admin)

### Deployment Process

1. Create PR with changes
2. Code review + testing
3. Merge to `main`
4. Vercel auto-deploys within 1 min
5. Smoke test in production
6. Document changes in CHANGELOG (if applicable)

## Tools & Environment

### Required

- Node.js 18+ (for Supabase CLI)
- Git
- Text editor (VS Code recommended)
- Modern browser (Chrome/Safari for testing)

### Recommended Extensions (VS Code)

- Prettier (auto-format)
- ESLint (code quality)
- SQLTools (SQL syntax highlighting)
- Supabase CLI integration (if available)

### Local Development Stack

```bash
# Install Supabase CLI
npm install -g supabase

# Start Supabase
supabase start

# Run app (Python)
python -m http.server 8000

# Access at http://localhost:8000
```

---

**Last updated**: 2026-04-24  
**Author**: Technical Lead  
**Adherence**: Mandatory for all commits to main
