@echo off
chcp 65001 >nul
title Instalar agendamento - Monitor Avante
echo Registrando a coleta automatica (domingo e quarta, 21h)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0agendador.ps1"
echo.
pause
