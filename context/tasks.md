# Roadmap & Tasks

## P0: Critical (Release Blockers)

### Token Optimization
- **Problem**: ~50 tokens/assessment; cost prohibitive at scale
- **Solution**: Pre-compute checklist items (no AI per-request)
- **Estimate**: 2–3 days
- **Timeline**: EOW 2026-04-28
- **Owner**: Tech Lead
- **Impact**: Reduce cost 60%, enable high-volume submissions

### Admin Login Bug
- **Problem**: Some admins can't access /admin/dashboard
- **Root cause**: RLS policy not matching admin role (likely)
- **Estimate**: 4 hours
- **Timeline**: ASAP
- **Owner**: Backend Engineer

## P0: Critical (In Progress)

### Backend Migration to Heroku + Azure (Phase 2)
- **Status**: Azure PostgreSQL created; Heroku setup NEXT
- **Completed**: 
  - Azure Database for PostgreSQL (radp-postgres.postgres.database.azure.com)
  - Firewall rule added (IP 166.87.29.57)
- **Remaining**:
  - Create Heroku app + Node.js API scaffold
  - Test Heroku → Azure connectivity
  - Test SharePoint → Heroku (firewall validation)
  - Export/import Supabase data
  - Update frontend to call Heroku
- **Estimate**: 2–3 days
- **Owner**: Tech Lead
- **Blocker**: PostgreSQL CLI tools (pg_dump, psql) need to be installed locally for data export

## P1: High (Next 2–3 weeks)

### Mobile UX: Faster Lookups
- **Problem**: Field supervisor lookup 2–3 min; target < 2 min
- **Actions**:
  - Reduce API payload (select only needed columns)
  - Cache crew + equipment lists locally
  - Optimize CSS rendering
- **Estimate**: 2–3 days
- **Owner**: Frontend Engineer
- **Success metric**: < 2 min on 3G

### Expiry Alert System
- **Features**:
  - Daily check: flag personnel/equipment expiring in 30 days
  - Email: "H2S cert expires 2026-05-10"
  - In-app banner: red badge on expiring items
- **Estimate**: 3–5 days
- **Owner**: Full-stack Engineer
- **Dependency**: Email template design

### CSV Bulk Import
- **Feature**: Upload CSV (name, email, cert_type, expiry_date)
- **Validation**: Type check, date parsing, error report
- **Recovery**: Show invalid rows, allow fix + retry
- **Estimate**: 2–3 days
- **Owner**: Frontend Engineer
- **Success**: Import 50 crew in < 2 min

### Code Refactor
- **Problem**: assessment.js 31KB (hard to debug)
- **Actions**:
  - Split into: assessment-list.js + assessment-editor.js
  - Extract utils to shared.js
  - Document module boundaries
- **Estimate**: 3–5 days
- **Owner**: Tech Lead
- **Benefit**: Faster debugging, parallel dev

## P2: Medium (4–6 weeks)

### Admin Dashboard
- Approval rates by assessor
- Contractor compliance trends (approval %)
- Audit log search + export
- **Estimate**: 4–5 days
- **Owner**: Frontend Engineer

### SAML/LDAP Integration
- Aramco SSO (replace email/password)
- Map AD groups to roles
- **Estimate**: 5–7 days
- **Dependency**: Aramco IT approval + SAML endpoint

### Advanced Filtering
- Filter assessments: status, date range, contractor, service line
- Export to CSV with audit trail
- Save custom filters
- **Estimate**: 3–4 days

### Mobile Offline Sync
- Cache full crew + equipment rosters on app load
- Allow offline status checks (read-only)
- **Estimate**: 3–5 days

## P3: Low (Future)

- Equipment maintenance log (service intervals, inspections)
- Multi-language (Arabic + English)
- Contractor performance ratings
- QR code scanning (equipment serial lookup)
- SAP integration (nightly sync)

## Known Bugs (Backlog)

- [ ] PDF upload fails > 10MB (investigate size limits)
- [ ] Expiry calc off by 1 day in some timezones (UTC fix pending)
- [ ] Service line dropdown resets after adding company
- [ ] Audit log search capped at 50 rows (pagination issue)

## Completed (Last 30 days)

✅ Audit logging
✅ Multi-role auth (contractor, assessor, operations, admin)
✅ Equipment hierarchy (parent/child components)
✅ PWA (offline read, install to home)
✅ Assessment approval workflow
✅ Aramco departments + service lines

## Team Capacity

Current: 1 Tech Lead + 1 Full-Stack Engineer + 0.5 Designer
Velocity: ~8–10 points/week (1 pt ≈ 4–6 hours)
Available next 4 weeks: ~18 days
Allocation: P0 (3–5 days) + P1 (1–2 tasks) + buffer (code review, debug)

## Success Metrics

| Metric | Target | Owner |
|--------|--------|-------|
| Assessment submit | < 5 min | UX |
| Assessment approve | 24h routine | Ops |
| Field lookup (3G) | < 2 min | Mobile |
| Cert upload | 99%+ | Files |
| API response | < 500ms | Backend |
| Uptime | 99.5%+ | DevOps |

## Severity Levels

- **P0**: Outage, data loss, security breach → fix < 2h
- **P1**: Feature broken, major perf issue → fix < 24h
- **P2**: Minor bug, UX inconsistency → fix < 1 week
- **P3**: Nice-to-have improvement → backlog

## Communication

Weekly stand-up: Tue 10am (Tech Lead + Aramco Ops)
Release cadence: Wed + Fri (after QA)
Status: Shared with Aramco CTO

---

Owner: Tech Lead | Last updated: 2026-04-24
