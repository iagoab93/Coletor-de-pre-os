@echo off
chcp 65001 >nul
title Login Shopee (uma vez so) - Monitor Avante
cd /d "%~dp0scraper"
echo ============================================================
echo   LOGIN NA SHOPEE (so precisa fazer UMA vez)
echo   Vai abrir um Chrome separado. Faca o login normalmente
echo   (resolva o captcha se pedir) e FECHE a janela no final.
echo   O login fica salvo pra todas as coletas futuras.
echo ============================================================
echo.
node shopee-login.js
echo.
pause
