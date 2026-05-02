# Deployment Guide

## Current Status (May 2026)

✅ **Heroku eliminated** — Zero backend servers
✅ **Vercel only** — Frontend + API proxy
✅ **Supabase** — Database + Auth
✅ **Client-side PDF** — Via `window.print()`

---

## Production Deployment

### Prerequisites

- GitHub repository (already set up)
- Vercel account (already set up: `radp-space` project)
- Supabase project (already set up: `fslleuedqlxpjnerruzt`)

### Step 1: Set Vercel Environment Variables

1. Open Vercel dashboard → `radp-space` project
2. Go to **Settings** → **Environment Variables**
3. Add for **Production** and **Preview**:

| Name | Value | Source |
|------|-------|--------|
| `SUPABASE_URL` | `https://fslleuedqlxpjnerruzt.supabase.co` | From Supabase project settings |
| `SUPABASE_ANON_KEY` | `eyJhbGciOi...` | From Supabase API keys (anon/public) |

4. Click "Save"

### Step 2: Deploy to Vercel

```bash
git push origin main
```

Vercel automatically:
1. Detects push to main
2. Runs build: `buildCommand: null` (no build step)
3. Copies files from root to Edge network
4. Deploys `api/index.js` as serverless function
5. Available at https://radp.space in ~60 seconds

### Step 3: Verify Deployment

1. Open https://radp.space in browser
2. Test proxy: `https://radp.space/api?endpoint=/rest/v1/assessments?limit=1`
   - Should return JSON (or 401 if RLS denies)
3. Test auth: Login at https://radp.space/login
4. Test data: Assessment list should load
5. Test LoR: Open assessment → "View LoR" → new window with print button

### Step 4: Rollback (if needed)

If something breaks:

```bash
# Revert last commit
git revert HEAD
git push origin main

# Vercel auto-deploys the previous version in ~60 seconds
```

---

## Local Development

### Quick Start

```bash
# Terminal 1: Frontend server
node server-local.js
# Open http://localhost:3000

# Terminal 2: API server (development reference only)
cd api && npm start
# API available at http://localhost:5000
```

### Configuration

- **Frontend**: Uses Supabase from `.env.local`
- **API**: Uses Supabase from `api/.env`
- **Database**: Uses Supabase cloud (no local DB needed for frontend)

### Without Local API Server

The frontend works without the local API server:

```bash
# Just the frontend
node server-local.js

# In browser, open http://localhost:3000
# All API calls automatically route to production Supabase
# (because localStorage has a real auth token)
```

The local API server (port 5000) is only for reference — it's not needed for local frontend development.

---

## Monitoring & Debugging

### Vercel Logs

```bash
# Tail function logs
vercel logs

# View deployment history
vercel ls

# Check environment variables
vercel env ls
```

### Browser Console

- Login, inspect Network tab to see Supabase REST calls
- Check localStorage for token: `localStorage.getItem('radp_token')`
- Check user profile: `localStorage.getItem('radp_user')`

### Supabase Logs

In Supabase dashboard → Logs → Functions/REST API:
- See all API requests
- Check RLS filter results
- Debug authentication issues

---

## Scaling & Performance

### Current Limits

- **Supabase free tier**: 500k rows, unlimited API calls
- **Vercel free tier**: 10k API calls/month, 100 edge function deployments/month
- **Typical usage**: ~100 users, 10k assessments, 50k API calls/month = well within limits

### If Scaling Needed

1. **Upgrade Supabase** → Paid plan ($25/mo+)
2. **Upgrade Vercel** → Pro plan ($20/mo) for reserved memory
3. **Add Vercel KV** → If caching needed ($0.50/mo)

### Optimization

- ✅ Already using RLS (database-level filtering)
- ✅ Using static assets (Vercel Edge caching)
- ✅ Minimal JavaScript (vanilla, no framework overhead)
- ⚠️ Could add: client-side caching (localStorage), pagination, lazy loading

---

## Disaster Recovery

### If Database Is Deleted

1. Restore from Supabase backup (Settings → Backups, available for 7 days)
2. Or from local export: `supabase db dump -f dump.sql`
3. Re-run migrations: `supabase db push`

### If Code Is Deleted

1. GitHub has full history
2. Revert to any previous commit: `git revert <commit-hash>`
3. Vercel redeploys automatically

### If Vercel Account Is Compromised

1. Rotate env vars immediately (update in Vercel dashboard)
2. Check Vercel audit logs for unauthorized deployments
3. Force re-auth in browser: `localStorage.clear()`

---

## Troubleshooting

### Deployment Fails

```bash
# Check vercel.json syntax
npm install -g vercel
vercel --prod --debug

# Or in Vercel UI, check build logs
```

### API Returns 401

- Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in Vercel
- Check RLS policy allows the operation
- Verify JWT is valid: `localStorage.getItem('radp_token')`

### LoR PDF Not Opening

- Check browser console for errors
- Verify Supabase queries returned data
- Check localStorage has user profile: `localStorage.getItem('radp_user')`

### Slow Performance

- Check Vercel function duration (logs)
- Check Supabase query performance (dashboard)
- Check browser network tab for slow requests

---

## Heroku Decommissioning (Done ✅)

The Heroku backend was eliminated in May 2026:

- ❌ Removed `api/server.js` (Express)
- ❌ Removed `api/package.json` with puppeteer
- ❌ Removed Heroku dynos
- ✅ Moved to Vercel + Supabase only

**Cost savings**: $7-50/month (Heroku) → $0/month

---

## Release Checklist

Before major releases:

- [ ] Run tests (if any)
- [ ] Test LoR generation in staging (preview URL)
- [ ] Test auth flow
- [ ] Check Vercel function logs for errors
- [ ] Monitor Supabase for unusual activity
- [ ] Update CHANGELOG.md
- [ ] Git tag version: `git tag v1.x.y && git push --tags`

---

## Contact & Support

- **Vercel support**: https://vercel.com/support
- **Supabase support**: https://supabase.com/support
- **Project lead**: (Internal Aramco contact)
