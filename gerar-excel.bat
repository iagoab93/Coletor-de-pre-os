@echo off
chcp 65001 >nul
title Gerar Excel dos precos
cd /d "%~dp0scraper"
echo Gerando o Excel dos precos (Coleta MM-DD.xlsx)...
echo.
where node >nul 2>&1 || (echo [ERRO] Node nao encontrado. Instale em nodejs.org & pause & exit /b)
echo Instalando componente de Excel (so na 1a vez, pode demorar um pouco)...
call npm install exceljs --silent
echo.
node gerar-excel.js
echo.
echo Pronto. O Excel foi salvo na pasta "Coletas" (com o nome da data da coleta).
start "" "%~dp0..\Coletas"
pause
