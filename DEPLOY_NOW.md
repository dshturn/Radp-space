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

2. Click **"New repository secret"** for EACH secret below:

**Secret 1:**
- Name: `SUPABASE_PROJECT_REF`
- Value: `fslleuedqlxpjnerruzt`

**Secret 2:**
- Name: `SUPABASE_ACCESS_TOKEN`
- Value: (paste from step 2a)

**Secret 3:**
- Name: `SUPABASE_DB_PASSWORD`
- Value: (your database password)

**Secret 4:**
- Name: `VERCEL_TOKEN`
- Value: (paste from step 2b)

**Secret 5:**
- Name: `VERCEL_ORG_ID`
- Value: (paste from step 2c)

**Secret 6:**
- Name: `VERCEL_PROJECT_ID`
- Value: (paste from step 2c)

**Important:** Name field can ONLY contain: letters, numbers, underscores (_)

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
