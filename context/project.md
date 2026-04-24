# Project Context: RADP

## Problem Statement

Oil & gas well intervention operations require pre-mobilization audits to verify contractor equipment readiness and personnel qualifications. Currently:

- Audits are paper-based or scattered across email and spreadsheets
- No real-time visibility into certification expiry status
- Compliance evidence is difficult to retrieve for regulatory audits
- Field teams cannot quickly verify readiness from site
- No audit trail for accountability

## Business Objectives

**Primary**:
- Standardize pre-mobilization audit process across Aramco operations
- Reduce time to assessment (from days to hours)
- Create immutable compliance record for regulatory audits
- Minimize false positives (unqualified personnel/equipment deployed)

**Secondary**:
- Enable Aramco operations teams to self-serve (reduce gatekeeping bottlenecks)
- Reduce manual data entry and transcription errors
- Support contractor onboarding efficiency

## Users & Roles

### Contractor Company Coordinator
- **Goal**: Maintain team qualifications and equipment certifications
- **Tasks**: Register personnel, upload certifications, update equipment status, submit assessments
- **Environment**: Office desk (desktop/laptop), occasional tablet
- **Frequency**: Regular (weekly to monthly)
- **Constraints**: May have limited technical literacy; some may have poor connectivity to cloud

### Field Supervisor (Contractor)
- **Goal**: Verify readiness status before mobilization
- **Tasks**: Check personnel and equipment expiry dates, flag missing certs
- **Environment**: Site (tablet/phone), mixed lighting and connectivity
- **Frequency**: Event-driven (before job start)
- **Constraints**: Needs quick lookups, minimal data entry, offline access

### Aramco Assessment Engineer
- **Goal**: Review contractor submissions and approve/reject assessments
- **Tasks**: Review assessments, request clarifications, approve/reject, track trends
- **Environment**: Office (desktop/laptop)
- **Frequency**: Daily during job scheduling periods
- **Constraints**: May review 10-50 assessments/day

### Aramco Operations Manager
- **Goal**: Oversee compliance across all contractors
- **Tasks**: View dashboard, audit trends, address non-compliance
- **Environment**: Office (desktop)
- **Frequency**: Weekly to monthly review
- **Constraints**: Executive summary format preferred

### System Administrator
- **Goal**: Maintain platform, manage user access, debug issues
- **Tasks**: Manage service lines, equipment templates, handle escalations
- **Environment**: Office
- **Frequency**: As needed
- **Constraints**: Full system visibility

## Key Use Cases

### UC1: Contractor Onboarding
1. Contractor company coordinator registers on platform
2. Creates new company profile or joins existing company
3. Adds first wave of personnel (manual entry + CSV bulk import)
4. Uploads certifications for each person
5. System validates dates and flags any expiring within 90 days
6. Coordinator is now ready to submit assessments

**Success metric**: < 30 minutes from registration to first assessment submission

### UC2: Pre-Mobilization Assessment
1. Coordinator gets request: "Contractor ABC ready for slickline job on Well X?"
2. Opens RADP, clicks "New Assessment"
3. Selects service line (slickline), field/well, contractor, date range
4. System pre-populates checklist based on service line + equipment on hand
5. Coordinator confirms equipment + personnel roster
6. System auto-calculates: all people certified? All equipment valid? Flags any gaps
7. Submits to Aramco assessor
8. Assessor reviews, approves or requests clarification
9. Result is recorded with timestamp and audit trail

**Success metric**: Assessment submitted in < 5 minutes, approved within 24 hours

### UC3: Field Readiness Check
1. Supervisor arrives at site the morning of operation
2. Opens RADP on tablet, views the job site page
3. Scans personnel roster: sees green (valid cert), amber (expires in 14 days), red (expired)
4. Scans equipment manifest: sees status of each piece
5. Notifies coordinator if any red flags
6. Confirms go/no-go to operations

**Success metric**: Full roster review in < 2 minutes

### UC4: Compliance Audit (Aramco Internal)
1. Auditor logs in with admin role
2. Views audit log filtered by date range and entity type
3. Sees immutable record: who uploaded what, when, approvals, rejections
4. Can reconstruct any assessment decision from timestamp + actor + metadata
5. Exports summary for regulatory filing

**Success metric**: Audit log provides defensible evidence for any decision

## Constraints & Assumptions

### Technical Constraints
- **No AI token budget for real-time operations**: Some workflows pre-computed; AI used sparingly for summarization only
- **Low-latency requirement**: Most API calls should return < 500ms (field users may be on slow cellular)
- **Minimal external dependencies**: Rely on Supabase primitives; avoid third-party APIs where possible
- **Mobile-first architecture**: Must work on iOS Safari, Android Chrome with degraded connectivity

### Business Constraints
- **Aramco security**: All data must stay within Aramco infrastructure (no third-party SaaS outside Supabase)
- **Compliance record**: Audit logs are immutable and must be recoverable for 7 years
- **No bulk deletion**: Only soft-delete permitted (dismissed flag, not hard-delete from audit trail)

### Assumptions
- Supabase is Aramco-approved and runs in-region or trusted cloud
- All users have basic email and password (no SAML/LDAP yet, but architecture allows future integration)
- Equipment and personnel data is relatively stable (not changing multiple times per day)
- Assessments are submitted once per job/contract (not iterative)

## Success Metrics

| Metric | Target | Current | Owner |
|--------|--------|---------|-------|
| Assessment submission time | < 5 min | ? | Contractor UX |
| Assessment approval time | < 24 h | ? | Assessor workflow |
| Certification upload success rate | > 99% | ? | File handling |
| Field readiness lookup time | < 2 min | ? | Mobile performance |
| Audit log completeness | 100% action coverage | ? | Logging system |
| System uptime | > 99.5% | ? | Operations |

## Priority / Roadmap Phases

### Phase 1 (Current MVP)
- ✅ Basic auth (email/password)
- ✅ Contractor: register, add personnel/equipment, upload certs
- ✅ Equipment tracking (hierarchical templates)
- ✅ Pre-mobilization assessment workflow
- ✅ Assessor approval flow
- ✅ Audit logging
- ✅ PWA (offline read, cached data)

### Phase 2 (Next)
- [ ] Reduce AI token usage in assessment generation
- [ ] Mobile UX refinement (field supervisor flows)
- [ ] Bulk import improvements (CSV templates, error recovery)
- [ ] Expiry alert system (email, in-app notifications)
- [ ] Admin dashboard (KPIs, compliance trends)

### Phase 3 (Future)
- [ ] SAML/LDAP integration (Aramco SSO)
- [ ] Workflow customization per Aramco business unit
- [ ] Advanced filtering and reporting
- [ ] Mobile offline sync (full data replication)
- [ ] Integration with SAP/ERP systems

## Known Issues & Tech Debt

### High Priority
- AI token usage in assessment checklists is high; needs optimization
- Code organization scattered across large JS files; needs modularization

### Medium Priority
- Error handling for network timeouts incomplete
- Some form validation duplicated between client/server

### Low Priority
- CSS could be organized with CSS variables
- Some older browser compatibility testing needed

---

**Last updated**: 2026-04-24  
**Owner**: Technical Lead  
**Next review**: When Phase 2 scope is finalized
