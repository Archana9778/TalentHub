@echo off
echo ========================================================
echo       Stopping TalentHub Services
echo ========================================================
echo Terminating processes on ports 5000 (Backend) and 5173 (Frontend)...

powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5000, 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo Done! TalentHub services stopped successfully.
echo ========================================================

