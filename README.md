# RADP — Readiness Assessment Digital Platform

Pre-mobilization audit platform for oil & gas well intervention contractors. Tracks equipment certifications, personnel qualifications, and assessment approvals with immutable audit trail.

## What It Does

- **Equipment tracking**: Slickline, coiled tubing, pumping units with certification expiry dates
- **Personnel qualifications**: Operator certs, medicals, safety certifications with automatic expiry alerts
- **Pre-mob audits**: Contractor submits equipment + personnel roster → Aramco assessor approves/rejects
- **Compliance record**: Every action logged with timestamp for regulatory audits
- **Mobile readiness**: Field supervisors check expiry status on tablets/phones (PWA, works offline)

## For Contractors

1. Register crew and equipment
2. Upload certifications (PDF, JPG)
3. Submit pre-mob assessment
4. Track approval status

## For Aramco (Assessor/Operations)

1. Review submitted assessments
2. Check equipment and personnel qualifications
3. Approve or request corrections
4. View audit history

## Quick Start

```
Login → Register (select your role) → Add personnel/equipment → Submit assessment
```

## Tech Stack

- **Frontend**: Vanilla JavaScript (no build), HTML5, CSS3
- **Database**: Supabase PostgreSQL (RLS, Auth, REST API)
- **Deployment**: Vercel (SPA routing, auto-deploy on main)
- **Storage**: Supabase Storage (documents, PDFs)
- **PDF Generation**: Client-side `window.print()` (no server needed)

## Documentation

- [Project Context](context/project.md) — Business objectives, use cases, success metrics
- [Architecture](context/architecture.md) — System design, data models, API endpoints
- [Development Rules](context/rules.md) — Code style, git workflow, testing
- [Roadmap](context/tasks.md) — Current tasks, priorities, blockers

## Local Development

```bash
supabase start          # Start local database (port 54321)
python -m http.server   # Serve app
# Open http://localhost:8000
```

## Deployment

Push to `main` → Vercel auto-deploys in ~1 min → test in production

---

Internal Aramco project. See [context/project.md](context/project.md) for roadmap.
