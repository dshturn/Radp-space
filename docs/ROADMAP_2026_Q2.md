# RADP Q2 2026 Roadmap
**Created**: 2026-05-01  
**Status**: Comprehensive audit complete; Phase 2 planning finalized  
**Scope**: May 1 – June 30, 2026

---

## Executive Summary

**Phase 1 MVP Status**: ✅ **COMPLETE AND LIVE**
- Audit logging, multi-role auth, personnel/equipment tracking, assessments, PWA
- ~3,800 lines of code across 8 modules
- Ready for operational use

**Phase 2 Planning**: ✅ **DESIGN SPECS READY**
- Two parallel paths identified: audit-focused (operational) vs. email-based (firewall workaround)
- Recommend audit-focused path first (weeks 1–2), then email-based path (weeks 3+) or in parallel

**Technical Health**: 🟡 **GOOD WITH GAPS**
- Audit Score: 14/20 (accessibility + performance issues)
- Design Score: 7/10 (brand met, A11y gaps reduce trustworthiness)
- 5 P0/P1 issues identified; all addressable in Week 1

---

## Recommended Timeline: May 1 – June 30

### Week 1: P0/P1 Fixes (May 1–8)
**Effort**: 7 days | **Team**: Dev 1 (primary), Dev 2 (support)

**P0 Issues (Blocking Phase 2)**:
1. ✅ Add ARIA labels to dynamic content (1 day, Dev 1)
2. ✅ Add loading states to forms (0.5 days, Dev 1)

**P1 Issues (Quality)**:
3. ✅ Validate PDF file size (0.5 days, Dev 1)
4. ✅ Document service worker cache strategy (0.5 days, Dev 2)
5. ✅ Make tables responsive on mobile (1 day, Dev 2)
6. ✅ Tokenize badge colors (0.5 days, Dev 2)
7. ✅ Split assessment.js into 5 modules (3 days, Dev 1)

**Deliverable**: All fixes deployed; assessment.js refactored and tested

**See**: `docs/superpowers/plans/2026-05-01-p0p1-fixes-implementation.md`

---

### Week 2: Phase 2 Features (May 8–15)
**Effort**: 10 days | **Team**: Dev 1 (primary), Dev 2 (support)

**Feature 1: Audit Log Export** (4 days, Dev 1)
- PDF and CSV formats with date/entity/action filters
- Performance: < 5s for 100 entries, < 30s for 500 entries
- RLS: contractors can export only their own audit trail
- **Impact**: Enables regulatory compliance reporting

**Feature 2: Audit Log Search** (1 day, Dev 1)
- Real-time search by actor name, entity label, action
- 300ms debounce
- Respects existing filters
- **Impact**: Auditors can quickly find specific actions

**Feature 3: Email Alerts on Admin Actions** (2 days, Dev 2)
- Trigger: Admin edits/deletes personnel, equipment, documents
- Email to contractor company admin: "Admin [name] edited [entity]: [summary]"
- **Impact**: Transparency + accountability

**Feature 4: Complete assessment.js Refactor** (2 days, Dev 1)
- Finish module extraction started in Week 1
- Extract remaining utilities to shared.js
- Full test coverage
- **Impact**: Code maintainability, parallel development enabled

**Feature 5: Misc Cleanup**
- Updated design specs in docs/
- Updated architecture documentation
- Code review + QA testing

**Deliverable**: All Phase 2 features deployed and tested

**See**: `docs/superpowers/specs/2026-05-01-phase2-audit-features-design.md`

---

### Week 3: Stabilization & Planning (May 15–22)
**Effort**: ~3–4 days | **Team**: Dev 1, Dev 2, Tech Lead

**Activities**:
1. Full regression test of Phase 1 + Phase 2 features
2. UAT with Aramco operations (assessors + contractors)
3. Performance testing and optimization (if needed)
4. Decide on Phase 3 priority (see below)
5. Planning for email-based workflow (if proceeding)

**Deliverable**: Phase 1 + Phase 2 proven stable in production

---

### Week 4: Phase 3 Begins (May 22–29)
**Effort**: TBD (based on priority chosen)

**Option A: Expiry Alert System**
- Daily Edge Function checks for expiring documents (30-day window)
- In-app notification bell + email digest
- Flag levels: critical (≤0 days), urgent (1–7 days), warning (8–30 days)
- Effort: 3–4 days
- **Impact**: Proactive compliance management

**Option B: Email-Based Assessment Workflow**
- Email Analyzer (receives/parses SharePoint emails)
- PDF Generator (hierarchical PDFs with TOC + internal links)
- SharePoint Email Generator (custom workflow)
- Effort: 1 week
- **Impact**: Firewall-friendly integration with Aramco SharePoint
- **Note**: Complex SharePoint customization; may require IT approval

**Option C: Mobile Performance**
- Cache crew + equipment lists to IndexedDB
- Reduce API payloads
- Target: < 2 min lookup on 3G
- Effort: 2–3 days
- **Impact**: Better field supervisor experience

**Tech Lead decision needed by end of Week 2**

---

### Weeks 5–8: Phase 3 + Contingency (May 29 – June 30)

**If Option A (Expiry Alerts)**:
- Weeks 5–6: Implementation + testing
- Weeks 7–8: Buffer for bugs, refinement, user feedback

**If Option B (Email Workflow)**:
- Weeks 5–7: Email Analyzer + PDF Generator + SharePoint integration
- Week 8: UAT with Aramco (critical — may find issues)

**If Option C (Mobile Perf)**:
- Weeks 5–6: Implementation + testing
- Weeks 7–8: Buffer + potential Phase 4 start (admin dashboard or SAML)

---

## Parallel Work (As Capacity Allows)

### Documentation
- Update architecture.md with Phase 2 design decisions
- Document A11y compliance checklist (WCAG 2.1 AA)
- Record testing checklists in test wiki

### Code Quality
- Add unit tests for critical paths (auth, audit logging)
- Set up GitHub Actions for automated testing
- Establish code review SLA (< 24h turnaround)

### Monitoring
- Set up Vercel Analytics dashboard
- Monitor error rates and performance metrics
- Track user satisfaction (in-app feedback form)

---

## Q2 Timeline Summary

| Weeks | Phase | Effort | Owner | Status |
|-------|-------|--------|-------|--------|
| 1 (May 1–8) | P0/P1 Fixes | 7 days | Dev 1 + Dev 2 | **🔴 In Progress** |
| 2 (May 8–15) | Phase 2 Features | 10 days | Dev 1 + Dev 2 | **🟡 Ready to Start** |
| 3 (May 15–22) | Stabilization | 3–4 days | Full Team | **🟡 Planned** |
| 4–8 (May 22 – Jun 30) | Phase 3 + Buffer | TBD | Dev 1 + Dev 2 | **🟡 Options pending decision** |

**Total Committed Effort**: 20–22 days (weeks 1–3)  
**Total Available**: ~44 days (2 devs × 22 working days)  
**Buffer**: ~22 days for testing, code review, fixes, unplanned work

---

## Success Criteria (Q2)

**Week 1 (May 8)**:
- ✅ All P0 issues fixed (ARIA, form states)
- ✅ All P1 issues fixed (validation, cache, tables, tokens, refactoring)
- ✅ Code review approved by Tech Lead

**Week 2 (May 15)**:
- ✅ Audit export working (PDF and CSV)
- ✅ Audit search real-time and responsive
- ✅ Email alerts sent within 1 minute of admin action
- ✅ assessment.js fully split and tested

**Week 3 (May 22)**:
- ✅ Full regression test passed
- ✅ UAT with Aramco (at least 1 assessor + 1 contractor)
- ✅ No regressions from Phase 1 features
- ✅ Performance baseline established (audit export < 5s for 100 entries)

**End of Q2 (June 30)**:
- ✅ Phase 1 + Phase 2 stable in production
- ✅ Phase 3 feature spec'd and partially or fully implemented
- ✅ Team velocity trending upward (fewer bugs, faster reviews post-refactor)
- ✅ Aramco stakeholders satisfied with audit/compliance tooling

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| **A11y fixes break existing UI** | Users can't submit forms | Low | Comprehensive testing with screen readers + automated scans |
| **assessment.js refactor creates bugs** | Workflows broken | Low | Extract with zero behavior changes; test each workflow before merging |
| **Email alerts service fails** | Contractors not notified | Low | Add error logging + fallback; implement retry logic |
| **Audit export performance slow** | Users wait > 30s for large reports | Medium | Implement pagination + limits (cap 10k rows); offer date filtering |
| **SharePoint integration blocks Phase 3** | Email workflow delayed | Medium | Start email analyzer in parallel; test independently |
| **Aramco firewall blocks email service** | Email alerts fail | Low | Have fallback: in-app notifications only (less ideal) |

---

## Resource Plan

### Team
- **Dev 1** (Full-stack, frontend focus): assessment forms, audit features, UI refactoring
- **Dev 2** (Full-stack, backend focus): email alerts, cache strategy, SharePoint integration
- **Tech Lead** (Architecture, code review): ~20% time

### Tools & Services
- **Vercel**: Deployment, serverless functions (~$20/mo, existing)
- **Supabase**: PostgreSQL, auth, storage (~$25/mo, existing)
- **Resend** or **SendGrid**: Email service (~$50/mo for Phase 2+)
- **NVDA/VoiceOver**: Accessibility testing (free)
- **GitHub Actions**: CI/CD pipeline (free tier sufficient)

### Budget (Q2)
- **Infrastructure**: ~$3,000 (existing services + email)
- **Third-party libraries**: $0 (using open source)
- **Contingency (10%)**: $300

---

## Key Decisions Pending

1. **Phase 3 Priority** (due by May 15):
   - Expiry alerts (operational, 3–4 days) vs.
   - Email workflow (strategic, 1 week) vs.
   - Mobile perf (UX, 2–3 days)?
   - **Recommendation**: Expiry alerts first (quick win), then email workflow (strategic)

2. **Email Service** (due by May 8):
   - Use Resend, SendGrid, or Supabase email?
   - **Recommendation**: Resend (simple API, good free tier)

3. **WCAG Compliance Level** (due by May 1):
   - Target WCAG 2.1 AA (standard) or AAA (best)?
   - **Recommendation**: AA (accessibility guidelines recommend AA; AAA for future)

4. **Testing Framework** (due by May 22):
   - Add Jest + Vitest for unit tests? Or keep manual testing?
   - **Recommendation**: Manual for now; add Jest in Phase 4 if team capacity increases

---

## Communication Plan

- **Weekly stand-up**: Tue 10am (Dev 1, Dev 2, Tech Lead, Aramco Ops)
- **Release review**: Wed 3pm (after deployment, QA + Tech Lead)
- **Architecture sync**: Fri 2pm (optional, discuss blockers/decisions)
- **Status updates**: Shared with Aramco CTO (bi-weekly digest)

---

## References

- **Phase 2 Audit Features Design Spec**: `docs/superpowers/specs/2026-05-01-phase2-audit-features-design.md`
- **P0/P1 Implementation Roadmap**: `docs/superpowers/plans/2026-05-01-p0p1-fixes-implementation.md`
- **Email-Based Workflow (Alternative Phase 2)**: `NEXT_SESSION.md`
- **Design Context**: `.impeccable.md`
- **Code Standards**: `CLAUDE.md`
- **Task Tracking**: `context/tasks.md`

---

## Version History

| Date | Author | Changes |
|------|--------|---------|
| 2026-05-01 | Tech Lead + Claude | Initial Q2 roadmap; comprehensive audit integration |
| TBD | Tech Lead | Weekly updates as phases progress |

---

**Prepared by**: Claude Code (AI Architecture + Analysis)  
**Approved by**: *[Tech Lead signature pending]*  
**Next review**: 2026-05-08 (end of Week 1)
