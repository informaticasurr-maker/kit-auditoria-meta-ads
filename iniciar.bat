@echo off
title Kit de Auditoria Meta Ads
cd /d "%~dp0"

echo =====================================================
echo  Iniciando Kit de Auditoria Meta Ads (Modo Local)...
echo =====================================================

start http://localhost:3005
node server.js
pause
