# 🚀 Deploy Phase 1 in 3 Steps

## Step 1: Run the setup script (does git commit + push automatically)

```powershell
cd C:\Users\dshtu\Radp-space
.\setup-deploy.ps1
```

This will:
- ✅ Stage all changes
- ✅ Create a commit
- ✅ Push to GitHub main branch

---

## Step 2: Get your secrets (3 quick things)

### 2a. SUPABASE_ACCESS_TOKEN
In PowerShell:
```bash
supabase access-token
```
Copy the output.

### 2b. VERCEL_TOKEN
Go to: https://vercel.com/account/tokens
Click "Create Token" → Copy it

### 2c. VERCEL_ORG_ID and VERCEL_PROJECT_ID
Go to: https://vercel.com/dshturn/radp-space/settings/general
Scroll down → Copy both IDs

---

## Step 3: Add secrets to GitHub (6 clicks)

1. Go to: https://github.com/dshturn/Radp-space/settings/secrets/actions

2. Click **"New repository secret"** for each:

```
SUPABASE_PROJECT_REF = fslleuedqlxpjnerruzt
SUPABASE_ACCESS_TOKEN = <paste from step 2a>
SUPABASE_DB_PASSWORD = <your database password>
VERCEL_TOKEN = <paste from step 2b>
VERCEL_ORG_ID = <paste from step 2c>
VERCEL_PROJECT_ID = <paste from step 2c>
```

---

## Done! 🎉

**What happens next:**
- ✅ GitHub Actions test migrations
- ✅ GitHub Actions apply migrations to Supabase
- ✅ GitHub Actions deploy to Vercel
- ✅ Your app is live with Phase 1

**Check status:** https://github.com/dshturn/Radp-space/actions

---

## Troubleshooting

**Script fails with "supabase: command not found"?**
→ Make sure you completed the Supabase CLI setup earlier

**GitHub Actions fails?**
→ Check if you added all 6 secrets correctly in repo Settings

**Vercel deploy fails?**
→ Make sure VERCEL_TOKEN and IDs are correct

---

**Questions?** Reply and I'll help debug.
