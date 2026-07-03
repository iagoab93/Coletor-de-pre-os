@echo off
chcp 65001 >nul
title Instalar navegador Playwright
cd /d "%~dp0scraper"
echo Instalando o navegador do Playwright (Chromium)... pode demorar alguns minutos.
echo.
call npx playwright install chromium
echo.
echo Pronto. Agora rode o teste-rapido.bat de novo.
pause
