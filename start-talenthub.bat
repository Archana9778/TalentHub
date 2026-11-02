@echo off
echo ========================================================
echo       Starting TalentHub Full-Stack Platform
echo ========================================================
echo [1/2] Launching Backend REST API on http://localhost:5000 ...
start "TalentHub Backend (Port 5000)" cmd /k "cd /d %~dp0backend && npm run dev"

echo [2/2] Launching Frontend React App on http://localhost:5173 ...
start "TalentHub Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo TalentHub is now launching!
echo Frontend UI:  http://localhost:5173
echo Backend API:  http://localhost:5000
echo Health Probe: http://localhost:5000/health
echo.
echo Demo Accounts:
echo - Candidate: candidate@talenthub.com / password123
echo - Recruiter: recruiter@techcorp.com  / password123
echo - Admin:     admin@talenthub.com      / password123
echo ========================================================

