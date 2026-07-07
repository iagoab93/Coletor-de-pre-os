@echo off
chcp 65001 >nul
title Kits Mercado Livre + Consolidado
cd /d "%~dp0scraper"
echo ============================================================
echo   COLETA DE KITS - MERCADO LIVRE  (local, custo ZERO token)
echo   Abre o Chrome, coleta kits das 37 familias (~4-5 min),
echo   depois junta com os kits da Shopee num arquivo unico.
echo   NAO mexa na janela do Chrome enquanto roda.
echo ============================================================
echo.
call npm install exceljs --silent
echo Coletando kits no Mercado Livre...
node coletar-kits-ml.js
echo.
echo Consolidando Shopee + Mercado Livre...
node consolidar-kits.js
echo.
echo Pronto! Abrindo o arquivo consolidado...
start "" "%~dp0..\Kits_Consolidado.xlsx"
echo.
pause
