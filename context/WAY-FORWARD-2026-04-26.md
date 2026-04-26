# Way Forward: RADP Development Roadmap

**Status**: Phase 1 (MVP) Complete | Phase 2 (Enhancements) Planned  
**Last Updated**: 2026-04-26

---

## Executive Summary

RADP has achieved **MVP with comprehensive audit logging**. The system now:
- Tracks all actions (who, when, what, details)
- Enables admins to oversee all contractors
- Provides full regulatory compliance trail
- Supports offline-first field operations

**Next priority**: Enhance audit visibility (export, search) and reduce operational friction (bulk import, email alerts).

---

## Phase 1 Status: ✅ COMPLETE

| Feature | Owner | Status | Notes |
|---------|-------|--------|-------|
| Authentication | Tech Lead | ✅ | Email/password, JWT-based |
| Personnel management | Tech Lead | ✅ | Create, upload certs, track expiry |
| Equipment tracking | Tech Lead | ✅ | Hierarchy (unit → head/cable/stripper) |
| Assessments (pre-mob) | Tech Lead | ✅ | Submit → approve/reject workflow |
| Audit logging | Tech Lead | ✅ | 11 action types, 6 modules, RLS |
| Admin access | Tech Lead | ✅ | View + edit all contractor records |
| PWA (offline) | Tech Lead | ✅ | Service worker, cached roster |

**Go-Live Ready**: Yes. All critical paths tested.

---

## Phase 2: Enhancements (4–6 weeks)

### Priority 1: Audit Log Export (HIGH) 📊
**Why**: Regulatory audits require downloadable reports. Currently, audit log is web-only.

**Requirements**:
- Export format: PDF or CSV
- Filters: date range, entity type, user, action
- Include: timestamp, actor name, company, action, details
- Pagination: handle 500+ entries without browser crash
- Performance: < 5 sec for typical report (100 entries)

**Implementation**:
- **Backend**: Create Edge Function to generate PDF (use Supabase Storage)
  - Input: query params (from_date, to_date, entity_type, actor_id)
  - Output: PDF blob → download link
  - Effort: 3 days (library: pdfkit or similar)
- **Frontend**: Add "Export" button in Audit Log tab
  - UI: Date range picker, format selector, download button
  - Effort: 1 day

**Files to Create/Modify**:
- `supabase/functions/audit_export.ts` (new Edge Function)
- `js/admin.js` — add export button + call Edge Function
- `js/shared.js` — add download handler

**Testing**:
- [ ] Export PDF with 1–500 entries
- [ ] Export CSV with filters
- [ ] Verify all columns included (Who, When, Type, Action, Label)
- [ ] Verify RLS respected (contractor can't export other company's data)

**Estimate**: 4 days

---

### Priority 2: Audit Log Search (MEDIUM) 🔍
**Why**: Currently, finding a specific action requires scrolling/filtering. Need text search.

**Requirements**:
- Search field: search by user name, label, action
- Real-time search: <200ms response
- Scope: current filters + new search field

**Implementation**:
- **Frontend**: Add search input to Audit Log filters
  - Input: text field, debounce 200ms
  - Query: append `&label=ilike.%TEXT%` to PostgREST query
  - Effort: 1 day
- **Database**: No changes (ILIKE already works on label)

**Files to Modify**:
- `js/admin.js` — add search field + debounced query

**Testing**:
- [ ] Search "John" finds all John's actions
- [ ] Search "updated" finds all 'updated' actions
- [ ] Search "PDF" finds document uploads with PDF in label

**Estimate**: 1 day

---

### Priority 3: Email Alerts on Admin Actions (MEDIUM) 📧
**Why**: Contractors should know when admin edits their records (transparency, accountability).

**Requirements**:
- Trigger: any PATCH/DELETE on personnel, equipment, documents (by admin)
- Email: "Admin Jane edited your personnel record: John Doe"
- Include: what changed, when, admin name
- Recipient: contractor coordinator (company admin role)

**Implementation**:
- **Database**: Postgres trigger on personnel/equipment/documents tables
  - Condition: `current_user_role = 'admin'` AND `actor_id != contractor_id`
  - Action: INSERT into `notifications` table
  - Effort: 1 day
- **Backend**: Scheduled job (Vercel Cron) to send pending notifications
  - Runs every 30 min, sends queued emails
  - Effort: 1 day
- **Frontend**: No changes (notifications already exist; just add email channel)

**Files to Create/Modify**:
- `supabase/migrations/XXX_audit_email_trigger.sql` (new migration)
- `supabase/functions/send_notifications_email.ts` (new Edge Function)
- Cron job in `vercel.json`

**Testing**:
- [ ] Admin edits personnel → contractor gets email
- [ ] Email includes: what field changed, new value, admin name
- [ ] Non-admin edits → no email (only flagged as "internal change")
- [ ] Contractor coordinator receives email (not all crew)

**Estimate**: 2 days

---

### Priority 4: Code Refactor (LOW) 🔧
**Why**: assessment.js is 31KB, hard to maintain. Split into logical modules.

**Requirements**:
- Split assessment.js into:
  - `assessment-list.js` — load, pagination, search
  - `assessment-create.js` — form, submission
  - `assessment-detail.js` — detail view, tabs, editing
  - `assessment-personnel.js` — add/remove personnel
  - `assessment-equipment.js` — add/remove equipment
- Shared functions in `assessment-utils.js`
- No behavior changes, same tests pass

**Implementation**:
- Identify dependencies
- Create new files, move code
- Update imports in index.html
- Run full test suite
- Effort: 3 days

**Files to Create/Modify**:
- Rename `js/assessment.js` → `js/assessment-detail.js`
- Create `js/assessment-list.js`, `assessment-create.js`, etc.
- Update `index.html` script tags
- Update import statements

**Testing**:
- [ ] All existing tests pass
- [ ] Assessment list loads
- [ ] Assessment creation works
- [ ] Personnel/equipment add/remove works
- [ ] No console errors

**Estimate**: 3 days

---

### Phase 2 Summary
| Task | Priority | Effort | Owner | Dates |
|------|----------|--------|-------|-------|
| Audit export (PDF/CSV) | HIGH | 4d | TBD | May 1–5 |
| Audit search | MEDIUM | 1d | TBD | May 6 |
| Email alerts on edit | MEDIUM | 2d | TBD | May 7–8 |
| Code refactor | LOW | 3d | TBD | May 9–11 |

**Phase 2 Timeline**: 4–6 weeks (May 1 – June 15)

---

## Phase 3: Strategic Enhancements (2–3 months)

### 1. Assessment Detail in Audit Log
**UC**: Admin wants to know exactly which crew was approved on 2026-05-10.
**Current**: Audit log shows "Assessment created" but not crew roster details.
**Solution**: 
- Add "assessment_updated" action when roster changes
- Store crew roster snapshot in metadata
- Display in audit log detail view

**Effort**: 2 days

---

### 2. Admin KPI Dashboard
**UC**: Operations manager reviews weekly: "How many assessments approved? Avg time? Rejection rate?"
**Current**: No dashboard; must export and analyze manually.
**Solution**:
- New Dashboard tab (admin-only)
- Metrics: total assessments, approved %, avg approval time, top rejectors
- Charts: trend over time, by contractor, by service line
- Data source: audit_log + assessments tables

**Effort**: 5 days (3 for backend query layer, 2 for charts UI)

---

### 3. Audit Log Retention Policy
**UC**: Comply with data retention regulations (keep 7 years, delete older).
**Current**: Forever retention.
**Solution**:
- Postgres cron job: monthly, delete audit_log entries > 7 years old
- Before delete: archive to cold storage (S3)
- Admin notification: monthly digest of deleted entries

**Effort**: 2 days

---

### 4. SAML/LDAP (Aramco SSO)
**UC**: Aramco users want single sign-on (no separate RADP password).
**Current**: Email/password auth only.
**Solution**:
- Integrate Aramco IdP via SAML2 / LDAP
- Auto-provision users: pull name, email, service_line from directory
- Map roles: Aramco "Compliance Officer" → RADP "admin"

**Effort**: 5 days (3 for backend, 2 for frontend UX)

---

### 5. Equipment Maintenance Log
**UC**: Track when equipment is inspected, serviced, or calibrated.
**Current**: Expiry date only; no service history.
**Solution**:
- New table: `equipment_maintenance` (item_id, date, action, notes, file_url)
- UI: New "Maintenance" tab in equipment detail
- Audit: All maintenance actions logged
- Alert: Flag equipment due for inspection

**Effort**: 4 days

---

### 6. SAP Integration
**UC**: Sync contractor list + crew roster from Aramco's SAP ERP.
**Current**: Manual entry via app.
**Solution**:
- SAP API connection: pull contractor + crew data nightly
- Reconcile: match SAP records to RADP records, flag mismatches
- UI: "Sync from SAP" button in admin panel

**Effort**: 7 days (3 for SAP API, 2 for reconciliation, 2 for UI)

---

### Phase 3 Summary
| Feature | Effort | Notes |
|---------|--------|-------|
| Assessment detail in audit log | 2d | Quick win |
| Admin KPI dashboard | 5d | High value, medium effort |
| Audit retention policy | 2d | Compliance requirement |
| SAML/LDAP | 5d | Needed for Aramco rollout |
| Equipment maintenance log | 4d | Nice-to-have |
| SAP integration | 7d | Strategic (reduce manual work) |

**Phase 3 Timeline**: 2–3 months (June 1 – August 31)

---

## Beyond Phase 3: Strategic Bets

### 1. Blockchain Audit Trail (Low Priority)
**UC**: Provide immutable proof of who approved what when.
**Considerations**:
- Cost: ~$500/month for blockchain storage
- Complexity: integration with smart contracts
- ROI: Low (SQL audit table already immutable for 7 years)
- **Decision**: Defer indefinitely. SQL + RLS sufficient for compliance.

---

### 2. AI-Powered Cert Extraction (Medium Priority)
**UC**: Auto-extract expiry dates from PDF certificates (OCR).
**Current**: Manual entry or PDF upload.
**Effort**: 3 weeks (build OCR pipeline, train model, integrate)
**ROI**: High (saves data entry time, fewer human errors)
**Timeline**: Phase 4 (Q3 2026)

---

### 3. Mobile App (Native)
**UC**: Field supervisors use iOS/Android app instead of web.
**Current**: Responsive web app (PWA).
**Considerations**:
- Cost: ~$20K initial build
- Maintenance: 2 devs, ongoing
- ROI: Better UX, offline support, push notifications
- **Decision**: Defer until user feedback demands it. PWA sufficient for MVP.

---

## Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Contractor data overload** | Admins confused by 500+ entries | Implement search + export filters (Phase 2) |
| **Email fatigue** | Contractors ignore "admin edited" alerts | Batch daily, allow opt-out per user |
| **Data retention** | GDPR non-compliance | Implement retention policy (Phase 3) |
| **SAP sync failures** | Stale data in RADP | Manual sync fallback + alerts (Phase 3) |
| **OCR failures** | Incorrect cert dates | Require manual verification for mission-critical certs |

---

## Success Metrics (Track Quarterly)

| Metric | Target | Q2 2026 | Q3 2026 |
|--------|--------|---------|---------|
| System uptime | 99.5%+ | ✅ | ✅ |
| Assessment approval SLA | 95% on-time | TBD | TBD |
| Audit log completeness | 100% | ✅ | ✅ |
| User satisfaction | 4.0+ / 5.0 | TBD | TBD |
| Contractor onboarding time | < 30 min | TBD | TBD |

---

## Resource Allocation

### Team
- **Tech Lead**: Architecture, code review, critical bugs
- **Full-Stack Dev 1**: Phase 2 (export, search, email)
- **Full-Stack Dev 2**: Phase 3 (KPI dashboard, SAP)
- **QA**: Testing, UAT

### Budget
- **Infrastructure**: Vercel $20/mo, Supabase $25/mo → existing
- **New services** (Phase 3): SAP API integration ($50/mo), OCR service ($100/mo)
- **Third-party libraries**: pdfkit ($0, open source), chartjs ($0, open source)

---

## Next Steps (This Week)

1. **Approval**: Tech Lead signs off on Phase 2 timeline
2. **Planning**: Break Phase 2 into 2-week sprints
3. **Testing**: Full UAT of Phase 1 features in staging
4. **Deployment**: Phase 1 to production (if not already live)
5. **Feedback**: Gather contractor + assessor feedback on audit log UX

---

## Questions & Decisions Pending

1. **Export format priority**: PDF or CSV first? (Recommend: PDF, more readable for auditors)
2. **Email frequency**: Real-time or daily digest? (Recommend: Daily, reduce noise)
3. **SAP roadmap**: If Aramco mandates SAP sync, when to prioritize? (Recommend: Phase 3, after core features stable)
4. **Blockchain**: Ever needed? (Recommend: No, not in scope)

---

**Document Owner**: Tech Lead  
**Version**: 1.0  
**Last Updated**: 2026-04-26  
**Next Review**: 2026-05-01
