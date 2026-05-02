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

**Frontend** (port 3000):
```bash
node server-local.js    # Serves /public + /js, proxies API to localhost:5000
```

**API** (port 5000, development only):
```bash
cd api && npm start      # Local Supabase proxy (not needed in production)
```

## Architecture

```
Browser → Vercel (radp.space)
  ├── Static files (HTML/CSS/JS)
  └── /api/index.js (Supabase proxy)

Browser → Supabase
  ├── REST API (/rest/v1/*) — all data operations
  ├── Auth (/auth/v1/*) — login/logout/registration
  └── Storage (/storage/*) — documents, PDFs

PDF → window.print() in browser → "Save as PDF"
```

## Deployment

1. Push to `main` → Vercel auto-deploys in ~1 min
2. Set Vercel env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
3. Test at https://radp.space
4. No backend server needed (Vercel + Supabase only)

---

Internal Aramco project. See [context/project.md](context/project.md) for roadmap.
