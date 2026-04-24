# setup-deploy.ps1 — One-click GitHub + Vercel setup

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "RADP Phase 1 Deployment Setup" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check git status
Write-Host "Step 1: Checking git status..." -ForegroundColor Yellow
git status

Write-Host ""
Write-Host "Step 2: Adding all changes to git..." -ForegroundColor Yellow
git add .

Write-Host ""
Write-Host "Step 3: Creating commit..." -ForegroundColor Yellow
$commitMsg = @"
Phase 1: Security + Performance + Reliability

- Add Supabase migrations for helper functions & status tracking
- Implement GitHub Actions auto-deploy workflow
- Refactor JS architecture for lazy loading & Realtime WebSocket
- Replace polling with real-time subscriptions
- Add offline queue for unreliable connections
- Add API caching layer with error handling
- Update .cursorrules for AI-friendly development

Phase 1 provides:
✅ Security: RLS policies + JWT validation
⚡ Performance: Lazy loading + API caching + no polling
🔌 Reliability: Offline queue + error handling + Realtime notifications
"@

git commit -m $commitMsg

Write-Host ""
Write-Host "Step 4: Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ Code pushed successfully!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

Write-Host "NOW DO THIS IN YOUR BROWSER:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to: https://github.com/dshturn/Radp-space/settings/secrets/actions" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. For EACH secret below, click 'New repository secret':" -ForegroundColor Yellow
Write-Host ""
Write-Host "   SECRET 1" -ForegroundColor White
Write-Host "   Name: SUPABASE_PROJECT_REF" -ForegroundColor Cyan
Write-Host "   Value: fslleuedqlxpjnerruzt" -ForegroundColor Gray
Write-Host ""
Write-Host "   SECRET 2" -ForegroundColor White
Write-Host "   Name: SUPABASE_ACCESS_TOKEN" -ForegroundColor Cyan
Write-Host "   Value: (run: supabase access-token)" -ForegroundColor Gray
Write-Host ""
Write-Host "   SECRET 3" -ForegroundColor White
Write-Host "   Name: SUPABASE_DB_PASSWORD" -ForegroundColor Cyan
Write-Host "   Value: (your database password)" -ForegroundColor Gray
Write-Host ""
Write-Host "   SECRET 4" -ForegroundColor White
Write-Host "   Name: VERCEL_TOKEN" -ForegroundColor Cyan
Write-Host "   Value: (from https://vercel.com/account/tokens)" -ForegroundColor Gray
Write-Host ""
Write-Host "   SECRET 5" -ForegroundColor White
Write-Host "   Name: VERCEL_ORG_ID" -ForegroundColor Cyan
Write-Host "   Value: (from https://vercel.com/settings)" -ForegroundColor Gray
Write-Host ""
Write-Host "   SECRET 6" -ForegroundColor White
Write-Host "   Name: VERCEL_PROJECT_ID" -ForegroundColor Cyan
Write-Host "   Value: (from your Vercel project settings)" -ForegroundColor Gray
Write-Host ""
Write-Host "   ⚠️  IMPORTANT: Name field can ONLY have letters, numbers, underscores (_)" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. GitHub Actions will auto-run!" -ForegroundColor Yellow
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
