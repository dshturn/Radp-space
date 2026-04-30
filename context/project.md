# Project Context: RADP

## Architecture (Hybrid: Public + Internal Aramco)

**Public deployment** (External contractors, public internet):
- Frontend: GitHub → Vercel
- Database: Supabase
- API: Direct to Supabase REST API

**Internal deployment** (Aramco employees, restricted firewall):
- Frontend: Same app hosted in SharePoint
- Database: Supabase (same as public)
- API: Direct to Supabase (via email-based workflow, Phase 2)

**Data source:** Single Supabase instance (shared by both)

---

## What It Does

RADP verifies contractor crew and equipment are qualified before mobilizing to well intervention jobs. Contractors submit roster + certs. Aramco assessor approves or rejects within 24h. Field supervisor checks expiry status on tablet before job start.

**Core problem**: Crews show up unqualified; auditors can't prove compliance; certification gaps discovered day-of-job (shutdown risk).

## Users & Workflows

### Contractor Coordinator (office, desktop)
- Registers crew: name, email, service line (slickline / CT / pumping)
- Uploads certs as PDFs: H2S (3-year), operator card (varies), medical (2-year), confined space (5-year)
- Monitors expirations: system flags items expiring within 90 days
- Submits pre-mob: email/name + equipment serial + crew roster + site location
- Waits for approval: tracks in app, gets email notification

### Field Supervisor (rig/site, mobile)
- Checks readiness day-before or morning-of job
- Views crew roster: each person shows cert status (green = valid, amber = 30 days, red = expired)
- Views equipment manifest: serial + components (head, cable, stripper) + expiry status
- Decides: go/no-go based on red flags
- Works offline: app cached, can view without internet

### Aramco Assessment Engineer (office, desktop)
- Gets email: "Contractor ABC submitted assessment for Well X, start date 2026-05-15"
- Reviews in app: crew roster (linked to cert dates), equipment certs, checklist
- Sees history: when certs uploaded, when last approved, any prior rejections
- Approves (24h SLA for routine) or requests corrections (4h SLA for urgent pre-mob)
- Sends notification: contractor gets email + in-app alert

### Aramco Operations Manager (office, weekly)
- Views dashboard: compliance by contractor, approval rates, repeat rejections
- Flags contractors with consistent cert gaps
- Identifies patterns (e.g., "Slickline crews always miss H2S renewal")

## Core Use Cases

### UC1: Contractor Onboarding
1. New contractor coordinator registers
2. Creates company profile + selects service line (slickline)
3. Adds 5 crew: operator, 2 righand, medic, safety officer
4. Uploads certs (7 documents: 5 H2S + 5 operator cards + 5 medicals)
5. System reads expiry dates, flags "operator card expires 2026-06-30"
6. **Timeline**: 20–30 min from signup to ready to submit first assessment

### UC2: Pre-Mob Assessment (routine)
1. Coordinator gets SMS: "Contractor ready for slickline job? Well X, starts 2026-05-15"
2. Opens app, clicks "New Assessment"
3. Selects: service line (slickline), well/field, crew (auto-filled), equipment (auto-filled: 1 slickline unit)
4. System shows required checklist:
   - Operator: current H2S? → yes
   - Rig hand 1: current operator card + H2S + medical? → yes
   - Rig hand 2: current operator card + H2S + medical? → yes
   - Slickline head: cert valid? → yes (2024-12-15)
   - Cable: tested in last 12 months? → yes (2026-03-10)
   - Stripper: certified? → yes (2025-01-20)
5. All green. Coordinator submits.
6. **Assessor reviews**: 4h later (routine SLA)
7. Approves: contractor gets email "Assessment #1234 approved"
8. **Total time**: 5 min to submit, 4–24 h to approve

### UC3: Field Readiness Check
1. Morning of job: supervisor opens app on tablet
2. Selects job site (Well X, slickline crew)
3. Sees dashboard:
   - Crew roster (5 people):
     - Operator: ✓ (H2S expires 2026-06-15, 7 weeks valid, green)
     - Righand 1: ✓ (H2S expires 2026-05-10, 2 weeks, amber)
     - Righand 2: ✓ (H2S expires 2026-04-28, 4 days, red)
     - Medic: ✓ (all current, green)
     - Safety: ✓ (all current, green)
   - Equipment:
     - Slickline unit: ✓ (cert expires 2026-08-01, green)
     - Head: ✓ (green)
     - Cable: ✓ (green)
     - Stripper: ✓ (green)
4. Sees red flag: Righand 2's H2S expires in 4 days (job is 2-week duration)
5. Calls coordinator: "Need updated H2S for [name]"
6. Coordinator uploads new cert in app
7. Supervisor refreshes, sees green
8. **Decision**: Go ahead
9. **Total time**: 2 min lookup

### UC4: Audit Discovery (regulatory investigation)
1. Auditor requests: "All assessments for Well X, 2024–2026, and who approved them"
2. Logs in with admin role
3. Views audit log:
   - 2026-05-10: Contractor ABC submitted assessment #1234
   - 2026-05-10: Engineer XYZ approved assessment #1234
   - (Snapshot): crew roster: 5 names + 7 certs with expiry dates
4. Exports PDF: regulatory report with full trail
5. **Success**: Auditor has defensible record

## Data Model

Contractor Company
  ├─ Personnel (crew member)
  │   ├─ H2S certificate (3-year expiry)
  │   ├─ Operator card (varies by region, 2–5 year expiry)
  │   ├─ Medical (2-year expiry)
  │   └─ Confined space (5-year expiry)
  │
  └─ Equipment Item (slickline unit, CT unit, etc.)
      ├─ Head (certification, annual expiry check)
      ├─ Cable (annual test, 12-month validity)
      ├─ Stripper (certification, 2-year expiry)
      └─ Pump module (certification, varies)

Assessment (pre-mob request)
  ├─ Equipment roster (ref equipment items)
  ├─ Personnel roster (ref personnel + certs)
  ├─ Checklist (service-line-specific, auto-generated)
  └─ Status: draft → submitted → approved/rejected

Audit Log (immutable, forever)
  ├─ actor_id (user who performed action)
  ├─ entity_type (personnel, equipment, assessment, site, document, user)
  ├─ entity_id (reference to affected record)
  ├─ action (created, updated, deleted, uploaded, archived, added_X, removed_X, approved, rejected)
  ├─ label (human-readable: "John Smith — Medical Report" or "Gauge - 9000ITQ8 - Calibration")
  ├─ metadata (optional snapshot: file_url for documents, timestamps, etc.)
  ├─ company (captured from user profile for role-based filtering)
  ├─ service_line (captured from user profile for role-based filtering)
  ├─ created_at (ISO timestamp)
  └─ Access Control:
      ├─ Admins: see all entries across all contractors
      └─ Contractors: see only entries from their own company + service_line

## Success Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Assessment submit time | < 5 min | Contractor office, routine case |
| Assessment approval time | 24h routine, 4h urgent | Depends on SLA |
| Field readiness lookup | < 2 min | Mobile, 3G connection |
| Cert upload success | 99%+ | PDFs, JPGs, any format |
| System uptime | 99.5%+ | Production |
| Audit log completeness | 100% coverage | Every action logged with actor + timestamp |

## Known Issues & Gaps

- **Cert date extraction**: PDFs vary format; manual entry is fallback
- **Approval bottleneck**: If assessor unavailable, urgent pre-mobs blocked
- **Offline roster**: Field supervisor sees cached data; new submissions won't appear until sync
- **Timezone**: Expiry calculations in UTC; local time displays may be ±1 day

## Roadmap

**Phase 1 (MVP, COMPLETE as of 2026-04-26)**:
- ✅ Auth (email/password)
- ✅ Personnel + cert upload + expiry tracking
- ✅ Equipment hierarchy + templates
- ✅ Assessment submission → approval
- ✅ Audit logging (comprehensive, role-based access, 520+ entries, company/service_line filtering)
  - All events logged: personnel creation/edit/delete, cert upload, assessment full lifecycle, equipment changes, site operations, user approvals
  - 6 modules with audit trails: documents, personnel, equipment, assessments, operations, users
  - 11 distinct action types: created, updated, deleted, uploaded, archived, added_X, removed_X, approved, rejected
  - Contractors see only their company's events; admins see all
  - Standalone Audit Log tab with "Who" column (user name + service_line)
  - Pagination (50 entries/page) + filtering by entity type and date range
  - Document links: clickable URLs to view PDFs/images inline
- ✅ PWA (offline read, manifest.json, service worker v13)
- ✅ Admin access: view + edit all contractor records (personnel, equipment, documents)

**Phase 2 (4–6 weeks, in progress)**:
- [x] LoR module UI + logic (complete, deployed locally)
- [x] Firewall analysis complete (2026-04-28)
  - Discovered: Web interfaces accessible, SQL connections blocked, email always works
  - Solution: Email-based assessment workflow with PDF interface
- [ ] **Email-Based Assessment Workflow** (firewall-friendly solution)
  - **Architecture**: Email ↔ PDF ↔ EFT (no web interfaces, no database connections)
  - **Firewall test results (2026-04-28)**:
    - ✅ supabase.com (web UI accessible, but UI not suitable for assessments)
    - ✅ Azure Portal (accessible)
    - ✅ Power BI (accessible)
    - ✅ Email (accessible)
    - ❌ Database connections (blocked - SQL port 1433)
    - ❌ Storage websites (blocked)
    - ❌ App Services (blocked)
  - **Workflow**:
    1. Aramco SharePoint generates assessment request → emails external RADP
    2. RADP Email Analyzer receives → creates assessment container in Supabase
    3. Contractor fills assessment + uploads certs → PDF Generator creates hierarchical PDF
    4. PDF with internal links (TOC → certificate pages) → EFT upload
    5. Assessor downloads PDF from EFT → reviews offline → SharePoint generates decision email
    6. RADP Email Analyzer receives decision → updates assessment status in Supabase
  - **Decision (2026-04-28)**: Email transport + PDF interface solves firewall constraints without IT involvement, external servers, or web proxies
- [ ] Audit log export (PDF/CSV with date range filtering)
- [ ] Audit log search (by user, action, entity type)
- [ ] Reduce AI token burn (~50 tokens/assessment)
- [ ] Mobile UX: faster lookups, cached rosters
- [ ] CSV bulk import (50 crew at once)
- [ ] Email alerts: "H2S expires in 30 days" + "Admin edited your record"
- [ ] Code refactor: split assessment.js (31KB → 10KB modules)

**Phase 3 (2–3 months)**:
- [ ] Assessment detail view in Audit Log (show crew roster changes)
- [ ] Admin KPI dashboard (approval rates, rejection patterns)
- [ ] Audit log retention policy (delete entries >7 years, GDPR compliance)
- [ ] SAML/LDAP (Aramco SSO)
- [ ] Equipment maintenance log (service intervals, inspections)
- [ ] Integration with SAP (contractor + crew sync)

## Recent Fixes & Improvements (2026-04-30)

### Audit Log Enhancements
- ✅ **Better deletion labels**: Deleted items now show full context (e.g., "Equipment name - Serial#" instead of "Equipment item")
- ✅ **Removal clarity**: Removed personnel/equipment shows actual names instead of IDs
- ✅ **Document links**: Clickable URLs in audit log now display PDFs/images inline
- ✅ **RLS policy fix**: Contractors can now see all 747+ of their own audit entries (fixed policy to read actor_id = auth.uid())
- ✅ **Pagination**: Content-Range header now properly forwarded through API proxy, pagination works correctly

### API Proxy Improvements
- ✅ **Binary file handling**: Storage requests (PDFs, images) now returned as binary, not JSON-encoded
- ✅ **Header forwarding**: Prefer header now forwarded to Supabase (enables count=exact for pagination)
- ✅ **Content-Type preservation**: Response content-type forwarded to client for proper file handling
- ✅ **CORS exposed headers**: Content-Range header now exposed to browser for pagination

### UI/UX Bug Fixes
- ✅ **Double-click protection**: Remove buttons now disabled after first click to prevent duplicate audit entries (was logging same removal 80+ times)
- ✅ **Select statements**: Audit log queries now include `select=*` to fetch all columns including metadata

### Known Limitations
- Old deleted items retain generic labels (data is gone, can't be recovered retroactively)
- Future deletions will have descriptive labels with item names

---

Owner: Tech Lead | Last updated: 2026-04-30 (Audit Log & Proxy Fixes, Document Links, RLS Contractor Access)
