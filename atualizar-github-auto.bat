@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ---- %date% %time% ---- >> log-envio.txt
git add -A >> log-envio.txt 2>&1
git commit -m "atualizar dados automatico" >> log-envio.txt 2>&1 || echo sem mudancas >> log-envio.txt
git push >> log-envio.txt 2>&1
