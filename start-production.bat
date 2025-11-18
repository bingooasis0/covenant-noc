@echo off
echo Starting NOCTURNAL in Production Mode...
echo.
set NODE_ENV=production
node server/index.js
