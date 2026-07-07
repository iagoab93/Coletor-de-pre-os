// gerar-alertas.js — Alerta de concorrência para a marca Avante.
// Regra: nas LOJAS onde a Avante vende, avisa quando um concorrente esta
//        EM PROMOCAO e MAIS BARATO que a Avante (mesma categoria + mesmo tamanho).
// Le data/precos.json e gera: data/alertas.json, alertas.csv e alertas.html (na raiz).
const fs = require("fs"), path = require("path");
const RAIZ = path.join(__dirname, "..");
const DATA = path.join(RAIZ, "data");
const SAIDAS = path.join(RAIZ, "..", "Coletas"); // pasta dedicada aos arquivos gerados
fs.mkdirSync(SAIDAS, { recursive: true });

// Logica de precos/alertas mora em lib-alertas.js (compartilhada com resumo-semanal.js).
const lib = require("./lib-alertas");
const { num, brl } = lib;

const dadosBrutos = JSON.parse(fs.readFileSync(path.join(DATA, "precos.json"), "utf8"));
const dados = lib.filtrarUltimaColetaPorSite(dadosBrutos);
const alertas = lib.calcularAlertas(dados);

// ---------- SAIDAS ----------
fs.writeFileSync(path.join(DATA, "alertas.json"), JSON.stringify(alertas, null, 1));

// CSV  (brl vem do lib-alertas)
// Neutraliza injecao de formula (nome raspado da web) e faz o quoting do CSV.
const q = s => { let v = String(s ?? ""); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
const cab = ["Loja", "Categoria", "Tamanho", "Meu produto (Avante)", "Meu preco", "Concorrente", "Produto concorrente", "Preco regular conc.", "Preco promo conc.", "Diferenca (R$)", "Diferenca (%)", "Link concorrente", "Data"];
const linhas = alertas.map(a => [
  a.site, a.categoria, a.tamanho, a.avante_desc, brl(a.avante_preco),
  a.conc_marca, a.conc_desc, brl(a.conc_regular), brl(a.conc_promo),
  brl(a.diferenca), a.pct + "%", a.conc_link, a.data
].map(q).join(";"));
fs.writeFileSync(path.join(SAIDAS, "alertas.csv"), "﻿" + [cab.map(q).join(";"), ...linhas].join("\r\n"), "utf8");

// HTML
const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const badge = pct => `<span class="badge">-${pct}%</span>`;
const linhasHtml = alertas.map(a => `
  <tr>
    <td>${esc(a.site)}</td>
    <td>${esc(a.categoria)}<br><span class="tam">${esc(a.tamanho)}</span></td>
    <td class="meu">${esc(a.avante_desc)}<br><b>R$ ${brl(a.avante_preco)}</b>${a.avante_emPromo ? ' <span class="tag">em promo</span>' : ""}</td>
    <td>${esc(a.conc_marca)}<br><span class="cdesc">${esc(a.conc_desc)}</span>${a.n_concorrentes_promo > 1 ? `<br><span class="tam">+${a.n_concorrentes_promo - 1} outro(s) em promo</span>` : ""}</td>
    <td class="conc"><b>R$ ${brl(a.conc_preco)}</b>${a.conc_regular != null && a.conc_promo != null && a.conc_regular <= a.conc_preco * 4 ? `<br><span class="de">de R$ ${brl(a.conc_regular)}</span>` : ""}</td>
    <td class="dif">-R$ ${brl(a.diferenca)}<br>${badge(a.pct)}</td>
    <td>${a.conc_link ? `<a href="${esc(a.conc_link)}" target="_blank">abrir</a>` : ""}</td>
  </tr>`).join("");

const dataGer = alertas[0]?.data || "";
const html = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Alertas de concorrencia — Avante</title>
<style>
  body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;background:#f6f7f9;color:#1c2430}
  header{background:#b3123a;color:#fff;padding:20px 24px}
  header h1{margin:0;font-size:20px} header p{margin:6px 0 0;opacity:.9;font-size:13px}
  .wrap{padding:20px 24px;max-width:1100px;margin:0 auto}
  .resumo{display:flex;gap:14px;margin-bottom:18px;flex-wrap:wrap}
  .card{background:#fff;border-radius:10px;padding:14px 18px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .card b{font-size:26px;display:block}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  th,td{padding:10px 12px;text-align:left;font-size:13px;border-bottom:1px solid #eef0f3;vertical-align:top}
  th{background:#f0f2f5;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:#5a6472}
  .badge{background:#b3123a;color:#fff;border-radius:20px;padding:2px 9px;font-weight:700;font-size:12px}
  .tam{color:#7a8290;font-size:12px}
  .cdesc,.de{color:#7a8290;font-size:12px} .de{text-decoration:line-through}
  .meu b{color:#12633a} .conc b{color:#b3123a} .dif{white-space:nowrap}
  .tag{background:#e6f4ec;color:#12633a;border-radius:4px;padding:1px 5px;font-size:11px}
  a{color:#1560d4} .vazio{background:#fff;padding:40px;text-align:center;border-radius:10px;color:#12633a;font-size:16px}
</style></head><body>
<header><h1>🚨 Alertas de concorrencia — Avante</h1>
<p>Concorrente EM PROMOCAO e mais barato que a Avante, na mesma loja/categoria/tamanho. Ultima coleta: ${esc(dataGer)}</p></header>
<div class="wrap">
  <div class="resumo">
    <div class="card"><b>${alertas.length}</b>alertas ativos</div>
    <div class="card"><b>${new Set(alertas.map(a => a.site)).size}</b>lojas afetadas</div>
    <div class="card"><b>${alertas[0]?.pct ?? 0}%</b>maior diferenca</div>
  </div>
  ${alertas.length ? `<table><thead><tr>
    <th>Loja</th><th>Categoria</th><th>Meu produto (Avante)</th><th>Concorrente</th><th>Preco conc.</th><th>Diferenca</th><th>Link</th>
  </tr></thead><tbody>${linhasHtml}</tbody></table>`
  : `<div class="vazio">✅ Nenhum concorrente em promocao esta mais barato que a Avante agora. Bom trabalho!</div>`}
</div></body></html>`;
fs.writeFileSync(path.join(SAIDAS, "alertas.html"), html, "utf8");

// Console
console.log(`\n🚨 ${alertas.length} alerta(s): concorrente em promocao mais barato que a Avante.\n`);
alertas.slice(0, 20).forEach(a =>
  console.log(`  ${a.site} | ${a.categoria} ${a.tamanho} | Avante R$${brl(a.avante_preco)} -> ${a.conc_marca || a.conc_desc.slice(0, 34)} R$${brl(a.conc_preco)} (-${a.pct}%)`));
if (alertas.length > 20) console.log(`  ... e mais ${alertas.length - 20}.`);
console.log(`\nRelatorio: alertas.html  |  Planilha: alertas.csv  |  Dados: data/alertas.json\n`);

// ---------- NOTIFICACAO TELEGRAM ----------
// Remove caracteres que quebram o Markdown do Telegram nas partes dinamicas.
const mdSafe = s => String(s ?? "").replace(/[_*`\[\]]/g, "");
function montarMensagem() {
  if (!alertas.length) {
    return `✅ *Monitor Avante* — coleta ${dataGer || "de hoje"} concluida.\nNenhum concorrente em promocao esta mais barato que a Avante agora.`;
  }
  const topo = alertas.slice(0, 15);
  const linhas = topo.map((a, i) =>
    `${i + 1}. *${mdSafe(a.site)}* — ${mdSafe(a.categoria)} ${mdSafe(a.tamanho)}\n` +
    `   Voce R$ ${brl(a.avante_preco)} → ${mdSafe(a.conc_marca || a.conc_desc.slice(0, 30))} *R$ ${brl(a.conc_preco)}* (-${a.pct}%)`
  ).join("\n");
  const rodape = alertas.length > 15 ? `\n\n… e mais ${alertas.length - 15} alerta(s).` : "";
  return `🚨 *Alerta de concorrencia — Avante*\n_Coleta ${mdSafe(dataGer)}_\n\n` +
    `${alertas.length} concorrente(s) em promocao e mais barato(s) que voce:\n\n${linhas}${rodape}\n\n` +
    `📊 Relatorio completo: abra o alertas.html no PC.`;
}

(async () => {
  const tg = require("./notificar-telegram");
  const cfg = tg.lerConfig();
  if (!cfg) {
    console.log("[Telegram] Nao configurado — pulei o envio. (Crie scraper/telegram.config.json a partir do .example)\n");
    return;
  }
  const r = await tg.enviarTodos(cfg.botToken, cfg.chatIds, montarMensagem());
  console.log(`[Telegram] Enviado para ${r.ok}/${r.total} destinatario(s). ${r.ok ? "✅" : "❌"}\n`);
})();
