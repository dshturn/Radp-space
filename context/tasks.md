# Roadmap & Tasks

Prioritized backlog updated weekly.

## P0: Critical (Release Blockers)

### Token Optimization
- **Problem**: ~50 tokens/assessment; cost prohibitive at scale
- **Solution**: Pre-compute checklist items server-side (no AI per-request)
- **Timeline**: EOW 2026-04-28
- **Estimate**: 2–3 days
- **Owner**: Tech Lead
- **Impact**: Reduces cost 60%, enables high-volume submissions

### Admin Dashboard Login Bug
- **Problem**: Some admins can't access /admin/dashboard
- **Likely cause**: RLS policy not matching admin role
- **Timeline**: ASAP
- **Owner**: Backend Engineer

## P1: High (Next 2–3 weeks)

### Mobile UX: Faster Lookups
- **Problem**: Field supervisor lookup takes 2–3 min; target < 2 min
- **Actions**:
  - Reduce API payload (select only needed columns)
  - Cache personnel + equipment lists locally
  - Optimize CSS rendering
- **Timeline**: 2–3 days
- **Owner**: Frontend Engineer
- **Success metric**: < 2 min roster lookup on 3G

### Expiry Alert System
- **Features**:
  - Daily server check: flag personnel/equipment expiring in 30 days
  - Email to contractor: "H2S cert expires 2026-05-10"
  - In-app banner: red badge on expiring items
- **Timeline**: 3–5 days
- **Owner**: Full-stack Engineer
- **Dependency**: Email template design

### CSV Bulk Import
- **Feature**: Upload CSV (name, email, role, cert_type, expiry_date)
- **Validation**: Type checking, date parsing, error report
- **Error recovery**: Show invalid rows, allow fix + retry
- **Timeline**: 2–3 days
- **Owner**: Frontend Engineer
- **Success metric**: Import 50 crew in < 2 min

### Code Modularization
- **Problem**: app.js (9KB), assessment.js (31KB) hard to debug
- **Actions**:
  - Extract utils (API, modals) to shared.js
  - Split assessment.js → assessment-list.js + assessment-editor.js
  - Document module boundaries
- **Timeline**: 3–5 days (lower priority if busy)
- **Owner**: Tech Lead
- **Benefit**: Faster debugging, parallel dev

## P2: Medium (4–6 weeks)

### Admin Dashboard (KPIs)
- Total assessments (last 30 days)
- Approval rate by assessor
- Contractor compliance trends
- Audit log search + export
- **Timeline**: 4–5 days
- **Owner**: Frontend Engineer

### SAML/LDAP Integration
- **Goal**: Aramco SSO (replace email/password)
- **Work**: Supabase SAML config, map AD groups to roles
- **Timeline**: 5–7 days
- **Dependency**: Aramco IT approval + SAML endpoint

### Advanced Filtering
- Filter assessments: status, date range, contractor, service line
- Export to CSV with audit trail
- Save custom filters
- **Timeline**: 3–4 days

### Mobile Offline Sync
- Cache full personnel + equipment lists on app load
- Allow offline status checks (no write while offline)
- **Timeline**: 3–5 days

## P3: Low (Future)

- Equipment maintenance log (service intervals, inspections)
- Multi-language support (Arabic + English)
- Contractor performance ratings
- QR code scanning (equipment serial lookup)
- Integration with SAP (nightly data sync)

## Known Bugs

- [ ] PDF upload fails for files > 10MB (investigate size limits)
- [ ] Expiry calculation off by 1 day in some timezones (UTC fix pending)
- [ ] Service line dropdown resets after adding new company
- [ ] Audit log search capped at 50 rows (pagination issue)

## Completed (Last 30 days)

✅ Audit logging  
✅ Multi-role support (contractor, assessor, operations, admin)  
✅ Equipment hierarchy (parent/child components)  
✅ PWA (offline read, install to home)  
✅ Assessment approval workflow  
✅ Aramco departments + service lines  

## Team & Capacity

**Current**: 1 Tech Lead + 1 Full-Stack Engineer + 0.5 Designer

**Velocity**: ~8–10 story points/week (1 pt ≈ 4–6 hours)

**Next 4 weeks**: ~18 days available
- P0 (blocker): 3–5 days
- P1 (high): can fit 1–2 tasks
- Buffer: code review, debugging

## Success Metrics

| Metric | Target | Owner |
|--------|--------|-------|
| Assessment submit time | < 5 min | Contractor UX |
| Mobile lookup time | < 2 min | Mobile perf |
| Assessment approval time | < 24 h | Assessor |
| Cert upload success | 99%+ | File handling |
| API response time | < 500ms | Backend |
| System uptime | 99.5%+ | DevOps |

## Severity Levels

- **P0**: Production outage, data loss, security breach → hotfix < 2h
- **P1**: Feature broken, major perf issue → fix < 24h
- **P2**: Minor bug, UX inconsistency → fix < 1 week
- **P3**: Nice-to-have improvement → backlog

## Communication

**Weekly stand-up**: Tuesday 10am (Tech Lead + Aramco Ops)  
**Release cadence**: Wed + Fri (after QA)  
**Status**: Shared with Aramco CTO

---

**Owner**: Tech Lead  
**Updated**: 2026-04-24  
**Next update**: 2026-04-29
