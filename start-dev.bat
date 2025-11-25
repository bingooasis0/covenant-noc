@echo off
REM Covenant NOC - Development Server Startup Script
REM Double-click this file to start the development servers

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "start-dev.ps1"
pause

