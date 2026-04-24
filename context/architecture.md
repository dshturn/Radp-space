# Architecture: RADP

## System Diagram

```
Browser (vanilla JS)
        ↓ HTTPS
    Vercel (SPA routing + CSP headers)
        ↓
    Supabase (PostgreSQL + Auth + Storage)
        ↓
    Local cache (service worker, offline read)
```

## Frontend (index.html + JS modules)

Single-page app. No build step, no framework.

### Modules

| File | Purpose |
|------|---------|
| `app.js` | Routing (8 pages), session, role-based nav |
| `auth.js` | Login/register, JWT management |
| `shared.js` | API calls, modals, toast notifications, audit logging |
| `personnel.js` | Crew CRUD, doc upload, expiry badges |
| `equipment.js` | Equipment items, hierarchy (parent/child), templates |
| `assessment.js` | Submit/review pre-mob assessments |
| `operations.js` | Job sites, crew/equipment assignment |
| `admin.js` | User management, audit log search |

### Pages

- `login` → register → `contractor` (dashboard) or `assessment` (assessor) or `operations` (ops manager)
- All state in session storage (`radp_token`, `radp_user`)
- Pagination: 25 items/page

### Key Functions

```javascript
// Navigation
showPage('contractor')           // switch page with animation
PAGE_ORDER, PAGE_URLS            // routing tables

// API
apiFetch(url, options)           // wrapper with JWT + error handling
getHeaders()                     // adds Authorization + apikey

// UI
openModal('id'), closeModal()    // modal lifecycle
showToast(msg, type)             // success/error notifications
logAudit(...)                    // log action to audit_log table
```

### Offline (Service Worker)

Cache policy:
- Static assets: cache on first load
- API responses: cache on fetch (read-only, no write while offline)
- Fallback: show cached data if network fails

## Backend: Supabase

PostgreSQL database with Row-Level Security (RLS) enforced at DB layer.

### Tables

**Auth**:
- `auth.users` — email, password (Supabase managed)
- `user_profiles` — role (contractor/assessor/operations/admin), company, service_line, status

**Data**:
- `companies` — contractor companies + Aramco
- `service_lines` — slickline, coiled tubing, pumping, etc. (flagged: is_aramco)
- `personnel` — crew members (company_id, service_line)
- `personnel_documents` — cert uploads (file_path, type, expiry_date)
- `equipment_templates` — service-line-specific templates (slickline, CT, pump)
- `equipment_items` — actual gear instances (parent_id for hierarchy)
- `assessments` — pre-mob requests (status: draft/submitted/approved/rejected)
- `operation_sites` — job sites (crew + equipment assigned here)
- `operation_site_personnel` — crew roster per site
- `operation_site_equipment` — equipment manifest per site

**Compliance**:
- `audit_log` — immutable (every action logged)
- `notifications` — status change alerts

### API Endpoints (REST)

```
GET    /rest/v1/personnel?contractor_id=eq.{id}
POST   /rest/v1/personnel { name, company_id, ... }
PATCH  /rest/v1/personnel/{id} { name, ... }
DELETE /rest/v1/personnel/{id}  → soft-delete (dismissed flag)

GET    /rest/v1/equipment_items?parent_id=is.null
POST   /rest/v1/equipment_items
PATCH  /rest/v1/equipment_items/{id}

GET    /rest/v1/assessments?contractor_id=eq.{id}
POST   /rest/v1/assessments { equipment_roster, personnel_roster, ... }
PATCH  /rest/v1/assessments/{id} { status: 'approved' }

GET    /rest/v1/audit_log?entity_type=eq.assessment&created_at=gte.{date}
```

**Headers**:
```
Authorization: Bearer {JWT}
apikey: {ANON_KEY}
Prefer: count=exact  (for pagination total)
```

### Data Flow: Assessment

```
1. Contractor fills form (select equipment, select crew, confirm checklist)
2. Frontend validates, POSTs to /assessments
3. Supabase RLS: check contractor_id = auth.uid() → allow
4. Row inserted, returns assessment.id
5. Frontend: POST to /audit_log { action: 'submitted', entity_id: assessment.id }
6. Notification: email assessor@aramco.com (via Supabase Function, future)
7. Assessor reviews in app, PATCHes { status: 'approved' }
8. Audit log: { action: 'approved', actor_id: assessor_id }
9. Contractor sees status change (polls every 30s)
```

### Row-Level Security

```sql
-- Contractors see own data
select contractor_id = auth.uid()

-- Admins see all
select exists (
  select 1 from user_profiles 
  where id = auth.uid() and role = 'admin'
)

-- Assessors see submitted assessments (read-only)
select status = 'submitted'
```

### File Storage

Path structure:
```
contractors/{contractor_id}/personnel/{personnel_id}/{doc_uuid}.pdf
contractors/{contractor_id}/equipment/{equipment_id}/{doc_uuid}.jpg
```

Signed URLs (10-min expiry):
```javascript
const { publicUrl } = supabase.storage
  .from('documents')
  .getPublicUrl(path, { download: true });
```

## Deployment

### Vercel Config

**SPA rewrites**:
```json
{ "source": "/contractor", "destination": "/index.html" }
{ "source": "/assessment", "destination": "/index.html" }
```

**CSP headers** (security):
```
default-src 'self'
script-src 'self' 'unsafe-inline'  (inline app code)
connect-src 'self' https://*.supabase.co
img-src 'self' data: blob:
```

**Flow**:
1. Push to `main`
2. Vercel deploys in ~1 min
3. Assets cached globally on edge network
4. API calls routed to Supabase

### Local Development

```bash
supabase start
# PostgreSQL + Auth + Storage on localhost:54321

python -m http.server 8000
# App on localhost:8000
```

**Test**: http://localhost:8000 (with local Supabase backend)

## Security

### Auth
- Email/password via Supabase (bcrypt, managed)
- JWT tokens (10 min access, refresh token)
- Tokens in localStorage (XSS mitigated by CSP)

### Authorization
- RLS on all tables (enforced at DB, not app)
- Frontend role check (UX); backend enforces (security)
- Admin role required for system-level actions

### Data
- HTTPS enforced
- CSP prevents inline script injection
- No hardcoded secrets (env vars only)
- Audit log immutable (no delete, no update)
- PII: encrypted at rest by Supabase

## Performance Targets

- API response: < 500ms (field users on 3G)
- Page load: < 2 sec
- Page transition: < 300ms
- JS module: < 50KB each (app.js at limit)

### Optimization Done
- Pagination: 25 items/page
- Lazy-load modals
- Service worker cache (offline read)

### Still Needed
- Break assessment.js into smaller files
- Add database indexes on contractor_id, service_line
- Reduce AI token usage (pre-compute checklists)

## Bottlenecks

1. **AI token burn**: ~50 tokens/assessment (needs pre-computation)
2. **Code size**: assessment.js is 31KB (needs modularization)
3. **N+1 queries**: some lists fetch one-by-one (use batch queries)

---

**Owner**: Tech Lead  
**Last updated**: 2026-04-24
