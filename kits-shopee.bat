@echo off
chcp 65001 >nul
title Kits Shopee + Consolidado
cd /d "%~dp0scraper"
echo ============================================================
echo   COLETA DE KITS - SHOPEE  (local, custo ZERO de token)
echo   Usa o login salvo (se ainda nao logou: shopee-login.bat).
echo   Se a Shopee pedir captcha, um POPUP avisa voce.
echo   NAO feche a janela do Chrome enquanto roda.
echo ============================================================
echo.
node coletar-kits-shopee.js
echo.
echo Consolidando Shopee + Mercado Livre...
call npm install exceljs --silent
node consolidar-kits.js
echo.
echo Pronto! Abrindo o arquivo consolidado...
start "" "%~dp0..\Kits_Consolidado.xlsx"
echo.
pause
