// Envio de mensagem pro Telegram (sem dependencias — usa o https nativo do Node).
// Config em telegram.config.json (fica FORA do Git). Modelo: telegram.config.example.json.
const https = require("https");
const fs = require("fs"), path = require("path");

function lerConfig() {
  const candidatos = [
    path.join(__dirname, "telegram.config.json"),
    path.join(__dirname, "..", "telegram.config.json"),
  ];
  for (const f of candidatos) {
    try {
      const c = JSON.parse(fs.readFileSync(f, "utf8"));
      // Aceita chatId (string) OU chatIds (lista) — normaliza pra lista de destinatarios.
      const ids = [].concat(c.chatIds || c.chatId || [])
        .map(x => String(x).trim()).filter(x => x && !/COLE_AQUI/i.test(x));
      if (c.botToken && !/COLE_AQUI/i.test(c.botToken) && ids.length) {
        return { botToken: c.botToken, chatIds: ids };
      }
    } catch (e) { /* tenta o proximo */ }
  }
  return null;
}

// Envia uma mensagem. Retorna Promise<boolean> (true = enviou). Nunca lanca — so retorna false.
function enviar(botToken, chatId, texto) {
  return new Promise((resolve) => {
    const corpo = JSON.stringify({
      chat_id: chatId,
      text: texto.slice(0, 4096),      // limite do Telegram
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${botToken}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(corpo) },
      timeout: 15000,
    }, (res) => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        if (res.statusCode === 200) resolve(true);
        else { console.error(`[Telegram] Falha HTTP ${res.statusCode}: ${d.slice(0, 200)}`); resolve(false); }
      });
    });
    req.on("error", e => { console.error("[Telegram] Erro de rede:", e.message); resolve(false); });
    req.on("timeout", () => { req.destroy(); console.error("[Telegram] Tempo esgotado."); resolve(false); });
    req.write(corpo);
    req.end();
  });
}

// Envia a mesma mensagem pra varios chatIds. Retorna {ok, total} (quantos foram).
async function enviarTodos(botToken, chatIds, texto) {
  let ok = 0;
  for (const id of chatIds) if (await enviar(botToken, id, texto)) ok++;
  return { ok, total: chatIds.length };
}

module.exports = { lerConfig, enviar, enviarTodos };
