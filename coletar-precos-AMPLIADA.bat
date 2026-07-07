@echo off
chcp 65001 >nul
title Coleta AMPLIADA (experimental)
cd /d "%~dp0scraper"
echo ============================================================
echo    COLETA AMPLIADA (experimental) - inclui sites novos.
echo    NAO afeta o coletar-precos.bat normal (arquivos separados).
echo    Demora bastante. Uma janela do Chrome vai abrir e trabalhar.
echo ============================================================
echo.
where node >nul 2>&1 || (echo [ERRO] Node nao encontrado. Instale em nodejs.org & pause & exit /b)
node --version
echo.
node scraper-ampliada.js
echo.
echo Consolidando (junta a coleta ampliada com o resto)...
node consolidar.js
echo.
echo ============================================================
echo    FIM. Veja em data\ultimo-resumo-ampliada.txt quais sites
echo    voltaram 0 (esses precisam de ajuste no adaptador).
echo ============================================================
pause
