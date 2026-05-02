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

## Current Architecture
- Row-level security (RLS) enforces multi-tenant isolation
- Event-driven notifications via Postgres triggers
- Role-based access control (contractor, operations, assessor, admin)
- Immutable audit trail with timestamps
- PWA for offline field operations

## Documentation Index
- [Notifications & Deletion Workflow](context/FEATURE-NOTIFICATIONS-2026-05-01.md) — Event pipeline, contractor/admin flows
- [Phase 1 Completion](context/COMPLETED-2026-04-26.md) — Audit logging, admin access, equipment/personnel management
- [Roadmap & Next Steps](context/WAY-FORWARD-2026-04-26.md) — Phase 2+ planning

## Constraints
- Minimize complexity (vanilla JS, no framework)
- Support offline field operations (PWA)
- Immutable audit trail for compliance
- RLS-based multi-tenancy (no app-level filtering)