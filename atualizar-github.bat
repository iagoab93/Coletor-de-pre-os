@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Enviando dados atualizados para o GitHub...
git add -A
git commit -m "atualizar dados (beleza/marketplaces/kits)"
git push
echo.
echo Pronto! Se nao apareceu erro, os dados subiram e o dashboard vai atualizar em ~1 min.
pause
