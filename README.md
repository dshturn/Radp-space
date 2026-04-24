# RADP — Readiness Assessment Digital Platform

A compliance-focused platform for pre-mobilization audits and equipment readiness assessment in oil & gas operations. Designed for contractor companies and Aramco internal teams to standardize, digitize, and track certification, equipment status, and personnel qualification for well intervention jobs.

## Overview

RADP addresses a critical gap in traditional paper-based audit workflows:

- **Compliance**: Immutable audit logs of all actions (uploads, approvals, deletions)
- **Readiness visibility**: Real-time equipment and personnel status against certification expiry dates
- **Mobile-first**: Field supervisors assess readiness from site on tablets and phones
- **Offline capable**: PWA architecture supports low-connectivity environments

## For Users

### Contractor Companies
- Register team members and equipment
- Upload and manage certifications (with expiry tracking)
- Submit pre-mobilization assessments
- Track assessment approval status
- Export data for regulatory filing

### Aramco (Operations & Assessment)
- Approve/reject contractor assessments
- Monitor compliance across all contractors
- Review equipment and personnel qualifications
- Track audit history for regulatory audits

## Quick Start

1. Visit the app at the deployment URL
2. **New user?** Click "Register" and select your role (Contractor / Operations / Assessor)
3. **Contractor**: Add personnel → add equipment → create assessment
4. **Assessor/Operations**: Review submitted assessments and approve/reject

See [/context/tasks.md](/context/tasks.md) for current development priorities.

## Architecture

Single-page application (SPA) with:
- **Frontend**: Vanilla JavaScript, no build step (rapid iteration)
- **Backend**: Supabase (PostgreSQL, Auth, REST API)
- **Storage**: Supabase Storage for documents and certifications
- **Deployment**: Vercel (automatic rewrites for SPA routing)

Full architecture details in [/context/architecture.md](/context/architecture.md).

## Core Features

### Equipment Management
- Hierarchical equipment items (parent/child components)
- Service-line-specific equipment templates
- Batch export and dismissal
- Sub-component tracking (e.g., slickline → head, cable, stripper)

### Personnel & Certifications
- Personnel registration with company and service line
- Document uploads (PDFs, images) with expiry tracking
- Auto-calculated expiry status (overdue, within 30 days, valid)
- Bulk selection and CSV export

### Pre-Mobilization Assessments
- Service-line-specific assessment checklists
- Field/well context
- Equipment and personnel verification
- Contractor → Assessor workflow (draft → submitted → approved/rejected)

### Operations Management
- Site creation and site-based resource assignment
- Personnel roster per site with expiry visibility
- Equipment manifest per site
- Status rollup by expiry criticality

### Compliance & Audit
- Immutable audit log (who did what, when)
- Row-level security (contractors see own data, admins see all)
- Notification system for status changes
- Admin dashboard for system oversight

## Development

See [/context/rules.md](/context/rules.md) for coding standards and conventions.

**Tech**:
- Node.js (for Supabase migrations and future tooling)
- Supabase CLI for local development
- No frontend build step (vanilla JS)

**Running locally**:
```bash
supabase start
# Server runs at http://localhost:54321
# Open index.html in a browser or use a local HTTP server
```

## Roadmap

High-priority items:
- Token optimization in AI-driven workflows
- Architecture review for scalability
- Mobile UX refinement for field conditions

See [/context/tasks.md](/context/tasks.md) for full roadmap.

## License

Internal Aramco project. Do not distribute outside organization.

---

**Questions?** Check [/context/project.md](/context/project.md) for business context or [/context/architecture.md](/context/architecture.md) for technical details.
