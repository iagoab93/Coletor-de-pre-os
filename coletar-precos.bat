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
echo ============================================================
echo    FIM. Veja acima (e no arquivo data\ultimo-resumo.txt) a
echo    lista de "buscas que voltaram 0".
echo ============================================================
pause
