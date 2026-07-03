// Coletor local (Node + Playwright). Roda no PC do usuário (IP residencial => marketplaces funcionam).
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
const CAB = ["Data_coleta","Canal","Site","Categoria","Marca","Descrição","Tamanho","Preço regular","Preço promo","Disponibilidade","Vendido por","Loja oficial?","Nota","Nº avaliações","Qtd vendida","Link","Formato","Fonte"];

const detectarMarca = nome => (MARCAS.find(m => new RegExp("\\b" + m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(nome)) || (nome.split(" ")[0] || "")).trim();
const detectarTamanho = nome => { const m = (nome || "").match(/(\d+[.,]?\d*)\s?(ml|kg|g|l)\b/i); return m ? m[1].replace(".", "") + m[2].toLowerCase() : ""; };
const br = n => (n === "" || n == null) ? "" : String(n).replace(".", ",");
const semAcento = s => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "");
const csvEscape = v => { v = String(v ?? "").replace(/[\r\n]+/g, " ").trim(); return /[;"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };

async function rolar(page) {
  try { await page.evaluate(async () => { for (let i = 0; i < 6; i++) { window.scrollBy(0, 1400); await new Promise(r => setTimeout(r, 500)); } window.scrollTo(0, 0); }); } catch (e) {}
}

(async () => {
  const { lancar } = require("./navegador");
  const ctx = await lancar();
  const linhas = [], zeros = [], falhas = [];
  for (const site of sites) {
    for (const item of itens) {
      const page = await ctx.newPage();
      let n = 0;
      try {
        await page.goto(site.url(item.termo), { waitUntil: "domcontentloaded", timeout: 35000 });
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(site.espera || 3500);
        if (site.prepararBusca) await site.prepararBusca(page, item.termo);
        if (site.scroll) { await rolar(page); await page.waitForTimeout(1200); }
        let prods = await site.extrair(page);
        prods = prods.map(p => ({ ...p, marca: detectarMarca(p.descricao), tamanho: detectarTamanho(p.descricao) })).filter(p => p.preco_regular);
        n = prods.length;
        for (const p of prods.slice(0, 12)) {
          linhas.push({ Data_coleta: HOJE, Canal: site.canal, Site: semAcento(site.nome), Categoria: semAcento(item.cat),
            Marca: semAcento(p.marca), "Descrição": semAcento(p.descricao), Tamanho: p.tamanho,
            "Preço regular": br(p.preco_regular), "Preço promo": br(p.preco_promo),
            Disponibilidade: "Em estoque", "Vendido por": semAcento(p.vendido_por || ""), "Loja oficial?": "",
            Nota: "", "Nº avaliações": "", "Qtd vendida": "", Link: p.link, Formato: p.formato || "Unidade", Fonte: "Local" });
        }
        if (n === 0) zeros.push(`${site.nome} / ${item.termo}`);
        console.log(`[${n > 0 ? "OK" : " 0"}] ${site.nome} / ${item.termo}: ${n}`);
      } catch (e) {
        falhas.push(`${site.nome} / ${item.termo}: ${(e.message || "").slice(0, 60)}`);
        console.error(`[FALHA] ${site.nome} / ${item.termo}: ${(e.message || "").slice(0, 60)}`);
      } finally { await page.close(); }
    }
  }
  await ctx.close();

  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Auto-corrige o cabeçalho: se o precos.csv estiver vazio ou no formato antigo, recria com 18 colunas.
  if (fs.existsSync(CSV)) {
    const primeira = (fs.readFileSync(CSV, "utf8").split("\n")[0] || "").trim();
    if (primeira !== CAB.join(";")) {
      try { fs.copyFileSync(CSV, path.join(DATA_DIR, "precos_formato_antigo.csv")); } catch (e) {}
      fs.writeFileSync(CSV, CAB.join(";") + "\n");
      console.log("(cabeçalho do precos.csv atualizado para o formato novo de 18 colunas)");
    } else {
      try { fs.copyFileSync(CSV, path.join(DATA_DIR, "precos_backup.csv")); } catch (e) {}
    }
  } else {
    fs.writeFileSync(CSV, CAB.join(";") + "\n");
  }
  const novas = linhas.map(l => CAB.map(c => csvEscape(l[c])).join(";")).join("\n");
  function gravar(fn, alvo) {
    try { fn(alvo); return alvo; }
    catch (e) {
      if (e.code !== "EBUSY" && e.code !== "EPERM" && e.code !== "EACCES") throw e;
      const alt = alvo.replace(/(\.[^.]+)$/, "_novo$1");
      console.error(`[AVISO] ${path.basename(alvo)} estava aberto/travado (feche o Excel/dashboard). Salvei em ${path.basename(alt)}.`);
      fn(alt); return alt;
    }
  }
  if (novas) gravar(a => fs.appendFileSync(a, novas + "\n"), CSV);

  let baseCSV = CSV; if (!fs.existsSync(CSV)) baseCSV = CSV.replace(/(\.[^.]+)$/, "_novo$1");
  const todas = fs.existsSync(baseCSV) ? fs.readFileSync(baseCSV, "utf8").trim().split("\n").slice(1).map(linha => {
    const cols = linha.split(";"); const o = {}; CAB.forEach((c, i) => o[c] = (cols[i] || "").replace(/^"|"$/g, "")); return o;
  }) : [];
  gravar(a => fs.writeFileSync(a, JSON.stringify(todas, 0, 0)), JSON_OUT);

  console.log(`\n=== Coleta ${HOJE}: +${linhas.length} linhas. Historico total: ${todas.length}. ===`);
  if (zeros.length) console.log(`\n[!] ${zeros.length} buscas voltaram 0 (conferir/avisar):\n  ` + zeros.join("\n  "));
  if (falhas.length) console.log(`\n[X] ${falhas.length} falhas:\n  ` + falhas.join("\n  "));

  const resumo = `Coleta ${HOJE}\n+${linhas.length} linhas coletadas | historico total ${todas.length}\n\n=== Buscas que voltaram 0 (${zeros.length}) ===\n` + (zeros.join("\n") || "(nenhuma)") + `\n\n=== Falhas (${falhas.length}) ===\n` + (falhas.join("\n") || "(nenhuma)") + "\n";
  try { fs.writeFileSync(path.join(DATA_DIR, "ultimo-resumo.txt"), resumo); } catch (e) {}
})();
