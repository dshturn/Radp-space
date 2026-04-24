# Project Context: RADP

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
  ├─ entity_type (personnel, equipment, assessment, operations, document, user)
  ├─ entity_id (reference to affected record)
  ├─ action (created, uploaded, approved, rejected, deleted, assigned)
  ├─ label (human-readable: "John Smith — Medical Report")
  ├─ metadata (optional snapshot of key fields at time of action)
  ├─ company (captured from user profile for role-based filtering)
  ├─ service_line (captured from user profile for role-based filtering)
  ├─ created_at (ISO timestamp)
  └─ Access Control: Admins see all 522+ entries; non-admins see only their company+service_line

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

**Phase 1 (MVP, current)**:
- ✅ Auth (email/password)
- ✅ Personnel + cert upload + expiry tracking
- ✅ Equipment hierarchy + templates
- ✅ Assessment submission → approval
- ✅ Audit logging (role-based access, 522+ backfilled entries, company/service_line filtering)
  - All events logged: personnel creation, cert upload, assessment approval/rejection, document upload
  - Non-admins see only their company's events; admins see all
  - Standalone Audit Log tab visible to all approved users
  - Pagination (50 entries/page) + filtering by entity type and date range
- ✅ PWA (offline read, manifest.json)

**Phase 2 (4–6 weeks)**:
- Reduce AI token burn (~50 tokens/assessment)
- Mobile UX: faster lookups, cached rosters
- CSV bulk import (50 crew at once)
- Email alerts: "H2S expires in 30 days"
- Code refactor: split assessment.js (31KB → 10KB modules)

**Phase 3 (2–3 months)**:
- Admin KPI dashboard
- SAML/LDAP (Aramco SSO)
- Equipment maintenance log (service intervals, inspections)
- Integration with SAP (contractor + crew sync)

---

Owner: Tech Lead | Last updated: 2026-04-24
