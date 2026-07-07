@echo off
chcp 65001 >nul
title Analises gerenciais - Monitor Avante
cd /d "%~dp0scraper"
echo ============================================================
echo   ANALISES GERENCIAIS (local, custo ZERO de token)
echo   Competitividade, dispersao, promocoes, ruptura, kits,
echo   marcas novas e curva de preco.
echo   Usa os dados JA coletados (nao coleta nada agora).
echo ============================================================
echo.
echo Atualizando o consolidado de kits...
node consolidar-kits.js
echo.
echo Gerando as analises...
node gerar-analises.js
if errorlevel 1 (
  echo [ERRO] Falhou. Rode a coleta primeiro (coletar-precos.bat).
  pause & exit /b 1
)
start "" "%~dp0..\Coletas\analises.html"
pause
