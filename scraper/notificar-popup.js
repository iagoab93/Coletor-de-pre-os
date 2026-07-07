// notificar-popup.js — popup nativo do Windows pedindo acao do usuario (captcha/login).
// Bloqueia o script ate o usuario clicar OK (segundos=0 espera pra sempre).
// SEM_POPUP=1 no ambiente suprime (para testes/automatizado) e so loga no console.
const { spawnSync } = require("child_process");

function popup(titulo, msg, segundos = 0) {
  if (process.env.SEM_POPUP) { console.log(`[POPUP suprimido] ${titulo}: ${msg.replace(/\n/g, " / ")}`); return; }
  const limpar = s => String(s).replace(/["'`$]/g, "’"); // nada que quebre a string do PowerShell
  const t = limpar(titulo);
  const m = limpar(msg).replace(/\r?\n/g, "`n");
  // WScript.Shell.Popup: 48 = icone de exclamacao + botao OK; vem pra frente e toca o som do sistema.
  spawnSync("powershell", ["-NoProfile", "-Command",
    `(New-Object -ComObject WScript.Shell).Popup("${m}", ${segundos}, "${t}", 48) | Out-Null`],
    { stdio: "ignore" });
}

module.exports = { popup };
