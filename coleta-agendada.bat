@echo off
chcp 65001 >nul
title Monitor Avante - Coleta agendada
cd /d "%~dp0scraper"
set "LOG=%~dp0log-agendador.txt"

echo ============================================================>> "%LOG%"
echo COLETA AGENDADA - inicio: %date% %time%>> "%LOG%"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado.>> "%LOG%"
  exit /b 1
)

call npm install exceljs --silent >> "%LOG%" 2>&1
echo -- scraper.js -->> "%LOG%"
node scraper.js >> "%LOG%" 2>&1
echo -- consolidar.js -->> "%LOG%"
node consolidar.js >> "%LOG%" 2>&1
echo -- gerar-excel.js -->> "%LOG%"
node gerar-excel.js >> "%LOG%" 2>&1
echo -- gerar-alertas.js (gera + envia Telegram) -->> "%LOG%"
node gerar-alertas.js >> "%LOG%" 2>&1
echo -- resumo-semanal.js (mudancas vs coleta anterior) -->> "%LOG%"
node resumo-semanal.js >> "%LOG%" 2>&1

echo COLETA AGENDADA - fim: %date% %time%>> "%LOG%"
exit /b 0
