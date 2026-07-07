// resumo-semanal.js — compara a coleta ATUAL com a ANTERIOR e resume o que mudou.
// 100% local (custo ZERO de token). Guarda um snapshot por data em data/historico/,
// pega os dois mais recentes e reporta: novos alertas, alertas resolvidos, maiores quedas.
// Gera resumo-semanal.html e manda no Telegram (se houver novidade).
const fs = require("fs"), path = require("path");
const lib = require("./lib-alertas");
const { precoEfetivo, isAvante, ehUnidade, brl, marcaExibir } = lib;

const RAIZ = path.join(__dirname, "..");
const DATA = path.join(RAIZ, "data");
const HIST = path.join(DATA, "historico");
const SAIDAS = path.join(RAIZ, "..", "Coletas"); // pasta dedicada aos arquivos gerados
fs.mkdirSync(SAIDAS, { recursive: true });

// ---------- 1) SNAPSHOT por data (bootstrap + crescimento automatico) ----------
const precos = JSON.parse(fs.readFileSync(path.join(DATA, "precos.json"), "utf8"));
fs.mkdirSync(HIST, { recursive: true });
for (const d of [...new Set(precos.map(r => r.Data_coleta).filter(Boolean))]) {
  const f = path.join(HIST, `coleta-${d}.json`);
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(precos.filter(r => r.Data_coleta === d)));
}

// ---------- 2) Dois snapshots mais recentes ----------
const arquivos = fs.readdirSync(HIST).filter(f => /^coleta-.*\.json$/.test(f)).sort(); // ISO -> ordem cronologica
const nomeData = f => f.replace(/^coleta-/, "").replace(/\.json$/, "");
if (arquivos.length < 2) {
  console.log(`So ha ${arquivos.length} coleta no historico. O resumo comeca a comparar a partir da 2a coleta.`);
  process.exit(0);
}
const fAtual = arquivos[arquivos.length - 1], fAnt = arquivos[arquivos.length - 2];
const dAtual = nomeData(fAtual), dAnt = nomeData(fAnt);
const atual = JSON.parse(fs.readFileSync(path.join(HIST, fAtual), "utf8"));
const anterior = JSON.parse(fs.readFileSync(path.join(HIST, fAnt), "utf8"));

// ---------- 3) Novos / resolvidos alertas ----------
const alAtual = lib.calcularAlertas(lib.filtrarUltimaColetaPorSite(atual));
const alAnt = lib.calcularAlertas(lib.filtrarUltimaColetaPorSite(anterior));
const chave = a => [a.site, a.categoria, a.tamanho].join("|");
const setAnt = new Set(alAnt.map(chave)), setAt = new Set(alAtual.map(chave));
const novos = alAtual.filter(a => !setAnt.has(chave(a)));       // concorrente passou a te bater
const resolvidos = alAnt.filter(a => !setAt.has(chave(a)));     // voce voltou a ficar competitivo

// ---------- 4) Maiores quedas de preco (radar de promocoes) ----------
function mapaPreco(rows) {
  const m = {};
  for (const r of rows) {
    if (!ehUnidade(r)) continue;
    const p = precoEfetivo(r); if (p == null) continue;
    const k = [r.Site, r.Categoria, r.Tamanho, r["Descrição"]].join("|");
    if (!(k in m) || p < m[k].preco) m[k] = { preco: p, row: r };
  }
  return m;
}
const mAt = mapaPreco(atual), mAn = mapaPreco(anterior);
const quedas = [];
for (const k in mAt) {
  if (!(k in mAn)) continue;
  const ap = mAt[k].preco, bp = mAn[k].preco;
  if (ap < bp - 0.001) {
    const r = mAt[k].row;
    quedas.push({ site: r.Site, desc: r["Descrição"], marca: marcaExibir(r), tam: r.Tamanho,
      de: bp, para: ap, dif: +(bp - ap).toFixed(2), pct: Math.round((bp - ap) / bp * 100), avante: isAvante(r) });
  }
}
quedas.sort((x, y) => y.pct - x.pct || y.dif - x.dif);
const quedasConc = quedas.filter(q => !q.avante).slice(0, 8);

const houveNovidade = novos.length || resolvidos.length || quedasConc.length;

// ---------- 5) HTML ----------
const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const secao = (titulo, cor, itensHtml) => itensHtml
  ? `<h2 style="color:${cor}">${titulo}</h2><ul>${itensHtml}</ul>` : "";
const html = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Resumo — Monitor Avante</title>
<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:820px;margin:0 auto;padding:20px;color:#1c2430}
h1{font-size:20px} h2{font-size:15px;margin-top:22px;border-bottom:2px solid #eee;padding-bottom:4px}
li{margin:6px 0;font-size:14px} .q{color:#b3123a;font-weight:700} b{color:#12633a}</style></head><body>
<h1>📊 Resumo de mudancas — Avante</h1>
<p>Comparando a coleta de <b>${esc(dAnt)}</b> → <b>${esc(dAtual)}</b>.</p>
${secao("🔴 Novos concorrentes te batendo (" + novos.length + ")", "#b3123a",
  novos.map(a => `<li><b>${esc(a.site)}</b> — ${esc(a.categoria)} ${esc(a.tamanho)}: ${esc(a.conc_marca || a.conc_desc)} a <span class="q">R$ ${brl(a.conc_preco)}</span> (voce R$ ${brl(a.avante_preco)}, -${a.pct}%)</li>`).join(""))}
${secao("🟢 Voltou a ficar competitivo (" + resolvidos.length + ")", "#12633a",
  resolvidos.map(a => `<li><b>${esc(a.site)}</b> — ${esc(a.categoria)} ${esc(a.tamanho)}</li>`).join(""))}
${secao("📉 Maiores quedas de preco de concorrentes", "#8a5a00",
  quedasConc.map(q => `<li><b>${esc(q.site)}</b> — ${esc(q.marca || q.desc)} ${esc(q.tam)}: de R$ ${brl(q.de)} por <span class="q">R$ ${brl(q.para)}</span> (-${q.pct}%)</li>`).join(""))}
${houveNovidade ? "" : "<p><b>Nenhuma mudanca relevante desde a coleta anterior.</b></p>"}
</body></html>`;
fs.writeFileSync(path.join(SAIDAS, "resumo-semanal.html"), html, "utf8");

// ---------- 6) Telegram (so se houve novidade) ----------
const mdSafe = s => String(s ?? "").replace(/[_*`\[\]]/g, "");
function montar() {
  let m = `📊 *Resumo — Avante* (${mdSafe(dAnt)} → ${mdSafe(dAtual)})\n`;
  if (novos.length) {
    m += `\n🔴 *${novos.length} novo(s) concorrente(s) te batendo:*\n` +
      novos.slice(0, 8).map(a => `• ${mdSafe(a.site)} — ${mdSafe(a.categoria)} ${mdSafe(a.tamanho)}: ${mdSafe(a.conc_marca || a.conc_desc.slice(0, 22))} R$ ${brl(a.conc_preco)} (-${a.pct}%)`).join("\n") + "\n";
  }
  if (resolvidos.length) m += `\n🟢 *${resolvidos.length} alerta(s) resolvido(s)* (voltou a ficar competitivo).\n`;
  if (quedasConc.length) {
    m += `\n📉 *Maiores quedas de concorrentes:*\n` +
      quedasConc.slice(0, 5).map(q => `• ${mdSafe(q.site)} — ${mdSafe(q.marca || q.desc.slice(0, 22))}: R$ ${brl(q.de)} → R$ ${brl(q.para)} (-${q.pct}%)`).join("\n") + "\n";
  }
  return m.trim();
}

// ---------- Console + envio ----------
console.log(`\nResumo ${dAnt} -> ${dAtual}: ${novos.length} novo(s), ${resolvidos.length} resolvido(s), ${quedasConc.length} queda(s) de concorrente.`);
console.log("Relatorio: resumo-semanal.html\n");

(async () => {
  if (!houveNovidade) { console.log("[Telegram] Sem novidade — nao enviei resumo (evita ruido).\n"); return; }
  const tg = require("./notificar-telegram");
  const cfg = tg.lerConfig();
  if (!cfg) { console.log("[Telegram] Nao configurado — pulei o envio.\n"); return; }
  const r = await tg.enviarTodos(cfg.botToken, cfg.chatIds, montar());
  console.log(`[Telegram] Resumo enviado para ${r.ok}/${r.total} destinatario(s). ${r.ok ? "✅" : "❌"}\n`);
})();
