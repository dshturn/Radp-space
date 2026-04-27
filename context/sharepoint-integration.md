# SharePoint Integration: RADP Assessment LoR Module

**Status**: Phase 3 (LoR Module) — Blocked on backend access  
**Last Updated**: 2026-04-27  
**Owner**: Tech Lead  
**Blocker**: Aramco firewall blocks outbound requests to supabase.co domain

---

## Executive Summary

RADP integrates with Aramco's SharePoint environment to provide assessors with a **List of Readiness (LoR)** module. Assessors work primarily in SharePoint; RADP serves as the backend data source.

**Three-phase integration:**
1. **Phase 1 (✅ Complete)**: Read-only sync — contractors link SharePoint request IDs to RADP assessments; assessors see Aramco contract info in RADP
2. **Phase 2 (✅ Complete)**: Status sync — assessment approvals automatically update SharePoint record status
3. **Phase 3 (🟡 In Development)**: LoR module in SharePoint — assessors view tree-structured document review interface with personnel/equipment

**Current Blocker**: CORS restrictions prevent cross-origin authentication from SharePoint iframe.

---

## Phase 1: Read-Only Sync (✅ Complete)

### Requirements
- Contractors assign SharePoint `request_id` when creating assessment in RADP
- Assessors see Aramco contract info (service line, field, job type) pulled from SharePoint cache
- No write-back to SharePoint

### Implementation
**Files**:
- `supabase/migrations/001_sharepoint_cache.sql` — `sharepoint_cache` table with RLS
- `supabase/functions/sharepoint-get-contractor/index.ts` — Edge Function to fetch contract data
- `js/assessment.js` — Display contract info in assessment form

**Data Flow**:
1. Contractor selects request ID when creating assessment
2. Edge Function calls SharePoint OData API → fetches contract details
3. Results cached in `sharepoint_cache` table
4. Assessor views cached contract info (read-only)

**Database**:
```sql
CREATE TABLE sharepoint_cache (
  request_id INT PRIMARY KEY,
  contractor_id UUID,
  field_well TEXT,
  type_of_job TEXT,
  objective TEXT,
  cached_at TIMESTAMP DEFAULT now()
);

-- RLS: All roles can read (public data)
ALTER TABLE sharepoint_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_read" ON sharepoint_cache FOR SELECT USING (true);
```

**Status**: ✅ Deployed and tested

---

## Phase 2: Status Sync (✅ Complete)

### Requirements
- When assessor approves/rejects assessment in RADP, automatically update SharePoint list status
- No manual re-entry of status in SharePoint

### Implementation
**Files**:
- `supabase/functions/sharepoint-update-status/index.ts` — Edge Function to update status

**Data Flow**:
1. Assessor clicks "Approve" in RADP
2. Trigger: POST to Edge Function with `assessmentId`, `sharepointId`, `newStatus`
3. Edge Function:
   - Gets Form Digest token (SharePoint auth)
   - Calls SharePoint MERGE API
   - Updates assessment with sync status
4. Result: SharePoint list reflects RADP approval

**SharePoint API Integration**:
```typescript
// Get Form Digest (required for MERGE)
POST https://sharek.aramco.com.sa/_api/contextinfo
Headers: Authorization: Basic {base64(username:password)}

// Update list item
POST https://sharek.aramco.com.sa/_api/web/lists(guid'XXX')/items(123)
Headers: 
  - X-HTTP-Method: MERGE
  - X-RequestDigest: {formDigest}
  - If-Match: *
Body: { __metadata: { type: 'SP.ListItem' }, Status: 'Approved' }
```

**Credentials**: Stored in Supabase environment variables (service account)

**Status**: ✅ Deployed and tested

---

## Phase 3: Assessment LoR Module in SharePoint (🟡 In Development)

### Requirements
- **Where**: Embedded in SharePoint as iframe or native page
- **Who**: Assessors (only those with 'assessor' or 'admin' role)
- **What**: Login → search assessment ID → view tree-structured LoR
- **Data**: Personnel (name, position, cert docs with expiry dates) + Equipment (serial #, model, cert docs)
- **Status Badges**: Valid (green), Expiring (yellow), Expired (red) based on document expiry dates
- **Viewer**: Click "View" on document → open PDF/image in modal
- **Print**: Full LoR printable

### Files
```
aramco/sharepoint/
├── assessment/
│   ├── index.html        (LoR UI + login form)
│   └── script.js         (Auth + API logic)
└── RADP/
    └── index.html        (Main portal with assessment tab)
```

### Implementation

#### Architecture
**Client (SharePoint iframe)**:
- `index.html`: Login form + LoR display (tree structure)
- `script.js`: Authentication, API calls, document viewer

**Server (Supabase)**:
- Edge Functions: Auth proxy, data fetch
- REST API: Assessment, personnel, equipment, documents
- Auth: Supabase JWT tokens

**Cross-Origin Issue**:
- SharePoint iframe (`https://sharek.aramco.com.sa`) ≠ Supabase (`https://fslleuedqlxpjnerruzt.supabase.co`)
- Browser CORS policy blocks requests
- Solutions:
  1. Use **service_role key** in client (works, but exposes secret)
  2. Create **Edge Function proxy** with CORS headers (secure, but requires proper CORS setup)
  3. Host module **on SharePoint server** (same-origin, no CORS)

#### Current Implementation
**Files Modified** (2026-04-26):
- `aramco/sharepoint/assessment/index.html` (new) — Login form + tree UI
- `aramco/sharepoint/assessment/script.js` (new) — Auth + API logic
- `aramco/sharepoint/RADP/index.html` (modified) — Added Assessment tab

**Authentication Flow**:
1. User enters email + password
2. POST to Supabase `/auth/v1/token` (currently CORS-blocked)
3. Receive JWT token + user profile
4. Store token in sessionStorage (iframe isolation)
5. Use token for all subsequent API calls

**Data Fetch**:
1. User enters assessment ID
2. Fetch assessment + personnel + equipment in parallel
3. For each personnel: fetch documents (certs with expiry dates)
4. For each equipment: fetch documents (certs with expiry dates)
5. Render tree: `Assessment → [Personnel → Certs], [Equipment → Certs]`

**Document Status**:
```javascript
getDocumentStatus(expiryDate) {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysLeft = (expiry - today) / (1000 * 60 * 60 * 24);
  
  if (daysLeft < 0) return 'expired';    // red
  if (daysLeft <= 30) return 'expiring'; // yellow
  return 'valid';                        // green
}
```

**Document Viewer**:
- PDF: iframe
- Images (jpg, png, webp): img tag
- Other: download link

#### UI Structure
**Login Container**:
- Email + password input fields
- Login button
- Error message area

**Content Container** (after login):
- Logout button (top-right)
- Assessment search (input + fetch button)
- Header: Assessment ID, field/well, job type, objective, status badge
- **Personnel Tree**:
  - Expandable item per person (name, position)
  - Children: certificates (name, issued date, expiry date, status badge, view link)
- **Equipment Tree**:
  - Expandable item per equipment (name, serial number)
  - Children: certificates (type, issued date, expiry date, status badge, view link)
- **Document Viewer Modal** (overlays page)
  - Title: document name
  - Body: PDF iframe or image
  - Close button (X) or Escape key

#### RADP Design System
**Fonts**: Barlow (from RADP app)  
**Colors**:
- Background: `--bg-0` through `--bg-3`
- Text: `--text-0` through `--text-4`
- Accent: `--accent`
- Status: `--success` (valid), `--warn` (expiring), `--error` (expired)

### Authentication Challenge (CORS)

**Problem**:
- SharePoint iframe calls Supabase auth endpoint
- Supabase doesn't enable CORS for `/auth/v1/token` from arbitrary origins
- Browser blocks the preflight request

**Error**:
```
Access to fetch at 'https://fslleuedqlxpjnerruzt.supabase.co/auth/v1/token'
from origin 'https://sharek.aramco.com.sa' has been blocked by CORS policy
```

**Test Results** (2026-04-26):
- ✅ Direct Supabase API calls (with anonKey) — attempted, still CORS-blocked
- ✅ Edge Function proxy with CORS headers — attempted, still CORS-blocked
- ✅ Old working test file (`test-lor-1.html`) — used **service_role key**, no auth login

**Root Cause**:
- Supabase auth endpoints are protected; CORS not available for anonKey
- Service role keys work because they have elevated permissions (bypass some restrictions)
- No cross-origin requests fully blocked at infrastructure level

### Solutions & Tradeoffs

| Solution | Pros | Cons | Status |
|----------|------|------|--------|
| **Use service_role key in client** | Works immediately; no proxy needed | Exposes secret key; security risk; hard to rotate | ⚠️ Working, not recommended |
| **Edge Function proxy** | Secure; hides key; can add CORS | Requires proper Supabase config; unverified CORS setup | 🟡 Attempted, not working yet |
| **Host on SharePoint server** | Same-origin; no CORS; simplest | Requires file hosting on Aramco infrastructure | ⏳ Recommended next step |
| **Change auth flow** | Could use SharePoint's SSO context | Requires Aramco IT integration; more complex | ⏳ Future consideration |

### Next Steps

**Option A: Use service_role key (quick test)**
- Update script.js to use service_role key
- Test login + LoR display end-to-end
- ⚠️ Rotate key after testing; consider as temporary only

**Option B: Host on SharePoint (recommended)**
- Store assessment module files on SharePoint server
- Access as same-origin (no CORS needed)
- Simpler deployment; more secure

**Option C: Fix Edge Function CORS**
- Check Supabase documentation on Function CORS
- Verify preflight response headers
- May require Supabase CLI config or plan upgrade

---

## Security Considerations

### Data Access Control
- **RLS Policies**: Assessment data readable only by:
  - Assessor role (view submitted assessments)
  - Contractor who created assessment (own assessments only)
  - Admin (all assessments)
- **Personnel Documents**: Same RLS as assessment (no direct access)
- **Equipment Documents**: Same RLS as assessment

### Authentication
- Assessor authenticates via Supabase (email + password from RADP)
- JWT token valid for 1 hour (standard Supabase)
- Token stored in sessionStorage (iframe-isolated; clears on browser close)
- No credentials persisted to disk

### Credentials Management
- Service account (SharePoint): username + password in environment variables
- Rotated every 90 days (Aramco IT procedure)
- Only accessible to Edge Functions (not exposed to client)

### CORS Exposure
- If service_role key is exposed, attacker can modify any RADP data
- Must use short-lived keys or edge function proxy for production
- Current test: acceptable risk for development only

---

## Database Schema

### Tables (Existing, Used by LoR)
```sql
-- Assessment header
assessments (
  id UUID PRIMARY KEY,
  sharepoint_request_id INT,
  status TEXT ('draft'|'pending'|'approved'|'rejected'),
  field_well TEXT,
  type_of_job TEXT,
  objective TEXT,
  contractor_id UUID
)

-- Personnel roster
assessment_personnel (
  id UUID PRIMARY KEY,
  assessment_id UUID → assessments,
  personnel_id UUID → personnel,
  nawcod_unit TEXT,        -- assessor section
  auditor TEXT,
  readiness TEXT           -- 'Ready'|'Not Ready'|'Conditional'|'Pending'
)

personnel (
  id UUID,
  full_name TEXT,
  position TEXT,
  expiry_date DATE         -- for filtering status
)

personnel_documents (
  id UUID,
  personnel_id UUID → personnel,
  doc_type_name TEXT,
  issue_date DATE,
  expiry_date DATE,
  file_url TEXT            -- PDF/image URL
)

-- Equipment manifest
assessment_equipment (
  id UUID PRIMARY KEY,
  assessment_id UUID → assessments,
  equipment_item_id UUID → equipment_items,
  nawcod_unit TEXT,        -- assessor section
  auditor TEXT,
  readiness TEXT
)

equipment_items (
  id UUID,
  name TEXT,
  serial_number TEXT,
  model TEXT
)

documents (
  id UUID,
  equipment_item_id UUID → equipment_items,
  doc_type_name TEXT,
  issue_date DATE,
  expiry_date DATE,
  file_url TEXT
)

document_types (
  id UUID,
  document_name TEXT
)
```

---

## API Endpoints (Used by LoR)

All endpoints require `Authorization: Bearer {JWT}` header.

```
GET /rest/v1/assessments?id=eq.{assessmentId}&select=*
  → Assessment header data

GET /rest/v1/assessment_personnel?assessment_id=eq.{assessmentId}&select=*,personnel(id,full_name,position,expiry_date)
  → Personnel roster for assessment

GET /rest/v1/personnel_documents?personnel_id=in.({id1},{id2})
  → All documents for personnel

GET /rest/v1/assessment_equipment?assessment_id=eq.{assessmentId}&select=*,equipment_items(id,name,serial_number,model)
  → Equipment manifest for assessment

GET /rest/v1/documents?equipment_item_id=in.({id1},{id2})
  → All documents for equipment
```

---

## File Locations

**SharePoint Deployment**:
```
https://sharek.aramco.com.sa/modern/30037952/Pages/RADP/
├── assessment/
│   ├── index.html        (LoR module)
│   └── script.js         (LoR logic)
└── RADP/
    └── index.html        (Portal with tabs)
```

**Local Development**:
```
C:\Users\dshtu\Radp-space\
├── aramco/sharepoint/
│   ├── assessment/
│   │   ├── index.html
│   │   └── script.js
│   └── RADP/
│       └── index.html
```

---

## Testing Checklist

- [ ] Login with assessor credentials
- [ ] Search for valid assessment ID
- [ ] Tree renders with personnel + equipment
- [ ] Click expand/collapse on tree items
- [ ] Document status badges display correctly (green/yellow/red)
- [ ] Click "View" on document → opens in modal (PDF or image)
- [ ] Click Escape → closes modal
- [ ] Click "Logout" → clears session, shows login form
- [ ] Test with expired cert (should show red)
- [ ] Test with cert expiring in 14 days (should show yellow)
- [ ] Test with cert valid > 30 days (should show green)
- [ ] Print page → LoR displays correctly

---

## Known Issues & Workarounds

| Issue | Status | Workaround |
|-------|--------|-----------|
| CORS blocks auth requests | 🟡 Investigating | Use service_role key (temp) or host on SharePoint |
| sessionStorage may fail in iframe | ✅ Handled | StorageUtil falls back to sessionStorage |
| Document viewer slow on large PDFs | ⚠️ Known | No optimization yet; acceptable for MVP |
| No pagination for large rosters | ⚠️ Known | Acceptable; typical assessment has <50 personnel |

---

## Future Enhancements

1. **Offline support**: Cache assessment data in IndexedDB; view offline
2. **Bulk actions**: Select multiple docs, mark all as "reviewed"
3. **Comments**: Add assessor comments to personnel/equipment rows
4. **Signature**: Capture assessor digital signature on approval
5. **Email summary**: Send LoR as PDF email to contractor after approval
6. **Mobile view**: Optimize tree UI for mobile/tablet

---

## References

- **Architecture**: context/architecture.md
- **Rules**: context/rules.md (coding standards, performance, security)
- **Project**: context/project.md (business metrics, timelines)
- **RADP Portal**: aramco/sharepoint/RADP/index.html (parent portal)

---

**Document Owner**: Tech Lead  
**Version**: 1.0  
**Last Updated**: 2026-04-26  
**Next Review**: After CORS resolution
