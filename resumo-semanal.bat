@echo off
chcp 65001 >nul
title Resumo de mudancas - Monitor Avante
cd /d "%~dp0scraper"
echo ============================================
echo   RESUMO DE MUDANCAS (vs coleta anterior)
echo   Local, custo ZERO de token.
echo ============================================
echo.
node resumo-semanal.js
if exist "%~dp0..\Coletas\resumo-semanal.html" start "" "%~dp0..\Coletas\resumo-semanal.html"
echo.
pause
