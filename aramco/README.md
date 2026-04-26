# Aramco Network Integration

Central location for all Aramco SharePoint, API specs, and integration architecture.

## Folder Structure

### 📁 `/sharepoint`
**SharePoint documents & file samples**
- Screenshots of SharePoint structure
- Sample contractor files (PDFs, Excel, Word docs)
- List of document types + metadata
- File naming conventions
- Folder hierarchy examples

**Purpose**: Understand what files exist in SharePoint and how they're organized.

---

### 📁 `/api-specs`
**Aramco API documentation**
- SharePoint REST API specs
- Authentication details (OAuth, Azure AD, service accounts)
- Endpoint examples
- Rate limits, quotas
- Error codes + handling
- Sample requests/responses

**Purpose**: Define how to programmatically access SharePoint files.

---

### 📁 `/architecture`
**Integration design documents**
- Current RADP architecture (how it works today)
- Proposed integration flow (how to add Aramco connectivity)
- Sync strategy (real-time vs scheduled, conflicts)
- Data mapping (Aramco → RADP tables)
- Security considerations (auth, encryption, audit)

**Purpose**: Plan the technical implementation.

---

### 📁 `/notes`
**Analysis & decision logs**
- Integration requirements summary
- Questions to clarify with Aramco
- Pros/cons of different approaches
- Implementation decisions
- Blockers & solutions

**Purpose**: Track thinking & decisions as we analyze.

---

## How to Provide Files

### Option 1: Copy-Paste Content
If files are PDFs or images with important info:
1. Take screenshot of each page
2. Save as `sharepoint-structure-1.png`, `sharepoint-structure-2.png`, etc.
3. Put in `/sharepoint` folder

### Option 2: Upload Original Files
If you can copy the actual files from your SharePoint/network:
1. Save them in the appropriate folder
2. Name them clearly: `contractor-invoice-template.docx`, `file-naming-convention.txt`, etc.

### Option 3: Type Out Key Info
If files are Word docs or Excel spreadsheets with structured data:
1. Summarize the content in a markdown file
2. Example: `sharepoint-document-types.md` with a table of file types, purposes, locations

---

## What We Need to Understand

### From SharePoint Structure:
- [ ] What document types exist? (invoices, contracts, assessments, etc.)
- [ ] How are they organized? (by contractor, by year, by well, etc.)
- [ ] What metadata is associated? (contract date, approval status, version, etc.)
- [ ] Who has access to what? (all contractors see all files, or filtered?)
- [ ] File naming conventions (is there a pattern?)
- [ ] Update frequency (static or real-time sync needed?)

### From API/Auth:
- [ ] How does Aramco authenticate? (OAuth 2.0, API keys, certificates?)
- [ ] Do we need a service account or user-based auth?
- [ ] Rate limits? (100 req/min, 1000 req/day, etc.)
- [ ] Webhook support? (real-time file notifications?)

### From Integration Plan:
- [ ] Which files should sync to RADP? (all, or just certain types?)
- [ ] What's the sync frequency? (daily, weekly, manual?)
- [ ] Conflict resolution? (if file changes in both places, who wins?)
- [ ] What user sees what? (contractor sees own files, admin sees all?)

---

## Next Steps

1. **Provide files** → Put documents in folders above
2. **I analyze** → Study structure, APIs, requirements
3. **Clarify questions** → Ask for missing info
4. **Design integration** → Create architecture document
5. **Build** → Implement sync logic

---

Ready! Just copy/paste your files into the folders above when ready.
