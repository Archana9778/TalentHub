Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "      Starting TalentHub Full-Stack Platform" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[1/2] Launching Backend REST API on http://localhost:5000 ..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList "/k cd /d `"$scriptDir\backend`" && npm run dev"

Write-Host "[2/2] Launching Frontend React App on http://localhost:5173 ..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList "/k cd /d `"$scriptDir\frontend`" && npm run dev"

Write-Host ""
Write-Host "TalentHub launched successfully!" -ForegroundColor Yellow
Write-Host "Frontend UI:  http://localhost:5173" -ForegroundColor White
Write-Host "Backend API:  http://localhost:5000" -ForegroundColor White
Write-Host "Health Probe: http://localhost:5000/health" -ForegroundColor White
Write-Host ""
Write-Host "Demo Logins (Click demo switcher pill in navbar or login directly):" -ForegroundColor White
Write-Host "- Candidate: candidate@talenthub.com / password123" -ForegroundColor Gray
Write-Host "- Recruiter: recruiter@techcorp.com  / password123" -ForegroundColor Gray
Write-Host "- Admin:     admin@talenthub.com      / password123" -ForegroundColor Gray

