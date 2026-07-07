@echo off
chcp 65001 >nul
title Coleta de Precos Avante
cd /d "%~dp0scraper"
echo ============================================================
echo    COLETA DE PRECOS AVANTE
echo    Demora de 20 a 40 minutos. NAO feche esta janela.
echo    Cada site vai aparecendo abaixo. Aguarde ate o final.
echo ============================================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org e tente de novo.
  echo.
  pause
  exit /b
)
echo Node: & node --version
echo Iniciando... %date% %time%
echo.
node scraper.js
echo.
echo Consolidando...
node consolidar.js
echo.
echo Gerando Excel...
call npm install exceljs --silent
node gerar-excel.js
echo.
echo Gerando alertas de concorrencia...
node gerar-alertas.js
echo.
echo Gerando resumo de mudancas (vs coleta anterior)...
node resumo-semanal.js
echo.
echo ============================================================
echo    FIM. Os arquivos gerados estao na pasta "Coletas"
echo    (Excel do dia, alertas e resumo). Abrindo a pasta...
echo ============================================================
start "" "%~dp0..\Coletas"
pause
