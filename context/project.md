# Project Context: RADP

## Problem

Paper audits before well intervention jobs:
- Scattered cert uploads (email, USB, cloud)
- No real-time expiry visibility (find out crew is unqualified day-of-job)
- Impossible to audit compliance history
- Field supervisors cannot verify status from rig

Current workaround: spreadsheets + email chains + manual calls to contractors.

## Solution

Digital submission + approval system with audit trail. Contractors upload crew certs once. Assessor reviews in app. Supervisor checks status on tablet at site.

## Users & Workflows

### Contractor Coordinator (office)
- Adds crew: name, email, company, service line (slickline / CT / pumping)
- Uploads docs: operator certs, medicals, H2S, confined space
- System flags: cert expires in 30 days
- Submits pre-mob assessment for specific job
- Waits for approval → gets email notification

### Field Supervisor (rig/office)
- Opens app, selects job site
- Sees crew list: names + expiry status (green/amber/red)
- Sees equipment: slickline head, cable, stripper — status for each
- If any red flags: calls coordinator or declines job
- No internet? Cached data still works

### Aramco Assessor (office)
- Gets email: "Contractor ABC submitted assessment for Well X"
- Opens app, reviews crew roster + equipment + checklist
- Sees history: when certs uploaded, when assessments submitted
- Approves or says "send updated cert for John Smith"
- Contractor gets notified, uploads new cert, resubmits

### Aramco Ops Manager
- Weekly: checks compliance dashboard
- Sees: how many assessments approved/rejected, which contractors are compliant
- Flags contractors with repeated cert gaps

## Data Model (Simplified)

```
Contractor
  ├─ Personnel (crew member)
  │   └─ Document (cert upload)
  │       └─ Expiry date + cert type
  └─ Equipment Item (slickline unit)
      └─ Sub-item (head, cable, stripper)
          └─ Cert expiry date

Assessment (pre-mob request)
  ├─ Equipment roster (refs equipment items)
  ├─ Personnel roster (refs personnel)
  ├─ Checklist (service-line-specific)
  └─ Status: draft → submitted → approved/rejected

Audit Log (immutable)
  └─ Every action: who, what, when
```

## Key Use Cases

### Use Case 1: Contractor Onboarding
1. Coordinator registers, creates company profile
2. Adds 5 crew members (name, email, role, certs)
3. Uploads PDFs: operator cert, H2S, medical
4. System reads expiry dates from cert PDFs (or coordinator enters manually)
5. Coordinator ready to submit first assessment
**Timeline**: 15–30 minutes

### Use Case 2: Pre-Mob Assessment
1. Coordinator gets job request: "slickline crew for Well X, 2-week job starting 2026-05-15"
2. Opens app, clicks "New Assessment"
3. Selects: job date, service line (slickline), field/well, equipment on hand
4. System shows checklist: "crew current on H2S? Slickline head cert valid? Cable tested?"
5. Coordinator checks each item, submits
6. Assessor reviews in < 24 h, approves or requests cert updates
7. Result: contract can proceed or must wait for updated cert
**Success metric**: < 5 min to submit, < 24 h approval

### Use Case 3: Field Readiness Check
1. Day before job: supervisor logs in on tablet
2. Sees crew roster: 5 people, all green (valid certs)
3. Sees equipment: slickline unit + head + cable + stripper, all green
4. Sees: "Assessment #1234 approved by Aramco on 2026-04-22"
5. Confirms to ops: "Go ahead"
**Success metric**: < 2 min lookup

### Use Case 4: Audit Discovery (regulatory investigation)
1. Auditor logs in, runs query: "all assessments for Well X, 2024–2026"
2. Sees: assessment submitted 2026-05-10, approved 2026-05-11, crew roster snapshot, checklist
3. Sees: who approved it, when, email notifications sent
4. Exports: PDF report for regulators with full audit trail
**Success metric**: pull audit trail in < 5 min

## Constraints

**Technical**:
- Low bandwidth on some rigs (2G/3G only; API calls must finish in < 500ms)
- Offline-first design: field crew works without internet
- No heavy AI processing (token budget too high)

**Business**:
- Aramco-only deployment (no third-party SaaS)
- 7-year audit log retention
- No bulk deletion (soft-delete only)

**Regulatory**:
- Compliance record must be defensible in audit
- Contractor performance tracked (approvals, rejections)
- Immutable log of all cert uploads

## Success Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Time to submit assessment | < 5 min | Contractor office |
| Time to approve assessment | < 24 h | Aramco assessor |
| Field readiness lookup | < 2 min | Mobile, on 3G |
| Cert upload success | 99%+ | PDFs, images, any format |
| System uptime | 99.5%+ | Production |
| Audit log completeness | 100% | Every action logged |

## Roadmap

**Phase 1 (MVP, current)**:
- ✅ Auth + roles (contractor, assessor, operations, admin)
- ✅ Personnel + cert upload + expiry tracking
- ✅ Equipment hierarchy (unit → head → cable)
- ✅ Assessment submission → approval workflow
- ✅ Audit logging
- ✅ PWA (offline read)

**Phase 2 (next 4 weeks)**:
- Reduce AI token usage (currently ~50 tokens/assessment)
- Mobile UX: faster lookups, cached data
- CSV bulk import (add 10 crew at once)
- Email alerts: "Your H2S cert expires in 30 days"
- Code modularization (assessment.js is 31KB, hard to debug)

**Phase 3 (next quarter)**:
- Admin dashboard (approval trends, compliance stats)
- SAML/LDAP (Aramco SSO instead of email/password)
- Equipment maintenance log (service intervals, inspections)
- Integration with SAP (sync contractor + crew data)

## Known Issues

- **AI token burn**: ~50 tokens per assessment generation; needs pre-computation
- **Assessment.js bloat**: 31KB file; should split into smaller modules
- **Expiry calculation**: timezone offset causes 1-day errors in some regions (use UTC)
- **CSV import**: currently manual (can be automated with template)

---

**Owner**: Tech Lead  
**Last updated**: 2026-04-24  
**Next review**: EOW 2026-04-28 (after Phase 2 planning)
