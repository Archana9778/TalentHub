@echo off
echo ========================================================
echo       Restarting TalentHub Full-Stack Platform
echo ========================================================

call "%~dp0stop-talenthub.bat"
timeout /t 2 /nobreak >nul
call "%~dp0start-talenthub.bat"

