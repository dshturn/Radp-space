# Aramco SharePoint Integration - Technical Analysis

**Analysis Date**: 2026-04-26  
**Status**: Complete  
**Scope**: Contractor assessment & document management in SharePoint

---

## Current SharePoint Architecture

### Platform
- **Platform**: SharePoint Online
- **Base URL**: `https://sharek.aramco.com.sa/orgs/30002972/30037952/`
- **Authentication**: Form Digest (CSRF token) + SharePoint REST API
- **API Type**: OData v3 (verbose format)

### Three Main Lists (With GUIDs)

| List Name | GUID | Purpose |
|-----------|------|---------|
| **ONWCOD** | 0BEA2164-4ADD-45F8-B462-C838F331246C | Onshore Well Completion Overhaul Division |
| **OFFWCOD&WSD** | 1CDF80FC-8319-4D5F-8186-437C9DDB2C7F | Offshore Well Completion & Well Services Division |
| **ONWSD** | 259ACF29-2737-41CB-A8DD-C8692A9AAF1A | Onshore Well Services Division |

---

## Data Model

### SharePoint List Structure

Each list contains:
- **Records** (list items with ID)
  - Title
  - Status (dropdown field with multiple choices: e.g., Draft, Submitted, Approved, Rejected, etc.)
  - Assessment Type
  - Service Provider (contractor name)
  - Service Type (slickline, CT, pumping, etc.)
  - Created/Modified (timestamps)
  - Other metadata fields (assessor, dates, etc.)

- **Attachments** (per record)
  - Excel files (.xlsx)
  - PDF files (.pdf)
  - Uploaded via REST API

### Key Fields (From code analysis)
- `ID` — unique record identifier
- `Title` — assessment/request name
- `Status` — current state (field with predefined choices)
- `Assessment_x0020_Type` — type of assessment
- `Service_x0020_Provider` — contractor/company name
- `Service_x0020_Type` — service category
- `Modified` — last change timestamp
- Attachment files — Excel, PDF

### Data Pagination
- SharePoint returns up to **5000 items** per request
- Pagination via `__next` property in OData response
- All items fetched recursively until `__next` is null

---

## Current API Operations

### 1. **Fetch Data** ✅
```
GET https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists(guid'{listGuid}')/items
  ?$orderby=Modified desc&$top=5000
```
- **Returns**: All list items with all fields
- **Pagination**: Handles via `__next` property
- **Response format**: OData v3 verbose (`data.d.results`)

### 2. **Get Status Choices** ✅
```
GET https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists(guid'{listGuid}')/fields
  ?$filter=Title eq 'Status'&$select=Choices
```
- **Returns**: List of available status options for a field
- **Purpose**: Populate status dropdown in UI
- **Example**: ['Pending', 'Approved', 'Rejected', 'In Review']

### 3. **Update Record Status** ✅
```
POST https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists(guid'{listGuid}')/items({itemId})
Headers:
  X-HTTP-Method: MERGE
  If-Match: *
  X-RequestDigest: {formDigestValue}
Body:
  { "Status": "newStatus" }
```
- **Authentication**: Requires Form Digest token
- **Method**: MERGE (SharePoint UPDATE pattern)
- **Validation**: Gets `__metadata.type` before update (for type checking)

### 4. **Upload Attachments** ✅
```
POST https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists(guid'{listGuid}')/items({itemId})/AttachmentFiles/add(FileName='{filename}')
Headers:
  Content-Type: {fileType}
  X-RequestDigest: {formDigestValue}
Body: {fileBlob}
```
- **Supports**: Any file type (Excel, PDF tested)
- **Returns**: Success/error response
- **Use cases**: Upload LoR (Letter of Responsibility) Excel, PDF assessments

---

## Authentication & Security

### Form Digest (CSRF Token)
Required for all write operations (PATCH, POST):
```
POST https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/contextinfo
Headers:
  Accept: application/json; odata=verbose
  Content-Type: application/json; odata=verbose

Response:
  {
    "d": {
      "GetContextWebInformation": {
        "FormDigestValue": "..." // Use in X-RequestDigest header
      }
    }
  }
```

### Headers Required
- **Accept**: `application/json; odata=verbose`
- **Content-Type**: `application/json; odata=verbose` (for POST/PATCH)
- **X-HTTP-Method**: `MERGE` (for updates)
- **If-Match**: `*` (for updates)
- **X-RequestDigest**: Form digest token (for write operations)

### No API Keys/OAuth in Current Implementation
- Uses **Form Digest** security model (standard SharePoint)
- Credentials: SharePoint user context
- **Implication**: Client-side code runs in SharePoint, has implicit user context

---

## Current SharePoint Dashboard

### UI Components (From Dashboard.html)

**KPI Row** (Key Performance Indicators)
- Display high-level metrics (e.g., total assessments, approved %, etc.)

**Two Main Sections**:

1. **ONWCOD Section** (Left Column)
   - ONWCOD Packages (grid of tiles)
   - ONWCOD Active Requests (grid of tiles)
   - Each tile shows status: Green (complete), Yellow (warning/in progress), Red (expired)

2. **OFFWCOD & WSD Section** (Right Column)
   - OFFWCOD & WSD Packages (grid of tiles)
   - OFFWCOD/WSD Active Requests (grid of tiles)

**Tile Colors**:
- 🟢 Green: Valid/complete status
- 🟡 Yellow: Warning (e.g., expiring soon)
- 🔴 Red: Expired/incomplete

**Dialog Windows**:
- Change status for records
- Create Crew/Equipment Change Requests (form with fields for assessment type, service provider, etc.)

---

## Mapping SharePoint ↔ RADP

### What Exists in SharePoint → How to Map to RADP

| SharePoint | RADP | Mapping |
|-----------|------|---------|
| List (ONWCOD, OFFWCOD&WSD, ONWSD) | service_line | ONWCOD → "slickline", OFFWCOD → "offshore", etc. |
| Service Provider | contractor (user_profiles.company) | Contractor company name |
| Assessment Type | assessment.type | Type of assessment (routine, urgent, renewal) |
| Service Type | assessment.service_type | slickline, CT, pumping, etc. |
| Records | assessments | Pre-mob assessment records |
| Status | assessment.status | draft, submitted, approved, rejected |
| Attachments | documents | Uploaded Excel (LoR), PDF assessments |
| Modified | created_at, updated_at | Timestamp fields |

### What Needs to be Added to SharePoint (For Two-Way Sync)

1. **RADP Assessment ID** — To link SharePoint record ↔ RADP assessment
2. **Contractor ID** — To link to RADP contractor
3. **Crew/Equipment Lists** — Current format doesn't show personnel/equipment details
4. **Cert Expiry Dates** — SharePoint doesn't have cert data; RADP provides it

---

## Integration Strategy Options

### Option A: Read-Only Sync (Recommended First Phase) ⭐
**Description**: RADP fetches data from SharePoint, displays in UI. No write-back.

**Workflow**:
1. Contractor creates assessment in RADP
2. When submitting, RADP:
   - Fetches contract from SharePoint (by contractor name)
   - Displays contract terms in assessment detail
   - Shows historical assessments from SharePoint
3. Assessor reviews + approves in RADP
4. Admin manually updates SharePoint status (or implement write-back later)

**Pros**: Simple, low risk, minimal authentication concerns
**Cons**: Data remains fragmented (updates in SharePoint don't flow to RADP)
**Effort**: 3-4 days

---

### Option B: Two-Way Sync (Full Integration)
**Description**: RADP ↔ SharePoint fully synchronized.

**Workflow**:
1. Create assessment in RADP
2. Auto-create corresponding record in SharePoint
3. Contractor updates contract in SharePoint
4. RADP detects change, flags for re-assessment
5. Approvals in RADP → update status in SharePoint
6. Documents flow both ways

**Pros**: Single source of truth, full automation
**Cons**: Complex conflict handling, requires robust error recovery
**Effort**: 2-3 weeks

---

### Option C: Hybrid (Recommended) ⭐⭐
**Description**: Read contractor data from SharePoint; write assessments only to RADP.

**Workflow**:
1. Contractor creates assessment in RADP (certs, equipment)
2. Assessment references contract (auto-fetched from SharePoint)
3. Approval in RADP updates SharePoint status (if record exists)
4. Document uploads to RADP only (no back-sync to SharePoint)
5. Assessors can view latest SharePoint contract version without leaving RADP

**Pros**: Balanced - minimal new data, but single workflow
**Cons**: Still needs write-back to SharePoint
**Effort**: 1-2 weeks

---

## Data Synchronization

### Real-Time vs Scheduled

**Current Implementation**: None (static SharePoint site)

**Options**:

1. **Scheduled Sync** (Cron Job)
   - Every hour: Fetch all SharePoint records
   - Compare to RADP `assessments` table
   - Insert new records, update status, flag changes
   - **Pros**: Simple, no webhooks needed
   - **Cons**: Up to 1h latency
   - **Effort**: 2 days

2. **Real-Time via Webhook** (Not currently implemented in SharePoint)
   - SharePoint sends webhook → RADP endpoint on record change
   - RADP updates database immediately
   - **Pros**: Zero latency
   - **Cons**: Requires SharePoint webhook setup (may need IT approval)
   - **Effort**: 3 days (if webhooks available)

3. **Hybrid** (Recommended)
   - Scheduled sync as baseline (every 6 hours)
   - User-triggered sync ("Refresh" button) for immediate updates
   - **Effort**: 1 day

---

## Implementation Roadmap

### Phase 1: Read-Only (Week 1) ⭐ **START HERE**
1. **Day 1-2**: Create Supabase Edge Function to fetch SharePoint data
   - Fetch contractor records by name
   - Cache results locally
   - Error handling
2. **Day 3**: Update RADP UI to show "Aramco Contract" section
   - Display contract details (term, renewal date, service types)
   - Add link to full contract in SharePoint
3. **Day 4**: Testing + deployment

**Output**: Assessors see contracts without leaving RADP

### Phase 2: Status Sync (Week 2)
1. After assessment approved in RADP
2. Auto-update SharePoint record status
3. Test conflict handling

**Output**: SharePoint records updated automatically

### Phase 3: Full Integration (Week 3-4)
1. Create assessment → auto-create SharePoint record
2. Delete assessment → mark SharePoint as deleted
3. Document sync (if needed)

---

## Critical Implementation Details

### 1. User Context Authentication
**Challenge**: Current code runs in SharePoint (implicit auth). RADP backend needs explicit auth.

**Solution Options**:
- **A**: Service account (Aramco IT provides)
  - Username + password
  - Permanent credentials
  - **Pros**: Always works
  - **Cons**: Password rotation, security risk
  
- **B**: OAuth 2.0 (if Aramco supports)
  - User-based tokens
  - **Pros**: Secure, audit trail
  - **Cons**: More complex setup
  
- **C**: API Keys / Client ID (if available)
  - Static API key for service calls
  - **Pros**: Simple for backend
  - **Cons**: No user audit trail

**Recommendation**: Clarify with Aramco IT which authentication method is available for external (non-SharePoint) integrations.

### 2. Form Digest Token Expiry
Current code gets fresh digest for each request (correct approach).
- **Validity**: ~1 hour
- **Strategy**: Fetch new digest before each write operation
- **Cost**: One extra API call per write

### 3. Data Filtering by Contractor
**Current**: Fetch all records, filter client-side
**Better**: Filter via OData `$filter` parameter

**Example**:
```
GET /items?$filter=Service_x0020_Provider eq 'NESR'
```

**Benefit**: Reduces payload, faster sync

### 4. Contractor ID Mapping
**Current**: Match by name (brittle)
**Better**: SharePoint records should have a RADP contractor_id field

**Action**: Ask Aramco to add `RADP_ContractorID` field to lists (optional but helpful)

---

## Error Handling Strategy

### Network Errors
- Retry logic: 3 attempts with exponential backoff
- Fallback: Show cached data if available
- Alert: Notify admin on persistent failures

### Authentication Errors
- Form digest expired → fetch new one, retry
- Unauthorized → alert admin, check credentials
- Rate limited → queue requests, retry later

### Data Inconsistencies
- Record in RADP but not in SharePoint → create
- Record in SharePoint but not in RADP → sync on next pull
- Conflict (updated in both) → last-write-wins, log discrepancy

---

## Security Considerations

### Data Residency
- SharePoint data stays in Aramco's datacenter
- RADP can cache contractor IDs + contract summaries
- **Policy**: Don't store sensitive contract terms in RADP (reference only)

### Audit Trail
- All API calls to SharePoint logged (via SharePoint audit log)
- All RADP changes logged (to RADP audit_log)
- **Question**: Cross-system audit trail needed? (who approved in RADP vs SharePoint)

### Encryption
- HTTPS only (SharePoint enforces)
- Form digest prevents CSRF
- **Question**: Need additional encryption for cached data?

---

## Quick Start: Dev Plan

### Week 1 (Read-Only)
```
Day 1-2: Create Vercel Edge Function
  - `/api/sharepoint/get-contractor`
  - `/api/sharepoint/get-contracts`
  - Error handling, caching

Day 3: Update RADP UI
  - Add "Aramco Info" section in assessment
  - Fetch + display contract details
  - Add "Open in SharePoint" link

Day 4: Test + Deploy
  - Test with real Aramco credentials
  - Verify data display
  - Performance check
```

### Week 2 (Status Sync)
```
Day 1-2: Add write capability
  - `/api/sharepoint/update-status`
  - Get form digest, update record
  - Error handling

Day 3-4: Wire to approval workflow
  - After RADP approval, call SharePoint update
  - Test status change flow
```

---

## Questions for Aramco IT

1. **Authentication**: Which method should we use?
   - Service account username/password?
   - OAuth 2.0 credentials?
   - API key / Client ID?

2. **Webhooks**: Does SharePoint support outbound webhooks?
   - For real-time sync to RADP?
   - Or should we stick with scheduled polling?

3. **Data Access**: Can external apps (Vercel Edge Functions) access SharePoint?
   - From external IP (not on Aramco network)?
   - Any VPN/IP whitelist needed?

4. **Field Additions**: Can we add a field to lists for RADP mapping?
   - `RADP_ContractorID` — links to RADP contractor
   - `RADP_AssessmentID` — links to RADP assessment

5. **Rate Limits**: Any rate limiting on SharePoint API calls?
   - Requests per minute?
   - Batch operation limits?

6. **Data Backup**: Should RADP cache contractor records?
   - For offline access?
   - For performance?

---

## Architecture Diagram

```
┌──────────────────────────────────────────┐
│         RADP Frontend (Browser)          │
│  - Assessment form                       │
│  - View contracts from SharePoint        │
│  - Approve/reject                        │
└───────────────┬─────────────────────────┘
                │
        ┌───────▼────────────────┐
        │  RADP Backend (Vercel) │
        │  Edge Functions:       │
        │  - /api/sharepoint/*   │
        │  - Fetch contracts     │
        │  - Update status       │
        │  - Handle auth         │
        └───────┬────────────────┘
                │ HTTPS
    ┌───────────▼──────────────────┐
    │  SharePoint Online REST API  │
    │  https://sharek.aramco...    │
    │                              │
    │  Lists:                      │
    │  - ONWCOD (guid)             │
    │  - OFFWCOD&WSD (guid)        │
    │  - ONWSD (guid)              │
    │                              │
    │  Operations:                 │
    │  - GET /lists/.../items      │
    │  - POST /lists/.../items     │
    │  - MERGE /lists/.../items(n) │
    │  - POST .../AttachmentFiles  │
    └──────────────────────────────┘
```

---

## Next Steps

1. **Clarify questions** with Aramco IT (above)
2. **Get credentials**: Service account or OAuth tokens
3. **Test connectivity**: Can Vercel reach SharePoint API?
4. **Start Phase 1**: Read-only sync
5. **Iterate**: Phase 2 (status), Phase 3 (full)

---

**Prepared by**: Claude  
**Date**: 2026-04-26  
**Status**: Ready for implementation
