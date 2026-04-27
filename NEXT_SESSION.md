# Next Session Prompt: RADP LoR Backend Migration

**Status**: Firewall compatibility testing complete. Ready for Phase 1 setup.

## Problem & Decision
- **Blocker**: Aramco firewall blocks Supabase (supabase.co domain)
- **Firewall Test Results** (2026-04-27):
  - ✅ Whitelisted: Azure AD, Azure SQL, Firebase, Heroku
  - ❌ Blocked: AWS, GCP, Vercel, Supabase
- **Decision**: Migrate from Supabase → **Azure SQL + Heroku API**
  - Why: Both whitelisted; Azure SQL is core Microsoft service (low future-block risk)
  - Dual-stack approach: Keep Supabase for existing users; new LoR uses Heroku until full migration

## Current State
- ✅ LoR UI (index.html) — complete, tested locally
- ✅ LoR logic (script.js) — complete, tested locally
- ✅ Firewall compatibility tester (firewall-test.html) — verified working
- ✅ Documentation updated (firewall results + migration plan)
- ❌ Azure SQL Database — not yet created
- ❌ Heroku API — not yet created
- ❌ Database selector in script.js — not yet implemented

## Files Ready
```
C:\Users\dshtu\Radp-space\
├── aramco/sharepoint/assessment/
│   ├── index.html         (LoR UI, ready)
│   └── script.js          (LoR logic, ready for DB selector + API URL updates)
├── firewall-test.html     (firewall test tool, ready)
└── context/
    ├── sharepoint-integration.md  (updated 2026-04-27)
    └── project.md                 (updated 2026-04-27)
```

## Phase 1 Deliverables (Next Session)
### Task 1: Create Azure SQL Database
- [ ] Create Azure account (if needed)
- [ ] Create SQL Server in appropriate region
- [ ] Create database
- [ ] Export PostgreSQL schema from Supabase
- [ ] Import schema to Azure SQL
- [ ] Test connectivity from local machine

### Task 2: Create Heroku API Skeleton
- [ ] Create Heroku account (if needed)
- [ ] Create Node.js Express project
- [ ] Deploy to Heroku (with placeholder endpoint)
- [ ] Verify accessible from Aramco network (using firewall-test.html)

### Task 3: Update script.js for Dual-Stack
- [ ] Add `RADP_CONFIG.backend` selector (default: 'azure', fallback: 'supabase')
- [ ] Add `RADP_CONFIG.apis` object with both endpoints
- [ ] Wrap API calls to use `RADP_CONFIG.apis[RADP_CONFIG.backend]`
- [ ] Test both backends work independently

### Task 4: Verify Phase 1
- [ ] Azure SQL accessible from Aramco network
- [ ] Heroku API accessible from Aramco network
- [ ] script.js switches between backends without errors

## Architecture (Phase 1 Result)
```
SharePoint (iframe)
├── script.js (dual-stack: selects backend)
│
├─→ [Supabase] (existing users, unaffected)
│   └─ Supabase Edge Functions + PostgreSQL
│
└─→ [Heroku API] (new LoR access, Aramco firewall compatible)
    └─ Node.js Express + Azure SQL PostgreSQL
```

## Full Migration Timeline
- Phase 1 (Week 1): Azure + Heroku setup, dual-stack configuration
- Phase 2 (Week 1): Export/import Supabase data → Azure SQL
- Phase 3 (Week 2): Build API endpoints, migrate RLS logic
- Phase 4 (Week 2): Test end-to-end from SharePoint
- Phase 5 (Week 3): Cutover (flip default backend to 'azure', keep Supabase as fallback)

## References
- Firewall test tool: `firewall-test.html`
- Architecture docs: `context/sharepoint-integration.md`
- Project roadmap: `context/project.md`

---
**Last Updated**: 2026-04-27  
**Next Session Focus**: Create Azure SQL + Heroku accounts and complete Phase 1
