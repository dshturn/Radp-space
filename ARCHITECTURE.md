# RADP Architecture (May 2026)

## Overview

RADP is a **serverless, frontend-centric application** with zero backend servers. All business logic runs in the browser, and all data operations go directly to Supabase via authenticated REST API calls.

```
┌──────────────────────────────────────────────────────┐
│ Browser (SPA)                                        │
│ ├─ HTML/CSS/JS (static)                            │
│ ├─ Session management (localStorage)               │
│ └─ RLS-enforced data fetching                      │
└────┬────────────────────────────────────┬───────────┘
     │ HTTP                               │ HTTPS
     ▼                                     ▼
┌──────────────────┐          ┌─────────────────────────┐
│ Vercel           │          │ Supabase                │
│ (Static + Edge)  │          │ (PostgreSQL + Auth)     │
├──────────────────┤          ├─────────────────────────┤
│ index.html       │──────→   │ /auth/v1/*              │
│ /js/*.js         │ (API     │ /rest/v1/*              │
│ /styles.css      │  proxy)  │ /storage/v1/*           │
│ /api/index.js    │          │                         │
└──────────────────┘          └─────────────────────────┘
  (radp.space)          (fslleuedqlxpjnerruzt.supabase.co)
```

---

## Frontend (Browser)

### Technology
- **Language**: Vanilla JavaScript (no build step, no framework)
- **HTML**: Static files served from Vercel
- **Styling**: CSS3 (flexbox, grid, media queries)
- **Storage**: localStorage (session token + user profile)
- **State**: In-memory variables + DOM as source of truth

### Key Files
- `index.html` — SPA with 8 pages (login, contractor, admin, etc)
- `js/shared.js` — Auth, fetch utilities, UI helpers
- `js/auth.js` — Login/logout/registration
- `js/assessment.js` — LoR workflows, client-side PDF
- `js/personnel.js`, `js/equipment.js`, `js/operations.js` — CRUD operations
- `js/admin.js` — Admin approval workflows
- `styles.css` — Responsive design
- `sw.js` — Service worker for PWA (offline-first caching)

### Data Flow

1. **Authentication**
   ```
   User enters email + password
   → POST /auth/v1/token → Supabase
   → Returns JWT access_token
   → Browser stores in localStorage
   → Adds to Authorization header on subsequent requests
   ```

2. **Data Operations**
   ```
   Browser JS calls: fetch(SUPABASE_URL/rest/v1/assessments, {
     headers: {
       apikey: SUPABASE_ANON_KEY,
       Authorization: Bearer {JWT}
     }
   })
   → Vercel Function api/index.js forwards to Supabase
   → Supabase RLS filters results based on auth.uid()
   → Returns JSON to browser
   ```

3. **PDF Generation**
   ```
   User clicks "Generate LoR"
   → Client-side: fetch data from Supabase
   → Build HTML table in JavaScript
   → Open in new window with window.print() button
   → User clicks print → browser print dialog → "Save as PDF"
   ```

---

## API Proxy (Vercel Function)

### File: `api/index.js`

```javascript
export default async (req, res) => {
  const endpoint = req.query.endpoint;  // e.g., "/rest/v1/assessments"
  const token = req.headers.authorization;
  
  // Forward to Supabase with credentials
  const response = await fetch(
    SUPABASE_URL + endpoint,
    {
      method: req.method,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: token,
        ...req.headers
      },
      body: req.body
    }
  );
  
  return response;
}
```

**Why we need it**:
- Hide `SUPABASE_ANON_KEY` from browser (security best practice)
- CORS handling (Vercel endpoint same-origin as frontend)
- Optional logging/rate-limiting (not currently used)

**Alternative**: If keys weren't a concern, browser could call Supabase directly (Supabase CORS is permissive for anon key).

---

## Database (Supabase PostgreSQL)

### Key Tables

**Authentication** (Supabase managed):
```sql
auth.users (id, email, encrypted_password, etc)
```

**Custom Data**:
```sql
user_profiles (id → auth.users, role, company, service_line, status)
assessments (id, contractor_id, field_well, status, created_at)
assessment_personnel (assessment_id, personnel_id)
assessment_equipment (assessment_id, equipment_items_id)
personnel (id, full_name, position, service_line, expiry_certs[])
equipment_items (id, parent_id, serial_number, model, certification_expiry)
documents (id, file_url, expiry_date)
audit_log (actor_id, entity_type, entity_id, action, metadata, created_at)
```

### Row-Level Security (RLS)

Every table has RLS policies enforced at the database layer. Example:

```sql
-- Contractors can only see their own assessments
CREATE POLICY "contractors read own assessments"
  ON assessments FOR SELECT
  USING (contractor_id = auth.uid());

-- Admins see all
CREATE POLICY "admins read all assessments"
  ON assessments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

When a browser makes a request with `Authorization: Bearer {JWT}`, Supabase extracts `auth.uid()` from the token and applies RLS filters **before returning any rows**. The browser can't bypass this — it's enforced at the database layer.

### Storage

Supabase Storage buckets for:
- `/personnel-documents` — cert scans, medicals
- `/equipment-documents` — inspection reports, certifications
- `/assessment-exports` — generated PDFs (optional, usually printed)

---

## Request Lifecycle

### 1. Load Assessment List (Contractor)

```
[Browser]
  └─ apiFetch(`SUPABASE_URL/rest/v1/assessments?contractor_id=eq.{userId}`)
     └─ shared.js fetch interceptor converts to `/api?endpoint=...`
       
[Vercel Function: api/index.js]
  └─ Decode endpoint: /rest/v1/assessments?contractor_id=eq.{userId}
  └─ Forward to Supabase with ANON_KEY + user's JWT
  └─ Return response
  
[Supabase]
  └─ Verify JWT → auth.uid() = {userId}
  └─ Apply RLS: WHERE contractor_id = {userId}
  └─ Return only user's assessments
  
[Browser]
  └─ Receive JSON, render assessment list
```

### 2. Submit Assessment

```
[Browser]
  └─ fetch(POST, `/api?endpoint=/rest/v1/assessments`, {
       body: {field_well, company, status, ...}
     })
       
[Vercel Function]
  └─ Forward POST to Supabase with body
  
[Supabase]
  └─ RLS policy: contractor_id = auth.uid() (auto-set)
  └─ Trigger fires: writes to audit_log, sends notification
  └─ Return inserted row
  
[Browser]
  └─ Call logAudit() to record in audit_log table
  └─ Refresh UI
```

### 3. Generate LoR PDF

```
[Browser]
  └─ generateLoRWithDocs(assessmentId)
     ├─ fetch `/rest/v1/assessments?id=eq.{assessmentId}`
     ├─ fetch `/rest/v1/assessment_personnel?assessment_id=eq.{assessmentId}&select=*,personnel(*)`
     ├─ fetch `/rest/v1/assessment_equipment?assessment_id=eq.{assessmentId}&select=*,equipment_items(...)`
     ├─ Build HTML table in JavaScript (iterate over results)
     ├─ Create blob: new Blob([htmlString])
     ├─ Open in new window: window.open(blobUrl)
     └─ User clicks print → browser print dialog → "Save as PDF"
```

**Old approach** (Heroku):
- Send assessmentId to server
- Server fetches same 3 queries
- Server builds HTML
- Server converts with puppeteer (PDF generation)
- Return PDF blob to browser
- Browser downloads

**New approach** (Client-side):
- All 3 steps happen in browser
- Browser does PDF rendering via native print dialog
- No server needed
- Works offline (after data is loaded)

---

## Deployment

### Vercel (Frontend + API Proxy)

1. GitHub push to `main`
2. Vercel webhook triggers build
3. Build step: `buildCommand: null` (no build, just copy files)
4. Output directory: `.` (root contains all static files)
5. Functions: `api/index.js` becomes `/api/*` endpoint
6. Deploy to Vercel Edge network
7. Environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (set in dashboard)

### Supabase (Managed PostgreSQL)

- Hosted on AWS/GCP
- No deployment needed (DBaaS)
- Migrations applied via Supabase CLI (local dev)
- Production: apply via Supabase UI or schema push

### Local Development

```bash
# Frontend + API proxy
node server-local.js       # http://localhost:3000
                           # Serves /public + /js
                           # Proxies /api to localhost:5000

# API proxy (for reference, not needed in production)
cd api && npm start         # http://localhost:5000

# Database
supabase start              # http://localhost:54321 (local Postgres)
                            # Runs locally for testing
```

---

## Security Model

### Authentication
- Supabase handles password hashing, token signing (JWT)
- Browser stores JWT in localStorage
- All requests include JWT in Authorization header
- Supabase extracts claims (`auth.uid()`, `role`) from JWT to enforce RLS

### Authorization (RLS)
- Every data query filtered at database layer
- Browser cannot fetch data outside RLS scope
- Even if compromised (XSS), browser can't bypass — database enforces

### Secrets
- `SUPABASE_ANON_KEY` — OK to expose (limited to RLS scope)
- `SUPABASE_SERVICE_KEY` — Only in Supabase Edge Functions (server-side only)
- `SUPABASE_URL` — Public (no secret)
- No API keys in frontend code

### CORS & CSRF
- Vercel proxy handles CORS (same-origin frontend + API endpoint)
- Supabase CORS permissive for authenticated requests
- CSRF tokens not needed (SPA, no form-based CSRF vector)

---

## Performance Characteristics

| Operation | Latency | Bottleneck |
|-----------|---------|------------|
| Load assessment list | 100-300ms | Supabase REST API (~200ms) |
| Submit assessment | 100-200ms | Database write + trigger + response |
| Generate LoR PDF | 2-10s | Browser JavaScript (data fetch + HTML build) |
| Open print dialog | ~100ms | Browser rendering |

**Optimization**: Most data is cached in browser (assessments, personnel). Subsequent operations fetch only deltas.

---

## Known Limitations & Tradeoffs

1. **No real-time sync** — page must be refreshed to see others' changes
2. **Client-side builds HTML** — LoR generation slower on low-end devices (mitigated by simple HTML)
3. **No server-side PDF** — users must use browser print (not ideal for automation)
4. **localStorage auth** — no automatic refresh, JWT expiry visible in app
5. **No API caching** — every read hits Supabase (mitigated by fast Supabase)

**Rationale**: Simplicity > perfection. Serverless model trades advanced features for ease of deployment.

---

## Future Considerations

- **Supabase Edge Functions** — if server-side logic needed (e.g., complex PDF, exports)
- **Vercel KV** — if caching layer needed
- **Real-time sync** — Supabase Realtime subscriptions for collaborative editing
- **API versioning** — currently none; Supabase schema is the API contract
