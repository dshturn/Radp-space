# Roadmap & Tasks

**Last Updated**: 2026-05-01 (Project Analysis Complete)  
**Status**: Phase 1 MVP ✅ | Phase 2 Planning ✅ | Implementation Ready

---

## Critical Path: Next 2 Weeks

### Week 1: P0/P1 Technical Fixes (BLOCKING for Phase 2)
**Effort**: 7 days | **Timeline**: 2026-05-01 to 2026-05-08

| Priority | Issue | Effort | Owner | Blocker |
|----------|-------|--------|-------|---------|
| **P0** | ARIA labels on dynamic content | 1 day | Dev 1 | Blocks Phase 2 |
| **P0** | Form loading states (4 forms) | 0.5 days | Dev 1 | Blocks Phase 2 |
| **P1** | PDF file size validation (10MB) | 0.5 days | Dev 1 | — |
| **P1** | Service worker cache documentation | 0.5 days | Dev 2 | — |
| **P1** | Mobile table layout (responsive) | 1 day | Dev 2 | — |
| **P1** | Badge color tokenization | 0.5 days | Dev 2 | — |
| **P1** | Split assessment.js (5 modules) | 3 days | Dev 1 | Improves maintainability |

**Deliverables**:
- All P0 fixes deployed (A11y + form states)
- P1 fixes deployed (validation, docs, responsive, tokens)
- assessment.js refactored into 5 modules

**See**: `docs/superpowers/plans/2026-05-01-p0p1-fixes-implementation.md` for detailed checklists

---

### Week 2: Phase 2 Implementation Begins
**Effort**: 10 days | **Timeline**: 2026-05-08 to 2026-05-22

| Feature | Effort | Owner | Dependencies |
|---------|--------|-------|-------------|
| **Audit Export (PDF/CSV)** | 4 days | Dev 1 | P0.1, P0.2 ✅ |
| **Audit Log Search** | 1 day | Dev 1 | P0.1, P0.2 ✅ |
| **Email Alerts (admin actions)** | 2 days | Dev 2 | None |
| **Code Refactor (complete)** | 2 days | Dev 1 | P1.1 from Week 1 ✅ |

**Deliverables**:
- Audit export (PDF and CSV formats with filters)
- Real-time audit search (300ms debounce)
- Email notifications when admins edit contractor records
- assessment.js fully split and tested

**See**: `docs/superpowers/specs/2026-05-01-phase2-audit-features-design.md` for full specs

---

## P0: Critical (Blocking Phase 2)

### P0.1: ARIA Labels on Dynamic Content
- **Problem**: Modals, tabs, form errors lack semantic markup. Screen readers can't navigate. WCAG 2.1 Level A violation.
- **Impact**: Assistive tech users (~5%) can't use assessment modals
- **Solution**: Add `role="dialog"`, `aria-labelledby`, `role="alert"` to dynamic UI elements
- **Effort**: 1 day
- **Owner**: Dev 1
- **Timeline**: Week 1 (Mon)
- **Test**: NVDA/VoiceOver verification + axe DevTools scan

### P0.2: Form Loading States
- **Problem**: Submit buttons don't disable; no spinner shown. Users click multiple times, creating duplicate submissions.
- **Impact**: Duplicate records on slow networks (>2s latency)
- **Solution**: Disable button + show spinner during API call; re-enable on success/error
- **Effort**: 0.5 days (4 forms × 10 min each)
- **Owner**: Dev 1
- **Timeline**: Week 1 (Mon–Tue)
- **Applies to**: assessment, personnel, equipment, operations forms

---

## P1: High Priority (Week 1, Non-Blocking)

### P1.1: Split assessment.js (31KB Monolith)
- **Problem**: Single file; hard to debug, maintain, review
- **Solution**: Extract into 5 focused modules (list, create, detail, personnel, equipment, utils)
- **Effort**: 3 days
- **Owner**: Dev 1
- **Timeline**: Week 1 (Wed–Fri)
- **Result**: ~6 KB per module, testable independently
- **Ref**: Phase 2 Spec Feature 4

### P1.2: PDF Upload Size Validation
- **Problem**: No max file size check. Users can upload 100MB PDFs.
- **Solution**: Reject files > 10MB with clear error message before upload
- **Effort**: 0.5 days
- **Owner**: Dev 1
- **Timeline**: Week 1 (Wed)
- **Test**: Upload 5MB (pass), 15MB (fail with error message)

### P1.3: Service Worker Cache Strategy
- **Problem**: Cache strategy undefined. After deploy, users see stale UI or miss new features.
- **Solution**: Document cache strategy (app shell 24h, assets 30d); auto-bust on deploy
- **Effort**: 0.5 days
- **Owner**: Dev 2
- **Timeline**: Week 1 (Wed)
- **Update**: CLAUDE.md + sw.js comments

### P1.4: Mobile Table Layout
- **Problem**: Tables overflow horizontally on phones (< 480px). Users must scroll left/right.
- **Solution**: Responsive tables → card layout on mobile via `@media (max-width: 480px)`
- **Effort**: 1 day
- **Owner**: Dev 2
- **Timeline**: Week 1 (Thu)
- **Test**: iPhone 6s landscape (320px) — no horizontal scroll

### P1.5: Badge Color Tokenization
- **Problem**: Status badge colors (green/amber/red) hard-coded in JS. Changes require code edits.
- **Solution**: Move all badge colors to CSS variables (--color-status-valid, etc.)
- **Effort**: 0.5 days
- **Owner**: Dev 2
- **Timeline**: Week 1 (Fri)
- **Test**: Verify all status badges use CSS variables, no inline styles

---

## Phase 2 Features (Week 2+)

### Feature 1: Audit Log Export (PDF + CSV)
- **Problem**: Regulators need downloadable audit reports. Web-only audit log insufficient.
- **Solution**: 
  - Export PDF with filters (date range, entity type, action, contractor)
  - Export CSV for analysis
  - Performance: < 5s for 100 entries, < 30s for 500 entries
- **Effort**: 4 days
- **Owner**: Dev 1
- **Timeline**: Week 2 (Tue–Fri)
- **Dependency**: P0.1, P0.2 (export form needs A11y + loading states)
- **Ref**: Phase 2 Spec Feature 1

### Feature 2: Audit Log Search (Real-Time)
- **Problem**: Finding specific audit actions requires scrolling. Need text search.
- **Solution**: 
  - Search by actor name, entity label, action
  - Real-time with 300ms debounce
  - Respects date/entity filters
- **Effort**: 1 day
- **Owner**: Dev 1
- **Timeline**: Week 2 (Mon)
- **Dependency**: Phase 3 audit log viewer (Phase 1 ✅)
- **Ref**: Phase 2 Spec Feature 2

### Feature 3: Email Alerts on Admin Actions
- **Problem**: Contractors don't know when admins edit their records. Low transparency.
- **Solution**: 
  - Trigger: admin edits/deletes personnel, equipment, or documents
  - Action: send email to contractor company admin
  - Content: "Admin Jane edited your [entity] record: [summary]"
- **Effort**: 2 days
- **Owner**: Dev 2
- **Timeline**: Week 2 (Wed–Thu)
- **Dependencies**: None
- **Ref**: Phase 2 Spec Feature 3

### Feature 4: Code Refactoring (Complete)
- **Problem**: assessment.js is monolithic and hard to maintain (included in Week 1 P1.1)
- **Status**: Start Week 1 (Fri), finish Week 2 (Mon–Tue)
- **Effort**: 3 days total
- **Owner**: Dev 1
- **Result**: 5 modules + shared utils
- **Ref**: Phase 2 Spec Feature 4

---

## Phase 2 (Alternative Path): Email-Based Assessment Workflow
**Status**: Architecture documented (NEXT_SESSION.md); **prioritize Phase 2 features above first**

**Context**: Aramco firewall blocks web interfaces and database connections. Email-based workflow bypasses these constraints.

**Modules**:
1. Email Analyzer (receives + parses SharePoint emails)
2. PDF Generator (creates hierarchical PDF with TOC links)
3. SharePoint Email Generator (creates assessment request/decision emails)

**Estimate**: 1 week  
**Decision**: Implement **after** Phase 2 audit features (Week 3+) or in parallel if additional resources available

**Note**: Email workflow is strategic for Aramco integration; audit export/search/alerts address immediate operational needs (transparency, compliance, maintainability)

---

## P1: High (Next 2–3 weeks)

## Phase 3: Expiry Alert System (Weeks 3–4)

### Smart Notifications
- **Features**:
  - Daily Edge Function checks personnel/equipment expiring in 30 days
  - Flags: critical (≤0 days), urgent (1–7 days), warning (8–30 days)
  - In-app notification bell + email digest
  - Users can customize alert preferences
- **Effort**: 3–4 days
- **Owner**: Dev 2
- **Dependency**: Phase 1 ✅ (notifications table exists)
- **Success metric**: Email sent within 1h of flagged expiry

---

## Phase 4: Mobile Performance & Offline (Weeks 4–6)

### Faster Lookups (< 2 min on 3G)
- Reduce API payload (select only needed columns)
- Cache crew + equipment lists to IndexedDB
- Optimize CSS rendering (avoid layout thrash)
- **Effort**: 2–3 days

### Mobile Offline Sync
- Cache full rosters on app load
- Allow offline status checks (read-only)
- Sync when back online
- **Effort**: 3–5 days

---

## Phase 5: Admin Insights (Weeks 5–7)

### Admin Dashboard
- Approval rates by assessor
- Contractor compliance trends (approval %)
- Top blockers (most-rejected cert types)
- **Effort**: 4–5 days
- **Owner**: Dev 1

### CSV Bulk Import
- Upload CSV (name, email, cert_type, expiry_date)
- Validation + error report with retry
- Success: import 50 crew in < 2 min
- **Effort**: 2–3 days
- **Owner**: Dev 1

---

## Phase 6: Enterprise Integration (Weeks 8+)

### SAML/LDAP (Aramco SSO)
- Replace email/password with Aramco Active Directory
- Auto-provision users
- Map AD groups to RADP roles
- **Effort**: 5–7 days
- **Dependency**: Aramco IT approval + SAML endpoint

### Email-Based Assessment Workflow (Alternative Path)
- Email Analyzer (receives SharePoint emails)
- PDF Generator (hierarchical PDFs with TOC links)
- SharePoint Email Generator (integration)
- **Effort**: 1 week
- **Advantage**: Firewall-friendly, email always works
- **Status**: See NEXT_SESSION.md for architecture

### SAP Integration
- Sync contractor + crew data from SAP nightly
- Reconcile with RADP records
- Flag mismatches
- **Effort**: 7 days

---

## Backlog (P2: Nice-to-Have)

- Equipment maintenance log (service intervals, inspections)
- Multi-language support (Arabic + English)
- Contractor performance ratings
- QR code scanning (equipment serial lookup)
- Advanced assessment filtering (status, date, service line, contractor)
- AI-powered certificate OCR (extract dates from PDFs)

---

## Known Bugs (Fixed in P0/P1)

- ✅ PDF upload lacks size validation → Fixed (P1.2)
- ✅ Forms don't show loading state → Fixed (P0.2)
- ✅ A11y: ARIA labels missing → Fixed (P0.1)
- ✅ assessment.js is monolithic → Fixed (P1.1, Phase 2)
- ⚠️ Expiry calc off by 1 day in some timezones → *TBD: investigate*
- ⚠️ Service line dropdown resets after adding company → *TBD: investigate*

---

## Completed (Phase 1 MVP)

✅ Audit logging (11 action types, full RLS)  
✅ Multi-role auth (contractor, assessor, operations, admin)  
✅ Equipment hierarchy (parent/child components)  
✅ PWA (offline read, install to home)  
✅ Assessment approval workflow  
✅ Aramco departments + service lines  
✅ Personnel qualifications tracking  
✅ Document upload (PDFs, JPGs)

---

## Team Capacity & Allocation

**Current Team**:
- Dev 1 (Full-stack, focus: frontend/forms)
- Dev 2 (Full-stack, focus: backend/integration)
- Tech Lead (Architecture, code review)

**Next 4 Weeks** (2026-05-01 to 2026-05-29):
- **Week 1**: P0/P1 fixes (7 days)
- **Week 2**: Phase 2 features (10 days)
- **Week 3**: Expiry system + contingency buffer (5 days)
- **Total available**: ~22 days (2 devs × ~11 days each, accounting for meetings/review)

**Velocity**: ~5–6 features/week (depends on complexity)  
**Release cadence**: Weekly deploys (Mon/Wed/Fri) after testing

---

## Success Metrics (Track Quarterly)

| Metric | Target | Q2 2026 | Q3 2026 | Owner |
|--------|--------|---------|---------|-------|
| System uptime | 99.5%+ | ✅ | ✅ | DevOps |
| Assessment approval SLA | 95% on-time | TBD | TBD | Ops |
| Audit log completeness | 100% | ✅ | ✅ | QA |
| Field lookup time (3G) | < 2 min | TBD | ✅ | Frontend |
| A11y compliance | WCAG 2.1 AA | ✅ May 1 | ✅ | QA |
| Code review turnaround | < 24h | — | ✅ | Tech Lead |
| User satisfaction | 4.0+ / 5.0 | TBD | TBD | Product |

---

## Severity Definitions

- **P0 (Critical)**: Blocking release, data loss, security, A11y violation → fix < 4h
- **P1 (High)**: Major feature broken, significant perf issue, usability gap → fix < 24h
- **P2 (Medium)**: Minor bug, UX inconsistency, tech debt → fix < 1 week
- **P3 (Low)**: Nice-to-have, polish, future optimization → backlog

---

## Communication

- **Weekly stand-up**: Tue 10am (Dev 1, Dev 2, Tech Lead, Aramco Ops)
- **Release review**: Wed 3pm (post-deployment QA review)
- **Architecture sync**: Fri 2pm (optional, as needed)
- **Status shared with**: Aramco CTO (weekly digest)

---

## References

- **Phase 2 Audit Features Spec**: `docs/superpowers/specs/2026-05-01-phase2-audit-features-design.md`
- **P0/P1 Implementation Roadmap**: `docs/superpowers/plans/2026-05-01-p0p1-fixes-implementation.md`
- **Phase 2 Email Workflow (Alternative)**: `NEXT_SESSION.md`
- **Design Context**: `.impeccable.md`
- **Code Standards**: `CLAUDE.md`

---

**Owner**: Tech Lead  
**Last updated**: 2026-05-01 (Comprehensive audit + planning complete)  
**Next review**: 2026-05-08 (post-Week 1 fixes)
