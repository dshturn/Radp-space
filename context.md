# RADP Project Context

## Goal
Digital platform for pre-mobilization audits of well intervention equipment

## Core Features (Phase 1 ✅)
- Equipment readiness checklists with expiry tracking
- Contractor evaluation & assessment approval workflow
- Risk identification & audit logging
- Admin contractor visibility & record management
- Event-driven notifications system
- Assessment deletion request workflow with admin approval

## Stack (as of May 2026)
- **Frontend**: Vanilla JavaScript (no build), HTML5, CSS3 — deployed on Vercel
- **Database**: Supabase PostgreSQL with RLS policies, Auth, REST API
- **PDF Generation**: Client-side `window.print()` (browser native, no server)
- **Deployment**: Vercel (SPA routing, auto-deploy on main push)
- **Storage**: Supabase Storage for documents, certificates, PDFs
- **API Proxy**: Vercel Function (`api/index.js`) forwards authenticated requests to Supabase REST

## Current Architecture (Production)

**Deployment**:
```
Browser → Vercel Edge → Static HTML/CSS/JS (cached globally)
Browser → Vercel Function (api/index.js) → Supabase REST API
Browser → Supabase REST → PostgreSQL (auth + data)
Browser → window.print() → PDF (native browser feature)
```

**Security & Multi-Tenancy**:
- Row-level security (RLS) enforces contractor isolation
- Supabase JWT tokens passed to RLS policies via `auth.uid()`
- Service role key only used in Edge Functions (for admin operations)
- All data queries filtered client-side via RLS — no app-level filtering needed

**Features**:
- Event-driven notifications via Postgres triggers
- Role-based access control (contractor, operations, assessor, admin)
- Immutable audit trail with timestamps
- PWA for offline field operations
- No backend server — Vercel + Supabase only

## Documentation Index
- [Notifications & Deletion Workflow](context/FEATURE-NOTIFICATIONS-2026-05-01.md) — Event pipeline, contractor/admin flows
- [Phase 1 Completion](context/COMPLETED-2026-04-26.md) — Audit logging, admin access, equipment/personnel management
- [Roadmap & Next Steps](context/WAY-FORWARD-2026-04-26.md) — Phase 2+ planning

## Constraints
- Minimize complexity (vanilla JS, no framework)
- Support offline field operations (PWA)
- Immutable audit trail for compliance
- RLS-based multi-tenancy (no app-level filtering)