// diagnostico.js — CHECAGEM RAPIDA DE SAUDE (local, custo ZERO de token).
// Testa cada site com 2 termos e diz se esta OK ou o que quebrou, pra voce saber
// se precisa (e o que) pedir de conserto — sem gastar token investigando junto.
// Roda em ~3-5 min (vs 20-40 da coleta cheia). Gera diagnostico.txt.
const fs = require("fs"), path = require("path");
const sites = require("./sites");
const itens = require("./itens");

// 2 termos comuns pra separar "site quebrado" de "essa familia nao existe nesse site".
const TERMOS = [itens[0].termo, itens[3].termo]; // removedor de esmalte / agua oxigenada 40v

async function rolar(page) {
  try { await page.evaluate(async () => { for (let i = 0; i < 4; i++) { window.scrollBy(0, 1400); await new Promise(r => setTimeout(r, 400)); } }); } catch (e) {}
}

(async () => {
  const { lancar } = require("./navegador");
  const ctx = await lancar();
  const rel = [];
  for (const site of sites) {
    let totalAchado = 0, comPreco = 0, carregou = false, erro = "";
    for (const termo of TERMOS) {
      const page = await ctx.newPage();
      try {
        await page.goto(site.url(termo), { waitUntil: "domcontentloaded", timeout: 30000 });
        carregou = true;
        await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(site.espera || 3000);
        if (site.prepararBusca) await site.prepararBusca(page, termo);
        if (site.scroll) await rolar(page);
        const prods = await site.extrair(page);
        totalAchado += prods.length;
        comPreco += prods.filter(p => p.preco_regular).length;
      } catch (e) { erro = (e.message || "").slice(0, 50); }
      finally { await page.close(); }
    }
    // Classificacao
    let status, dica;
    if (!carregou) { status = "❌ NAO CARREGOU"; dica = "bloqueio de IP/anti-bot ou site fora do ar: " + erro; }
    else if (comPreco > 0) { status = "✅ OK"; dica = `${comPreco} produto(s) com preco`; }
    else if (totalAchado > 0) { status = "⚠️  SEM PRECO"; dica = "achou produtos mas nao o preco -> seletor de PRECO mudou"; }
    else { status = "⚠️  0 RESULTADOS"; dica = "pagina abriu mas nada extraido -> seletor do LINK/card mudou (ou anti-bot silencioso)"; }
    rel.push({ site: site.nome, status, dica });
    console.log(`${status.padEnd(16)} ${site.nome.padEnd(16)} ${dica}`);
  }
  await ctx.close();

  const quebrados = rel.filter(r => !r.status.includes("OK"));
  const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
  let txt = `DIAGNOSTICO ${ts}\n(rodou local, custo zero de token)\n\n`;
  txt += rel.map(r => `${r.status}  ${r.site}\n   ${r.dica}`).join("\n") + "\n\n";
  if (quebrados.length) {
    txt += `=== ${quebrados.length} site(s) PRA CONFERIR ===\n`;
    txt += quebrados.map(r => `- ${r.site}: ${r.dica}`).join("\n") + "\n\n";
    txt += "COMO PEDIR CONSERTO GASTANDO POUCO TOKEN:\n";
    txt += "Copie as linhas acima e mande pro Claude Code assim: \"conserta o seletor destes sites: <cole>\".\n";
    txt += "Ja diz QUAL site e O QUE quebrou (link/preco) -> evita a investigacao longa.\n";
  } else {
    txt += "Tudo OK. Nenhum site quebrado — nao precisa chamar o Claude.\n";
  }
  fs.writeFileSync(path.join(__dirname, "..", "diagnostico.txt"), txt);
  console.log(`\n${quebrados.length ? "⚠️  " + quebrados.length + " site(s) pra conferir." : "✅ Tudo OK."}  Detalhes em diagnostico.txt`);
})();
