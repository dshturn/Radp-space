# Architecture: RADP

## High-Level Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌───────────────┐
│  Web Browser    │◄──────►│  Vercel (Edge)   │◄──────►│  Supabase     │
│  (SPA App)      │         │  (Rewrites)      │         │  (DB + Auth)  │
│                 │         │                  │         │               │
│  vanilla JS     │         │  index.html      │         │  PostgreSQL   │
│  CSS            │         │  assets          │         │  Storage      │
│  HTML5          │         │                  │         │  REST API     │
└─────────────────┘         └──────────────────┘         └───────────────┘
        │                                                       │
        │                                                       │
        └──────────────── PWA (offline cache) ────────────────┘
```

**Stack**:
- **Frontend**: Vanilla JavaScript (no build, no framework)
- **Backend**: Supabase (managed PostgreSQL + Auth + Storage + REST API)
- **Deployment**: Vercel (SPA routing, edge headers for CSP)
- **Storage**: Supabase Storage (documents, PDFs, images)

## Frontend Architecture

### Pages (Single-Page App)

```
app.js (routing logic)
├── login-page (login + admin-login)
├── register-page (role-picker → registration form)
├── contractor-page (dashboard + personnel + equipment tabs)
├── assessment-page (list view + create/edit view)
├── operations-page (sites + site detail + personnel/equipment tabs)
└── admin-dashboard (future: KPI dashboard, user management)
```

### Modules

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `app.js` | Routing, page switching, session management | `showPage()`, `login()`, `register()`, `logout()` |
| `auth.js` | Supabase auth, token management, user state | `login()`, `register()`, `logout()`, `getUser()`, `getHeaders()` |
| `shared.js` | API client, utilities, modal/toast helpers | `apiFetch()`, `openModal()`, `showToast()`, `logAudit()` |
| `personnel.js` | Personnel CRUD, cert upload, expiry UI | `loadPersonnel()`, `openAddPersonnel()`, `uploadCert()` |
| `equipment.js` | Equipment templates + items, hierarchical tree | `loadEquipment()`, `openAddEquipment()`, `addEquipmentComponent()` |
| `assessment.js` | Assessment workflow (create, edit, submit, review) | `loadAssessments()`, `showCreate()`, `submitAssessment()` |
| `operations.js` | Site CRUD, site personnel/equipment assignment | `loadOperations()`, `createSite()`, `assignPersonnel()` |
| `admin.js` | User management, service lines, audit log viewer | `loadAuditLog()`, `manageUsers()` (under construction) |

### State Management

**Session storage** (browser memory):
```javascript
localStorage.radp_token       // JWT from Supabase Auth
localStorage.radp_user        // User object (id, email, role, company, service_line)
sessionStorage.radp_reg_role  // Temporary: role picker selection during registration
```

**Page-level globals**:
```javascript
let currentPage = null;
let currentAssessmentId = null;
let currentSiteId = null;
```

**Pagination state**:
```javascript
let _assessPage = 0, _equipPage = 0, _sitesPage = 0;
const _PAGE_SIZE = 25;
```

### UI Components

All built with vanilla HTML/CSS:
- Modals (`.modal`)
- Toasts (`.toast`)
- Cards (`.app-card`, `.sub-card`)
- Forms (validation on submit, no real-time validation)
- Badges (status indicators: `.badge-ok`, `.badge-warn`, `.badge-bad`)
- Tabs (simple class-based switching)

### Styling

**CSS architecture**:
- `styles.css` (~1400 lines): all styling
- **Dark theme only** (navy + amber for alerts)
- **Responsive**: grid-based layout, CSS media queries
- **No CSS framework**: utility classes + semantic BEM-ish naming

**Key classes**:
- `.container`, `.section`, `.row`, `.col`
- `.btn-main`, `.btn-ghost`, `.btn-danger` (buttons)
- `.badge-ok`, `.badge-warn`, `.badge-bad` (status)
- `.dash-tile` (dashboard cards)
- `.app-card`, `.sub-card` (hierarchical lists)

### Offline Support (PWA)

**Service Worker** (`sw.js`):
- Caches static assets (index.html, styles.css, js files)
- Caches API responses for read operations
- Falls back to cached data on network failure
- No sync queue (assessments cannot be submitted offline)

**Manifest** (`manifest.json`):
- App name: "RADP"
- Start URL: `/`
- Display: fullscreen (for field use)
- Icons: SVG maskable icon

## Backend Architecture

### Supabase Tables

#### Core Auth
- `auth.users` (managed by Supabase; email, password)
- `user_profiles` (custom extensions: role, company, service_line, status)

#### Core Data
- `companies` (contractor companies + 'Aramco')
- `service_lines` (slickline, coiled tubing, pumping, etc.; flagged as is_aramco for role-based visibility)
- `personnel` (people, with company_id and service_line; includes expiry tracking fields)
- `personnel_documents` (certs: file_path, document_type, expiry_date)
- `equipment_templates` (service_line-specific templates)
- `equipment_items` (actual equipment instances with parent_id for hierarchy)
- `assessments` (pre-mobilization assessments with status: draft/submitted/approved/rejected)
- `operation_sites` (job sites; personnel and equipment are assigned to sites)
- `operation_site_personnel` (assignment junction table)
- `operation_site_equipment` (assignment junction table)

#### Compliance
- `audit_log` (immutable record of all actions)
- `notifications` (alert system for status changes)

#### Aramco-specific
- `aramco_departments` (for Aramco operations/assessor users)
- `aramco_service_lines` (filtered list for Aramco registration)

### Authentication & Authorization

**Supabase Auth** (email/password):
```javascript
// Frontend
const { user, session } = await supabase.auth.signUp({ email, password });
// Returns JWT in session.access_token

// API calls
headers: {
  'Authorization': 'Bearer ' + token,
  'apikey': SUPABASE_ANON_KEY  // for REST API
}
```

**Row-Level Security (RLS)**:
```sql
-- Contractor sees only own data
create policy "contractor owns data"
  on personnel using (contractor_id = auth.uid());

-- Admin sees all data
create policy "admin sees all"
  on personnel using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );
```

### Data Flow: Assessment Submission

```
1. Contractor fills form (equipment, personnel, checklist items)
   ↓
2. Frontend validates locally, generates checklist
   ↓
3. POST /rest/v1/assessments with full payload
   → Supabase: inserts row, validates RLS, returns id
   ↓
4. Frontend logs audit event: { action: 'submitted', entity_id: assessment.id }
   → Supabase: inserts audit_log row
   ↓
5. Notification triggered: assessor@aramco.com receives email
   → (Future: Supabase Function webhook)
   ↓
6. Assessor reviews in app, clicks "Approve" or "Request Changes"
   → PATCH /rest/v1/assessments/{id} { status: 'approved' }
   ↓
7. Audit log recorded again
   ↓
8. Contractor sees status change in assessment list (polls every 30s)
```

### Supabase Functions

**Directory**: `/supabase/functions/`

- `check-expiries` (scheduled): runs daily, marks personnel/equipment expiring within 30 days
- (Future) `send-notifications`: webhook on assessment status change

### Database Migrations

**Location**: `/supabase/migrations/`

Schema evolution tracked with numbered files:
- `001_audit_log.sql` — audit logging table + RLS
- `002_notifications.sql` — notification system
- `003_user_roles.sql` — add role field
- `004_aramco_username.sql` — Aramco-specific fields
- `005_aramco_service_lines.sql` — service line filtering
- `006_aramco_departments.sql` — departments for Aramco users
- `007_personnel_doc_types.sql` — document type classification

### API Endpoints (Supabase REST)

All endpoints follow RESTful conventions:

```
GET    /rest/v1/personnel
POST   /rest/v1/personnel
GET    /rest/v1/personnel/{id}
PATCH  /rest/v1/personnel/{id}
DELETE /rest/v1/personnel/{id}

GET    /rest/v1/equipment_items
POST   /rest/v1/equipment_items
PATCH  /rest/v1/equipment_items/{id}

GET    /rest/v1/assessments
POST   /rest/v1/assessments
PATCH  /rest/v1/assessments/{id}

GET    /rest/v1/audit_log
```

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
apikey: {SUPABASE_ANON_KEY}
Content-Type: application/json
Prefer: count=exact  (for pagination total)
```

### File Storage

**Path structure**:
```
contractors/{contractor_id}/personnel/{personnel_id}/{document_uuid}.pdf
contractors/{contractor_id}/equipment/{equipment_id}/{file_uuid}.jpg
```

**Signed URLs** (10-min expiry):
```javascript
const { data: { publicUrl } } = await supabase.storage
  .from('documents')
  .getPublicUrl(path, { download: true });
```

## Deployment

### Vercel Configuration (`vercel.json`)

**Rewrites** (SPA routing):
```
/contractor → /index.html
/assessment → /index.html
/operations → /index.html
... etc
```

**Headers** (CSP, security):
```
Content-Security-Policy:
  - default-src 'self'
  - script-src 'self' 'unsafe-inline'  (inline app code)
  - connect-src 'self' https://*.supabase.co wss://*.supabase.co
  - img-src 'self' data: blob: https://*.supabase.co
  - style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
  - font-src 'self' https://fonts.gstatic.com
```

### Deployment Flow

1. Push to `main` branch
2. Vercel detects, builds (no build step needed, just deploys index.html + assets)
3. Static assets cached globally on Vercel Edge Network
4. All API requests proxy to Supabase

### Local Development

```bash
# Start Supabase locally
supabase start

# Runs PostgreSQL + Auth + Storage locally
# API endpoint: http://localhost:54321
# Docs: http://localhost:54321/docs (Swagger UI)

# Open app
python -m http.server 8000
# Visit http://localhost:8000
```

## Security

### Authentication
- Email/password via Supabase Auth (bcrypt hashing, managed)
- JWT tokens (10-min access, refresh token for auto-renewal)
- Tokens stored in `localStorage` (XSS risk mitigated by CSP)

### Authorization
- Row-level security on all tables (enforced at DB layer)
- Frontend checks user role before showing UI; backend enforces at API

### Data Protection
- All API traffic over HTTPS
- CSP prevents inline scripts (except app JS)
- No sensitive data in localStorage except JWT
- Audit log immutable (no delete, no update)

### Compliance
- PII: email, name stored in user_profiles (encrypted at rest by Supabase)
- Documents: PDFs stored in private Supabase Storage bucket, signed URLs only
- Audit trail: all user actions logged with timestamp, actor, metadata

## Scaling Considerations

### Current Bottlenecks
- **Token usage**: AI-driven assessment generation consumes ~50 tokens/assessment (can be optimized)
- **Code organization**: JS modules are large (assessment.js ~31KB); monolithic structure limits parallel development
- **Pagination**: all lists use offset-limit; may be slow at high offsets (switch to keyset pagination if needed)

### High-Traffic Scenario
- Supabase scales horizontally (managed service)
- Vercel edge caching handles static assets
- API rate limiting: none currently (add if abuse detected)
- Database: indexed on common queries (contractor_id, service_line, status)

### Optimization Opportunities
1. **Code splitting**: Break JS modules into smaller chunks, lazy-load pages
2. **API optimization**: GraphQL instead of REST (future); reduce N+1 queries
3. **Caching**: Add Redis layer for high-frequency reads (expiry status, templates)
4. **Assessment**: Pre-compute checklist items instead of AI generation

---

**Last updated**: 2026-04-24  
**Key decision makers**: Tech Lead, Aramco Ops  
**Next review**: When scaling or adding new major feature
