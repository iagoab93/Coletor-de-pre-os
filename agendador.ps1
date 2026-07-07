# Registra a coleta no Agendador de Tarefas do Windows: domingo e quarta, 21:00.
# Roda em sessao INTERATIVA (so quando voce esta logado), pra a janela do Chrome aparecer e furar o anti-bot.
$ErrorActionPreference = "Stop"
$nome = "Monitor Avante - Coleta"
$bat  = Join-Path $PSScriptRoot "coleta-agendada.bat"

if (-not (Test-Path $bat)) { Write-Error "Nao encontrei $bat"; exit 1 }

$action    = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$bat`""
$trigger   = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday, Wednesday -At 9:00PM
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $nome -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description "Coleta de precos Avante 2x/semana (domingo e quarta, 21h) e envia alerta de concorrencia no Telegram." -Force | Out-Null

Write-Host "OK! Tarefa '$nome' registrada: DOMINGO e QUARTA as 21:00."
Write-Host "Se o PC estiver desligado no horario, ela roda assim que voce ligar (StartWhenAvailable)."
