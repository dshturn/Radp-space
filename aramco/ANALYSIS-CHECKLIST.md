# Aramco Integration - Analysis Checklist

Use this to track what we've gathered and what's still needed for the integration.

---

## SharePoint Structure Analysis

### Document Organization
- [ ] SharePoint folder hierarchy documented
- [ ] Sample file names provided
- [ ] Naming conventions identified
- [ ] File types categorized (by purpose: contracts, invoices, assessments, etc.)
- [ ] Access control model understood (who sees what)
- [ ] File count estimates (how many files exist?)

### Document Types
- [ ] List of all document types
- [ ] Purpose of each type
- [ ] Update frequency (static or changes)
- [ ] Metadata fields (dates, approvers, versions, etc.)
- [ ] Who owns/maintains each type
- [ ] Retention policy (keep forever, archive after X years?)

### Metadata & Classification
- [ ] Contractor information stored where? (which folder, which field?)
- [ ] Assessment/job information stored where?
- [ ] Approval status indicated how? (filename, folder, field?)
- [ ] Version control (versioned files or overwrites?)
- [ ] Change history available? (audit trail in SharePoint?)

---

## API & Authentication

### Connection Method
- [ ] Aramco provides REST API? (SharePoint Online REST API)
- [ ] Authentication method: OAuth 2.0, API keys, certificates, or other?
- [ ] Service account available? (for automated sync)
- [ ] User-based auth? (each contractor signs in with their Aramco account?)
- [ ] Multi-factor authentication required?
- [ ] IP whitelisting required?

### API Details
- [ ] Base URL for API
- [ ] Endpoint documentation (list files, get file, upload, delete)
- [ ] Rate limits? (requests per minute/day)
- [ ] Pagination? (if results are large)
- [ ] Webhook support? (for real-time notifications on file changes)
- [ ] Error codes documented?
- [ ] Sample requests/responses provided?

### Security
- [ ] SSL/TLS required? (should be HTTPS)
- [ ] Encryption in transit & at rest?
- [ ] Data classification (confidential, internal, public?)
- [ ] Audit logging in SharePoint (who accessed what, when)?
- [ ] Data residency requirements (where data stored)?

---

## Integration Requirements

### Scope
- [ ] Which files should sync to RADP?
  - [ ] All contractor files?
  - [ ] Only assessment-related files?
  - [ ] Only contract/agreement files?
  - [ ] Other specific types?
- [ ] Which contractor data to pull? (company info, contacts, history?)
- [ ] Which users need access? (contractors, assessors, admins?)

### Sync Strategy
- [ ] Sync frequency: real-time, hourly, daily, weekly, or manual?
- [ ] One-way (Aramco → RADP) or two-way?
- [ ] What happens if file changes in both places? (conflict resolution)
- [ ] Initial bulk load needed? (migrate existing files)
- [ ] Incremental sync? (only new/changed files)

### Data Mapping
- [ ] Aramco contractor ID → RADP contractor_id
- [ ] Aramco assessment folder → RADP assessment table
- [ ] Aramco file → RADP documents table
- [ ] File metadata (upload date, approver, etc.) → RADP fields?
- [ ] How to handle Aramco-specific fields not in RADP?

### User Experience
- [ ] Where in RADP UI to show Aramco files? (new "SharePoint Files" tab?)
- [ ] Can contractors upload to Aramco directly? (or only through RADP?)
- [ ] Can contractors see their own files only? (RLS filtering)
- [ ] Admin visibility to all files? (RLS for admin)
- [ ] Search across RADP + Aramco files?

### Compliance & Audit
- [ ] All file access logged to RADP audit_log?
- [ ] Who can download/view files? (access control)
- [ ] Watermarking or tracking on downloads? (for sensitive docs)
- [ ] Retention policy (delete old files after X years)?
- [ ] Compliance requirements (GDPR, data residency, encryption)?

---

## Technical Architecture

### Connection Layer
- [ ] Service account for SharePoint API access?
- [ ] Token management (refresh tokens, expiry)?
- [ ] Error handling (retries, timeouts, circuit breaker)?
- [ ] Rate limiting (queue if hitting limits)?

### Sync Engine
- [ ] Real-time sync via webhook, or scheduled job (cron)?
- [ ] Database to track sync state (which files already synced)?
- [ ] Conflict detection (if file changed in both places)?
- [ ] Transaction safety (partial sync failures)?

### Storage
- [ ] Store files in Supabase Storage, or link to Aramco?
- [ ] If storing: encryption at rest required?
- [ ] If linking: how to show preview in RADP?
- [ ] Backup strategy?

### Monitoring & Alerts
- [ ] Log sync status (success, failures, number of files)?
- [ ] Alert on sync failures (email to admin)?
- [ ] Metrics dashboard (files synced, last sync time, error rate)?

---

## Outstanding Questions

Use this section to track questions we need answered:

- [ ] Question 1: ?
- [ ] Question 2: ?
- [ ] Question 3: ?

---

## Files Provided

### SharePoint Structure
- [ ] Folder hierarchy
- [ ] Sample files
- [ ] File naming conventions
- [ ] Document type list

### API Documentation
- [ ] Authentication spec
- [ ] Endpoint documentation
- [ ] Sample requests
- [ ] Error codes

### Other
- [ ] Network diagram
- [ ] Access control matrix
- [ ] Compliance requirements
- [ ] Existing integration examples

---

## Sign-Off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Aramco IT | | | |
| Aramco Assessor | | | |
| RADP Tech Lead | | | |

---

**Document maintained by**: Architecture Team  
**Last updated**: TBD  
**Next review**: After files provided
