// Coletor local (Node + Playwright). Roda no PC do usuário (IP residencial => marketplaces funcionam).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const sites = require("./sites-ampliada");
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
  // Grava ESTA coleta num arquivo proprio (nao disputa o precos.csv travado). Com espera+retry se estiver travado.
  const LOCAL = path.join(DATA_DIR, "coleta-ampliada.csv");
  const conteudo = CAB.join(";") + "\n" + linhas.map(l => CAB.map(c => csvEscape(l[c])).join(";")).join("\n") + "\n";
  function gravarSeguro(alvo, txt) {
    for (let i = 0; i < 5; i++) {
      try { fs.writeFileSync(alvo, txt); return alvo; }
      catch (e) {
        if (e.code !== "EBUSY" && e.code !== "EPERM" && e.code !== "EACCES") throw e;
        const ate = Date.now() + 1500; while (Date.now() < ate) {} // espera curta; lock do OneDrive/Excel costuma soltar
      }
    }
    const alt = alvo.replace(/(\.[^.]+)$/, "_novo$1");
    try { fs.writeFileSync(alt, txt); console.error(`[AVISO] ${path.basename(alvo)} estava travado; salvei em ${path.basename(alt)}.`); return alt; }
    catch (e2) { console.error(`[ERRO] Nao consegui salvar ${path.basename(alvo)}. Feche o Excel/OneDrive e rode de novo.`); return null; }
  }
  gravarSeguro(LOCAL, conteudo);
  const todas = linhas;

  console.log(`\n=== Coleta ${HOJE}: +${linhas.length} linhas. Historico total: ${todas.length}. ===`);
  if (zeros.length) console.log(`\n[!] ${zeros.length} buscas voltaram 0 (conferir/avisar):\n  ` + zeros.join("\n  "));
  if (falhas.length) console.log(`\n[X] ${falhas.length} falhas:\n  ` + falhas.join("\n  "));

  const resumo = `Coleta ${HOJE}\n+${linhas.length} linhas coletadas | historico total ${todas.length}\n\n=== Buscas que voltaram 0 (${zeros.length}) ===\n` + (zeros.join("\n") || "(nenhuma)") + `\n\n=== Falhas (${falhas.length}) ===\n` + (falhas.join("\n") || "(nenhuma)") + "\n";
  try { fs.writeFileSync(path.join(DATA_DIR, "ultimo-resumo-ampliada.txt"), resumo); } catch (e) {}
})();
