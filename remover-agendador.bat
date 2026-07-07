@echo off
chcp 65001 >nul
title Remover agendamento - Monitor Avante
echo Removendo a tarefa agendada "Monitor Avante - Coleta"...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Unregister-ScheduledTask -TaskName 'Monitor Avante - Coleta' -Confirm:$false; Write-Host 'Removida.'"
echo.
pause
