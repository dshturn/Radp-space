# Next Session Prompt: Phase 2 Implementation Planning

**Status**: Phase 1 MVP ✅ (2026-04-28) | Comprehensive audit complete (2026-05-01)

**IMPORTANT**: Two Phase 2 paths exist. **Recommend Priority 1 first**, then evaluate Priority 2.

## Priority 1: Audit-Focused Phase 2 (Weeks 1–2)
**Status**: Design specs ready, implementation roadmap finalized  
**Timeline**: 2026-05-01 to 2026-05-22 (3 weeks: fix + build)  
**Effort**: 17 days total (7 days P0/P1 fixes + 10 days Phase 2)

**What's Included**:
1. **P0/P1 Fixes** (Week 1):
   - ARIA labels (A11y, blocking Phase 2)
   - Form loading states (UX, blocking Phase 2)
   - PDF size validation, cache docs, responsive tables, color tokens
   - Split assessment.js into 5 modules

2. **Phase 2 Features** (Week 2):
   - Audit Export (PDF/CSV with filtering)
   - Audit Log Search (real-time)
   - Email Alerts (admin actions)

**Rationale**:
- Unblocks Phase 2 work (A11y + form states required)
- Delivers operational value immediately (audit export, search, email alerts)
- Improves code quality (assessment.js split makes future work faster)
- Addresses all P0/P1 issues identified in audit

**Reference**: `docs/superpowers/specs/2026-05-01-phase2-audit-features-design.md` (detailed design)
**Reference**: `docs/superpowers/plans/2026-05-01-p0p1-fixes-implementation.md` (implementation roadmap)

---

## Priority 2: Email-Based Assessment Workflow (Alternative Phase 2)
**Status**: Architecture finalized (2026-04-28). Ready to implement three new modules.
**Timeline**: 2026-05-22+ (after Priority 1, or in parallel if resources available)

## Problem & Solution

**Firewall Constraints Discovered (2026-04-28):**
- ❌ Web interfaces blocked: Storage websites, App Services, Azure Functions
- ❌ Database connections blocked: SQL port 1433 blocked from Aramco
- ✅ Email always works
- ✅ Existing tools work: Supabase.com (UI), Azure Portal, Power BI
- ✅ File transfer works: EFT (external file transfer service)

**Solution: Email-Based Assessment Workflow**
- No web proxies needed
- No database connection issues
- No IT involvement required
- Uses email + PDF + existing tools

## Workflow

```
1. ARAMCO SHAREPOINT (generates request)
   └→ Email: Assessment Request
      (Assessment ID, Contractor ID, details)

2. EXTERNAL RADP (receives via Email Analyzer)
   └→ Creates Assessment Container in Supabase
   └→ Awaits contractor input

3. CONTRACTOR (Supabase web interface)
   └→ Adds Equipment + Manpower
   └→ Uploads Certificates
   └→ Clicks "Generate PDF"

4. PDF GENERATOR (creates hierarchical PDF)
   └→ Table of Contents (Equipment → Manpower → Certs)
   └→ Each TOC item is a clickable link
   └→ Links point to certificate pages
   └→ Professional formatting

5. CONTRACTOR (submits)
   └→ Downloads PDF from system
   └→ Uploads PDF to EFT

6. ASSESSOR (Aramco, reviews offline)
   └→ Downloads PDF from EFT
   └→ Reviews hierarchical structure + certificates
   └→ Makes decision

7. ASSESSOR (generates decision via SharePoint)
   └→ SharePoint Email Generator
   └→ Email: Assessment Decision
      (Assessment ID, Decision, Comments)

8. EXTERNAL RADP (receives via Email Analyzer)
   └→ Updates Assessment Status in Supabase
   └→ Contractor sees updated status

9. CONTRACTOR (Supabase)
   └→ Views assessment approval/rejection
   └→ Workflow complete
```

## Three Modules to Build

### Module 1: Email Analyzer (Node.js, External RADP)
**Purpose**: Receive and parse emails from Aramco SharePoint

**Functionality**:
- Listens for incoming emails (request + decision)
- Parses structured email body
- Creates assessment containers (request emails)
- Updates assessment status (decision emails)
- Updates Supabase records

**Inputs**:
- Assessment request email (from SharePoint)
- Assessment decision email (from SharePoint)

**Outputs**:
- Assessment records in Supabase
- Status updates in Supabase

**Tech Stack**: Node.js + email service (SMTP/Webhook/IMAP)

---

### Module 2: PDF Generator (JavaScript, Contractor Interface - Supabase)
**Purpose**: Generate hierarchical PDF with internal links

**Functionality**:
- Reads assessment data from Supabase (equipment, manpower, certificates)
- Generates PDF with:
  - Cover page (assessment details)
  - Table of Contents (hierarchical: Equipment Type → Item → Certificate)
  - Each TOC entry is a clickable link (internal PDF links)
  - Detailed pages for each section (equipment specs, personnel info, cert images)
- Returns PDF for contractor download
- PDF ready for EFT upload

**Inputs**:
- Assessment ID from Supabase
- Equipment list, manpower list, certificates

**Outputs**:
- PDF file (for download/EFT upload)

**Tech Stack**: JavaScript (PDF library: PDFKit, jsPDF, or similar) + Supabase API

---

### Module 3: SharePoint Email Generator Code (SharePoint System)
**Purpose**: Generate structured emails for assessment workflow

**Functionality**:
- Triggered when assessor makes decision in SharePoint
- Generates two email types:
  - **Request Email**: Assessment ID, contractor info, assessment details
  - **Decision Email**: Assessment ID, decision (Approved/Rejected/Conditional), comments/notes
- Email format must be parseable by Email Analyzer
- Sends to RADP email address

**Tech Stack**: SharePoint customization (Power Automate, custom web part, or REST call)

---

## Critical Questions (Answer Before Implementation)

1. **Email Service Infrastructure:**
   - How will RADP receive emails? (Dedicated email account? Webhook service? IMAP polling?)
   - Email address for receiving assessments?
   - Can we set up mail forwarding or use a service like Zapier/IFTT?

2. **PDF Hierarchy Structure:**
   - Proposed: Equipment Type → Equipment Item → Component → Certificate?
   - Or: Equipment Items (with nested certificates)?
   - Should there be a summary/cover page with assessment overview?
   - What info on each certificate page? (certificate type, expiry, issuer, etc.)

3. **SharePoint Email Template:**
   - What format for request email? (structured fields or free-form?)
   - Can we control/standardize email subject line?
   - Example: "RADP Assessment Request - ID:123 - Contractor:ABC"?

4. **Assessment Status Values:**
   - Status hierarchy: Pending → Submitted → Under Review → Approved/Rejected/Conditional?
   - Should contractor get notified on each status change?
   - Approval fields: approved_by, approved_at, approved_notes?

5. **PDF Link Strategy:**
   - Internal PDF page links only, or also external links to EFT documents?
   - Should PDF be self-contained (all certs embedded) or reference external files?
   - File size considerations?

6. **Email Parsing Edge Cases:**
   - What if email client wraps/reformats the body?
   - Should we require a specific email template format (HTML vs plain text)?
   - How do we handle reply-to vs new email?

## Implementation Order (Next Session)

1. **Clarify Critical Questions** (above) - 15 min
2. **Design Email Parser** - define email format/structure - 30 min
3. **Build Email Analyzer** - SMTP listener + Supabase integration - 2 hours
4. **Build PDF Generator** - hierarchical PDF with TOC links - 3 hours
5. **Build SharePoint Email Code** - request + decision email templates - 1 hour
6. **Test End-to-End** - send test emails, generate PDFs, verify status updates - 1 hour
7. **UAT with Assessor** - test from Aramco network with real assessments - TBD

## Files to Create/Modify

```
C:\Users\dshtu\Radp-space\
├── api/
│   ├── email-analyzer.js       (NEW - receives and parses emails)
│   └── [connection logic]       (modify to connect to Supabase instead of Azure SQL)
│
├── js/
│   └── pdf-generator.js         (NEW - generates hierarchical PDF)
│
├── aramco/sharepoint/
│   └── [email-generator code]   (NEW - SharePoint customization for emails)
│
└── context/
    ├── project.md              (UPDATED - Phase 2 workflow)
    └── tasks.md                (UPDATED - module breakdown)
```

## Architecture Decision Log
- **2026-04-28**: Email-based workflow ✅ → Approved (firewall-friendly)
- **2026-05-03**: Heroku & outdated proposals → Removed (using Express API proxy with Supabase)

## References
- Phase 2 Assessment Workflow: context/project.md
- Task Breakdown: context/tasks.md
- Firewall Test Results: conversation (2026-04-28)

---
**Last Updated**: 2026-04-28
**Next Session Focus**: Answer critical questions, build Email Analyzer + PDF Generator
