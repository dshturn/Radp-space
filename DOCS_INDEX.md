# RADP Documentation Index

## Quick Navigation

### For New Team Members
1. **[README.md](README.md)** — Start here. What RADP does, quick start, tech stack
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** — System design, data flows, frontend/API/database layers
3. **[DEPLOYMENT.md](DEPLOYMENT.md)** — How to deploy, local development, troubleshooting

### For Developers
1. **[API_REFERENCE.md](API_REFERENCE.md)** — Endpoint formats, query patterns, authentication
2. **[MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)** — What changed in the Heroku→Vercel move (May 2026)
3. **[context.md](context.md)** — Project context, features, constraints

### For DevOps / Deployment
1. **[DEPLOYMENT.md](DEPLOYMENT.md)** — Production checklist, monitoring, scaling
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** — Security model, RLS, performance
3. **[claude.md](claude.md)** — AI workflow instructions (for Claude Code use)

---

## Document Overview

| Document | Purpose | Audience | Updated |
|----------|---------|----------|---------|
| **README.md** | Project overview, quick start | Everyone | May 2026 |
| **ARCHITECTURE.md** | System design, data flows, deployment layers | Developers, DevOps | May 2026 (new) |
| **DEPLOYMENT.md** | Production deployment, local dev, monitoring | DevOps, Release managers | May 2026 (new) |
| **API_REFERENCE.md** | REST API endpoints, query patterns, examples | Backend developers | May 2026 (new) |
| **MIGRATION_SUMMARY.md** | Heroku→Vercel migration details | Everyone | May 2026 (new) |
| **context.md** | Project goals, features, constraints | Product, Engineering leads | May 2026 |
| **PHASE_1_COMPLETE.md** | Phase 1 completion summary | Historical | Apr 2026 |
| **DEPLOY_NOW.md** | Old deployment notes (deprecated) | Historical | Apr 2026 |
| **.impeccable.md** | Design system notes | Designers | Apr 2026 |

---

## Key Information

### Current Stack (May 2026)
```
Frontend:   Vercel (SPA, no build step)
API Proxy:  Vercel Function (api/index.js)
Database:   Supabase (PostgreSQL + Auth)
PDF:        Browser window.print() (client-side)
```

### Cost
- Vercel: $0 (Hobby plan)
- Supabase: $0 (free tier)
- **Total: $0/month** ✅

### Deployment
```bash
git push origin main
# Auto-deploys in ~60 seconds via Vercel webhook
```

### Local Development
```bash
node server-local.js
# http://localhost:3000
```

---

## Recent Changes (May 2026)

✅ **Heroku Eliminated**: Moved API proxy to Vercel Function  
✅ **Client-Side PDF**: Removed server-side puppeteer, use browser print  
✅ **JavaScript Refactored**: ported `generateLoRWithDocs()` to browser  
✅ **Documentation Updated**: Created ARCHITECTURE.md, DEPLOYMENT.md, API_REFERENCE.md, MIGRATION_SUMMARY.md  

See **[MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)** for complete details.

---

## Architecture at a Glance

```
┌─────────────────────┐
│ Browser (SPA)       │
│ index.html          │
│ /js/*.js            │
│ localStorage (auth) │
└──────────┬──────────┘
           │ HTTPS
           ▼
┌─────────────────────────────────┐
│ Vercel (radp.space)             │
│ ├─ Static files (HTML/CSS/JS)  │
│ └─ api/index.js (REST proxy)   │
└──────────┬──────────────────────┘
           │ HTTPS (with JWT)
           ▼
┌──────────────────────────────────┐
│ Supabase                         │
│ ├─ PostgreSQL (data + auth)     │
│ ├─ REST API (/rest/v1/*)        │
│ ├─ Auth (/auth/v1/*)            │
│ └─ Storage (/storage/v1/*)      │
└──────────────────────────────────┘

Security: RLS policies enforce multi-tenancy at DB layer
PDF: window.print() in browser (no server needed)
```

---

## Common Tasks

### Deploy to Production
```bash
git push origin main
# Vercel auto-deploys in ~60 seconds
```

### Add Vercel Environment Variables
1. Vercel dashboard → radp-space project → Settings → Environment Variables
2. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY`
3. (One-time setup, already done as of May 2026)

### Test Locally
```bash
node server-local.js
# http://localhost:3000
```

### Debug API Issues
```bash
# Check Vercel function logs
vercel logs

# Check browser console
# localStorage.getItem('radp_token')  # see auth token
# localStorage.getItem('radp_user')   # see user profile
```

### Monitor Production
- Vercel dashboard → Deployments → Functions logs
- Supabase dashboard → Logs → API, Database, etc

### Rollback If Needed
```bash
git revert <commit-hash>
git push origin main
# Vercel redeploys in ~60 seconds
```

---

## FAQ

**Q: How do I deploy?**
A: `git push origin main`. Vercel auto-deploys.

**Q: Where's the backend server?**
A: There isn't one. Vercel Function (`api/index.js`) proxies to Supabase. Database enforces security via RLS.

**Q: How do PDFs work?**
A: Browser's native print dialog. Users click "Print / Save as PDF" in the LoR window.

**Q: Is the app slower without a server?**
A: No. Vercel Function cold start is <1s. Supabase is fast. LoR might be slightly slower on old devices, but acceptable.

**Q: What if we need server-side logic?**
A: Add Supabase Edge Functions (serverless, same platform).

**Q: How much does it cost?**
A: $0/month on free tiers. Scales affordably as needed.

---

## Key Files

```
Root:
├── index.html          — SPA entry point
├── styles.css          — Styling
├── sw.js              — Service worker (PWA)
├── manifest.json      — PWA manifest
│
├── js/                — Frontend modules
│   ├── shared.js      — Auth, fetch utilities
│   ├── auth.js        — Login/logout
│   ├── assessment.js  — LoR workflows, PDF
│   ├── personnel.js   — Personnel CRUD
│   ├── equipment.js   — Equipment CRUD
│   ├── operations.js  — Operations dashboard
│   ├── admin.js       — Admin workflows
│   └── app.js         — Router, page switcher
│
├── public/            — Static files (served by Vercel)
├── docs/              — Documentation (internal)
├── context/           — Project context (internal)
│
├── api/               — API server (local dev only)
│   ├── index.js       — Vercel Function (deployed)
│   ├── server.js      — Express server (local reference)
│   ├── package.json   — Dependencies
│   └── .env           — Local secrets
│
├── supabase/          — Database (Supabase Cloud)
│   ├── migrations/    — SQL migrations
│   └── config.toml    — Supabase config
│
└── Docs (this directory)
    ├── README.md                 — Project overview
    ├── ARCHITECTURE.md           — System design
    ├── DEPLOYMENT.md             — Deploy guide
    ├── API_REFERENCE.md          — API docs
    ├── MIGRATION_SUMMARY.md       — May 2026 changes
    ├── context.md                — Project context
    ├── DOCS_INDEX.md             — This file
    └── claude.md                 — AI workflow instructions
```

---

## Contact & Support

- **Technical Lead**: (Internal Aramco contact)
- **GitHub**: https://github.com/dshturn/Radp-space
- **Vercel Dashboard**: https://vercel.com/dshturn/radp-space
- **Supabase Console**: https://supabase.com

---

## Version History

| Date | Change | Author |
|------|--------|--------|
| May 2, 2026 | Heroku → Vercel migration | Claude Haiku |
| May 2, 2026 | Documentation overhaul | Claude Haiku |
| Apr 26, 2026 | Phase 1 completion | Aramco team |
| Apr 24, 2026 | Initial deployment | Aramco team |

---

## License

Internal Aramco project. All rights reserved.
