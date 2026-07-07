@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   ALERTAS DE CONCORRENCIA - Avante
echo   (concorrente em promocao e mais barato)
echo ============================================
echo.
node scraper\gerar-alertas.js
if errorlevel 1 (
  echo.
  echo [ERRO] Nao foi possivel gerar os alertas. Rode a coleta primeiro (coletar-precos.bat).
  pause
  exit /b 1
)
echo.
echo Abrindo o relatorio no navegador...
start "" "%~dp0..\Coletas\alertas.html"
echo.
pause
