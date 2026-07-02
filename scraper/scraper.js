// Coletor determinístico (Node + Playwright). Sem IA. Roda no GitHub Actions.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const sites = require("./sites");
const itens = require("./itens");
const MARCAS = itens.MARCAS;

const HOJE = new Date().toISOString().slice(0, 10);
const DATA_DIR = path.join(__dirname, "..", "data");
const CSV = path.join(DATA_DIR, "precos.csv");
const JSON_OUT = path.join(DATA_DIR, "precos.json");
const CABECALHO = ["Data_coleta","Canal","Site","Categoria","Marca","Descrição","Tamanho","Preço regular","Preço promo","Link"];

const detectarMarca = nome => (MARCAS.find(m => new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i").test(nome)) || (nome.split(" ")[0]||"")).trim();
const detectarTamanho = nome => { const m = (nome||"").match(/(\d+[.,]?\d*)\s?(ml|kg|g|l)\b/i); return m ? m[1].replace(".","")+m[2].toLowerCase() : ""; };
const br = n => (n === "" || n == null) ? "" : String(n).replace(".", ",");
const csvEscape = v => { v = String(v ?? ""); return /[;"\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };

(async () => {
  const browser = await chromium.launch();
  const linhas = [];
  for (const site of sites) {
    for (const item of itens) {
      const page = await browser.newPage();
      try {
        await page.goto(site.url(item.termo), { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(site.espera || 2500);
        if (site.prepararBusca) await site.prepararBusca(page, item.termo);
        let prods = await site.extrair(page);
        prods = prods
          .map(p => ({ ...p, marca: detectarMarca(p.descricao), tamanho: detectarTamanho(p.descricao) }))
          .filter(p => p.preco_regular);
        // teto de 12 por família/site (evita capturar demais)
        for (const p of prods.slice(0, 12)) {
          linhas.push({ Data_coleta: HOJE, Canal: site.canal, Site: site.nome, Categoria: item.cat,
            Marca: p.marca, "Descrição": p.descricao, Tamanho: p.tamanho,
            "Preço regular": br(p.preco_regular), "Preço promo": br(p.preco_promo), Link: p.link });
        }
        console.log(`[OK] ${site.nome} / ${item.termo}: ${prods.length} itens`);
      } catch (e) {
        console.error(`[FALHA] ${site.nome} / ${item.termo}: ${e.message}`);
      } finally { await page.close(); }
    }
  }
  await browser.close();

  fs.mkdirSync(DATA_DIR, { recursive: true });
  // append no histórico CSV (cria cabeçalho se novo)
  if (!fs.existsSync(CSV)) fs.writeFileSync(CSV, CABECALHO.join(";") + "\n");
  const novas = linhas.map(l => CABECALHO.map(c => csvEscape(l[c])).join(";")).join("\n");
  if (novas) fs.appendFileSync(CSV, novas + "\n");

  // JSON completo (histórico) para o dashboard
  const todas = fs.readFileSync(CSV, "utf8").trim().split("\n").slice(1).map(linha => {
    const cols = linha.split(";"); const o = {}; CABECALHO.forEach((c,i)=>o[c]=(cols[i]||"").replace(/^"|"$/g,"")); return o;
  });
  fs.writeFileSync(JSON_OUT, JSON.stringify(todas, null, 0));
  console.log(`\nColeta ${HOJE}: +${linhas.length} linhas. Total histórico: ${todas.length}.`);
})();
