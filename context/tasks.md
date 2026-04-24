# Development Roadmap & Current Tasks

Prioritized backlog for RADP development. Updated weekly based on stakeholder feedback and blocking issues.

## Active Sprint (Week of 2026-04-21)

### P0: Critical (Release Blockers)

- [ ] **Optimize assessment token usage**
  - **Problem**: Assessment generation consumes ~50 tokens/request; unsustainable at scale
  - **Solution**: Pre-compute checklist items server-side instead of AI-per-request
  - **Owner**: Tech Lead
  - **Timeline**: EOW 2026-04-28
  - **Estimate**: 2-3 days
  - **Notes**: Impacts cost structure; high priority for Aramco

- [ ] **Fix admin login role detection**
  - **Problem**: Some admin users unable to access admin-dashboard
  - **Status**: Under investigation (may be RLS policy issue)
  - **Owner**: Backend Engineer
  - **Timeline**: ASAP

### P1: High (Next 2-3 weeks)

- [ ] **Mobile UX refinement for field supervisors**
  - **Problem**: Field users report 2-3 min lookup time; should be < 2 min
  - **Solutions**:
    - Reduce API payload sizes (select only needed columns)
    - Add local caching for personnel/equipment lists
    - Optimize CSS rendering (reduce repaints)
  - **Owner**: Frontend Engineer
  - **Timeline**: 2-3 days
  - **Estimate**: 3-5 days

- [ ] **Implement expiry alert system**
  - **Problem**: Personnel/equipment expiring soon have no notification
  - **Solution**: 
    - Server-side Supabase Function (daily check)
    - Email notifications to contractor coordinators
    - In-app banner for expiring items (30-day warning)
  - **Owner**: Full-stack Engineer
  - **Timeline**: 3-5 days
  - **Blockers**: Supabase Function setup, email template design

- [ ] **Bulk CSV import for personnel**
  - **Problem**: Manual entry of 10+ people is tedious; Aramco contractors want bulk import
  - **Solution**:
    - CSV template upload with validation
    - Error recovery (show invalid rows, allow fix + retry)
    - Bulk audit log (one entry per person)
  - **Owner**: Frontend Engineer
  - **Timeline**: 2-3 days
  - **Estimate**: 3 days

- [ ] **Code modularization (refactor app.js)**
  - **Problem**: app.js is 9KB, hard to navigate; assessment.js is 31KB
  - **Solution**: 
    - Extract utils (API calls, modal helpers) to separate files
    - Break assessment.js into assessment-list.js + assessment-editor.js
    - Document module boundaries
  - **Owner**: Tech Lead
  - **Timeline**: 3-5 days (lower priority if busy)
  - **Estimate**: 5 days
  - **Impact**: Easier maintenance, parallel dev

### P2: Medium (Next sprint, 4-6 weeks)

- [ ] **Admin dashboard (KPI view)**
  - **Features**:
    - Total assessments submitted (last 30 days)
    - Approval rate by assessor
    - Contractor compliance trends
    - Audit log search + export
  - **Owner**: Frontend Engineer
  - **Timeline**: 4-5 days
  - **Estimate**: 5 days
  - **Blocker**: Needs P1 tasks complete first

- [ ] **SAML/LDAP integration (Aramco SSO)**
  - **Problem**: Aramco users want Single Sign-On
  - **Solution**: 
    - Supabase SAML provider integration
    - Map Aramco roles (operations/assessor) from AD groups
  - **Owner**: DevOps / Backend Engineer
  - **Timeline**: 5-7 days
  - **Estimate**: 7 days
  - **Dependency**: Aramco IT approval, SAML config

- [ ] **Advanced filtering & export**
  - **Features**:
    - Filter assessments by status, date range, contractor, service line
    - Export to CSV (with audit log trace)
    - Save custom filters
  - **Owner**: Frontend Engineer
  - **Timeline**: 3-4 days

- [ ] **Mobile offline sync (full data replication)**
  - **Problem**: Field users cannot access full roster if offline
  - **Solution**:
    - Service worker: cache full personnel + equipment lists on app load
    - Background sync queue for offline changes (future feature)
  - **Owner**: Frontend Engineer
  - **Timeline**: 3-5 days
  - **Estimate**: 5 days

### P3: Low (Future, 8+ weeks)

- [ ] **Equipment status history timeline**
  - **Features**: Visual timeline of equipment state changes (maintenance, inspections)
  - **Owner**: UX/Frontend
  - **Estimate**: 3-4 days

- [ ] **Workflow customization per business unit**
  - **Problem**: Different Aramco divisions have different assessment processes
  - **Solution**: Allow admins to customize checklists, approval workflows
  - **Owner**: Tech Lead
  - **Estimate**: 8-10 days (significant complexity)

- [ ] **Integration with SAP/ERP**
  - **Problem**: Aramco finance/ops teams want data sync to SAP
  - **Solution**: REST API client for SAP; nightly batch sync
  - **Owner**: DevOps / Backend
  - **Estimate**: 10-15 days
  - **Dependency**: SAP credentials, API specification

- [ ] **Performance profiling & optimization**
  - **Goal**: Achieve < 300ms page load on 3G
  - **Tasks**:
    - Profile with Chrome DevTools
    - Optimize images, lazy-load JS, minimize CSS
    - Consider Lighthouse scores
  - **Owner**: Tech Lead
  - **Estimate**: 5-7 days

## Backlog (Unscheduled)

### Bug Reports

- [ ] Certificate upload fails for PDFs > 10MB (need to investigate size limits)
- [ ] Personnel expiry calculation off by 1 day in some timezones
- [ ] Service line dropdown resets after adding new company
- [ ] Admin audit log search returns 50 rows max (pagination issue)

### Feature Requests (From Aramco)

- [ ] Equipment maintenance log (track service intervals, repairs)
- [ ] Multi-language support (Arabic + English)
- [ ] QR code scanning for equipment serial numbers
- [ ] Contractor performance ratings (based on assessment quality)
- [ ] API for third-party integrations

### Tech Debt

- [ ] Update to latest Supabase client library (currently on v1.x, v2+ available)
- [ ] Add unit tests for critical functions (auth, expiry calculation)
- [ ] Document database schema (create ER diagram)
- [ ] Set up automated security scanning (OWASP)

## Completed (Last 30 days)

✅ Audit logging system (immutable records)  
✅ Multi-role support (contractor, assessor, operations, admin)  
✅ Equipment hierarchical templates  
✅ PWA support (offline read, install to home screen)  
✅ Notification system (foundation; email not yet wired)  
✅ Assessment approval workflow  
✅ Aramco-specific service lines and departments  

## Success Metrics (Tracking)

| Metric | Target | Current | Trend | Owner |
|--------|--------|---------|-------|-------|
| Avg assessment submission time | < 5 min | ? | ? | Product |
| Mobile page load time | < 2 sec (3G) | ? | ? | Eng |
| System uptime | 99.5% | 99.8% | ✅ | DevOps |
| Token usage per assessment | < 20 | ~50 | ❌ | Tech Lead |
| Contractor onboarding time | < 30 min | ? | ? | Product |
| Assessor review time | < 24 h | ? | ? | Operations |
| Bug escape rate (to prod) | < 5% | ? | ? | QA |

## Dependencies & Blockers

| Task | Blocker | Owner | Status |
|------|---------|-------|--------|
| Admin Dashboard | P1 tasks | — | waiting |
| SAML Integration | Aramco IT config | DevOps | pending |
| SAP Sync | SAP API spec | Aramco IT | not started |
| Alert System | Email template | Design | pending |

## Capacity Plan

**Current team**: 1 Tech Lead + 1 Full-Stack Engineer + 0.5 Designer

**Sprint velocity**: ~8-10 story points/week (estimate: 1pt = 4-6 hours)

**Next 4 weeks**:
- P0 (critical): 3-5 days
- P1 (high): 8-12 days
- Buffer: 2-3 days (interrupts, code review, debugging)
- **Total**: ~13-18 days available; can fit 1-2 P1 tasks + P0

## Stakeholder Communication

**Weekly stand-up**: Tuesday 10am (Tech Lead + Aramco Ops)  
**Status dashboard**: Shared with Aramco CTO  
**Release cadence**: 2x per week (Wednesday, Friday) after QA approval  
**Incident severity levels**:
- **P0 (critical)**: Production outage, data loss, security breach → hotfix within 2h
- **P1 (high)**: Feature broken, major performance issue → fix within 24h
- **P2 (medium)**: Minor bug, UX inconsistency → fix within 1 week
- **P3 (low)**: Nice-to-have improvements → backlog

---

**Last updated**: 2026-04-24  
**Next update**: 2026-04-29 (weekly)  
**Owner**: Tech Lead  
**Reviewed by**: Aramco Operations Manager
