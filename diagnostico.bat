@echo off
chcp 65001 >nul
title Diagnostico rapido - Monitor Avante
cd /d "%~dp0scraper"
echo ============================================================
echo   DIAGNOSTICO RAPIDO (local, custo ZERO de token)
echo   Testa cada site em ~3-5 min e diz o que quebrou.
echo ============================================================
echo.
node diagnostico.js
echo.
echo Resultado salvo em diagnostico.txt
pause
