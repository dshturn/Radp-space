# Aramco SharePoint Integration - Vision

**Goal**: RADP becomes the single source of truth for contractor compliance, with seamless access to Aramco's contract & document archive.

---

## Current State (Before Integration)

### User Pain Points
- **Contractor coordinator**: "I upload certs to RADP AND to Aramco SharePoint. Double work."
- **Assessor**: "I check RADP for certs, but need to log into SharePoint for the actual contract. Manual context switching."
- **Operations manager**: "File version control nightmare—different versions in RADP vs SharePoint."

### Data Fragmentation
- Contractor info in: RADP (name, email, service_line) + SharePoint (contract, address, contact details)
- Assessment info in: RADP (crew roster, certs) + SharePoint (contracts, SOW, job details)
- Files in: RADP (cert uploads) + SharePoint (contracts, invoices, agreements)

---

## Future State (After Integration)

### Seamless Workflow

#### UC1: Contractor Submits Assessment
1. Coordinator opens RADP → "New Assessment"
2. System auto-populates:
   - Crew roster from RADP (same as today)
   - Equipment from RADP (same as today)
   - **NEW**: Contract & SoW from Aramco SharePoint (auto-fetch, no manual lookup)
3. Checklist includes:
   - Cert requirements from RADP (existing)
   - **NEW**: Contract terms (coverage, liability) from SharePoint
4. Submit → Assessor notified

#### UC2: Assessor Reviews Assessment
1. Assessor opens RADP → Assessment detail
2. Sees:
   - Personnel + certs (existing)
   - Equipment (existing)
   - **NEW**: Contract terms from Aramco (view contract PDF inline)
   - **NEW**: Previous assessments for this contractor (from Aramco archive)
3. Approves → Status updated in both RADP + Aramco audit log

#### UC3: Contractor Updates Contract in Aramco
1. Contractor negotiates renewal → updates SharePoint
2. RADP detects change → flags in audit log
3. Assessor notified → re-reviews compliance
4. No manual sync needed

#### UC4: Operations Manager Reports
1. Opens RADP dashboard → "Compliance by Contractor"
2. Sees:
   - Assessment status (from RADP)
   - **NEW**: Contract renewal dates (from Aramco)
   - **NEW**: Historical approvals (from Aramco audit)
3. Exports report → single PDF with all context

---

## Key Capabilities

### 1. Unified Document View
- **Before**: Toggle between RADP + Aramco SharePoint
- **After**: All files visible in RADP, with source indicated

**Example UI**:
```
Contractor: NESR
├─ RADP Documents
│  ├─ Personnel: John Doe (H2S cert, expires 2026-06-15)
│  ├─ Equipment: Slickline unit (cert valid until 2026-08-01)
│  └─ Assessment: Approved 2026-04-10
└─ Aramco Documents (synced from SharePoint)
   ├─ Contract: NESR-SLC-2024-001 (expires 2026-12-31)
   ├─ Statement of Work: Well X Slickline Services
   ├─ Invoice: INV-2026-04-10 (paid)
   └─ Change Order: CO-001 (pending signature)
```

### 2. Automated Sync
- **Before**: Manual download from Aramco, manual upload to RADP
- **After**: Background sync (hourly or real-time via webhook)

**What syncs**:
- New contractor files → RADP documents table
- Contract updates → flag for re-assessment
- Assessor approvals → logged in Aramco (via API callback)

### 3. Role-Based Access
- **Contractor**: Sees own RADP records + own Aramco files (contracts, invoices)
- **Assessor**: Sees all RADP + all Aramco (contracts, SOWs, approvals)
- **Admin**: Full visibility + analytics

### 4. Audit Trail Integration
- **Before**: RADP audit log + separate Aramco audit log (no cross-reference)
- **After**: Unified audit log
  - Who accessed what file, when, from where (RADP or Aramco)
  - Who approved assessment, based on which contract version
  - Compliance evidence for regulators

---

## Technical Architecture

```
┌─────────────────────────────────────────┐
│         RADP Frontend (Browser)          │
│  - Assessment form                       │
│  - Contractor dashboard                  │
│  - Audit log viewer                      │
└───────────────┬─────────────────────────┘
                │
        ┌───────▼────────┐
        │  RADP Backend   │
        │  (Supabase)     │
        │                 │
        │  Tables:        │
        │  - personnel    │
        │  - assessments  │
        │  - documents    │
        │  - audit_log    │
        └───────┬────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌──────────┐ ┌─────────┐ ┌──────────┐
│ Vercel   │ │Supabase │ │Supabase  │
│Functions │ │Storage  │ │ Edge Fn  │
│(Sync)    │ │(Files)  │ │(Auth,    │
│          │ │         │ │ Webhook) │
└──────────┘ └─────────┘ └─────┬────┘
                               │
                    ┌──────────▼──────────┐
                    │ Aramco SharePoint   │
                    │ REST API            │
                    │                     │
                    │ - GET /files        │
                    │ - POST /files       │
                    │ - Webhook callbacks │
                    └─────────────────────┘
```

### Data Flow

**Scenario: New contractor file uploaded to Aramco**
1. Contractor uploads contract to Aramco SharePoint
2. Aramco sends webhook → Vercel Edge Function
3. Edge Fn fetches file metadata: contractor ID, file type, date
4. Creates record in RADP `documents` table (source: "aramco_sharepoint")
5. Logs to audit_log: "Contractor ABC uploaded contract"
6. Assessor sees notification in RADP: "New contract from NESR"

**Scenario: Assessor approves assessment**
1. Assessor clicks "Approve" in RADP
2. RADP stores approval in `assessments` table
3. RADP logs to audit_log: "Assessor Jane approved assessment #5678"
4. Vercel Function calls Aramco API: POST /assessments/{id}/approve
5. Aramco logs approval in its audit trail
6. Contractor notified (RADP + email from Aramco)

---

## Benefits

| Stakeholder | Benefit |
|---|---|
| **Contractor** | Single source of truth; no duplicate uploads; historical context visible |
| **Assessor** | Full context in one tab; faster approvals; audit trail automatic |
| **Operations Manager** | Compliance dashboard; contract visibility; analytics; regulatory reports |
| **Aramco IT** | Reduced manual file management; single audit trail; automated sync |

---

## Phased Rollout

### Phase 2a: Read-Only Sync (Week 1–2)
- Fetch contractor files from Aramco (contracts, invoices)
- Display in "Aramco Documents" tab in RADP
- No two-way sync yet

**User impact**: Assessors can see Aramco files without leaving RADP

### Phase 2b: Two-Way Sync (Week 3–4)
- RADP assessor approvals → update Aramco
- Aramco contract updates → trigger RADP notification
- Conflict handling: manual or auto-resolve?

**User impact**: Single source of truth; automatic notifications

### Phase 2c: Analytics & Reporting (Week 5–6)
- Dashboard: compliance by contractor, contract renewal dates
- Reports: export compliance + contract status to PDF/CSV

**User impact**: Operations manager visibility

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Aramco API down** | Sync fails, RADP shows stale data | Graceful degradation; cache; alert admin |
| **Conflicting updates** | Same file edited in Aramco + RADP | Last-write-wins or manual resolution UI |
| **Large file sync** | Network bandwidth, storage limits | Batch processing, incremental sync, file size limits |
| **Authentication failure** | Service account revoked, sync stops | Fallback to manual sync; alert protocol |
| **Data mapping errors** | Wrong contractor linked to wrong contract | Validation layer, audit trail, manual review |

---

## Success Criteria

| Metric | Target | Measurement |
|---|---|---|
| **Sync latency** | < 5 min for new files | Monitor Edge Function logs |
| **Sync success rate** | 99%+ | Count successful syncs / total attempts |
| **User adoption** | 80% of assessors use Aramco link | Feature analytics |
| **Reduced manual work** | 30% less context switching | User survey |
| **Audit trail completeness** | 100% of actions logged | Audit log row count |

---

## Dependencies

- ✅ Aramco provides SharePoint REST API documentation
- ✅ Service account credentials for API access
- ✅ Webhook URL for real-time notifications (or polling acceptable)
- ✅ Data mapping (Aramco contractor ID ↔ RADP contractor_id)
- ✅ IT security approval (encryption, data residency, audit)

---

## Questions to Answer

1. **Real-time or scheduled sync?**
   - Option A: Webhook → real-time (fast, complex)
   - Option B: Cron job every hour (simple, 1h latency)
   - **Decision pending**: TBD

2. **One-way or two-way?**
   - Option A: Read-only from Aramco (simple, limited)
   - Option B: Both directions (full sync, complex conflict handling)
   - **Decision pending**: TBD

3. **File storage?**
   - Option A: Copy files to Supabase Storage (full control, storage cost)
   - Option B: Link to Aramco files (no copy, but depends on Aramco availability)
   - **Decision pending**: TBD

---

**Owner**: Tech Lead  
**Version**: 1.0  
**Created**: 2026-04-26  
**Status**: Vision, awaiting implementation plan
