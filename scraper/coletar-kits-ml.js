// coletar-kits-ml.js — coleta KITS no Mercado Livre (local, navegador real, custo ZERO de token).
// Igual ao Shopee_Kits, mas do ML: busca "kit <familia>", filtra so kits, pega preco+nota+vendas(quando houver).
// Saida: ../ML_Kits.csv (mesmo esquema do Shopee + coluna Marketplace).
// OBS: o ML raramente expoe "vendidos" na busca (so alguns cards) -> essa coluna sai vazia quando nao ha.
const fs = require("fs"), path = require("path");
const itens = require("./itens");
const MARCAS = itens.MARCAS;

const HOJE = new Date().toISOString().slice(0, 10);
const SAIDA = path.join(__dirname, "..", "ML_Kits.csv");
const MAX_FAM = process.env.MAX_FAM ? +process.env.MAX_FAM : itens.length; // p/ testar rapido: MAX_FAM=4
const POR_FAMILIA = 8;

const slug = t => t.trim().toLowerCase().replace(/\s+/g, "-");
const detectarMarca = nome => (MARCAS.find(m => new RegExp("\\b" + m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(nome)) || "").trim();
const semAcento = s => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "");
const csvCell = v => { v = String(v ?? "").replace(/[\r\n]+/g, " ").trim(); if (/^[=+\-@\t]/.test(v)) v = "'" + v; return /[;"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
// "10mil+" -> 10000 ; "+50 vendidos" -> 50 ; "2 mil vendidos" -> 2000
function estimarVendas(txt) {
  if (!txt) return "";
  const m = txt.match(/([\d.]+)\s*(mil)?/i); if (!m) return "";
  let n = parseInt(m[1].replace(/\D/g, "")); if (isNaN(n)) return "";
  if (/mil/i.test(txt)) n *= 1000;
  return n;
}

async function extrairKitsML(page) {
  return page.evaluate(() => {
    function amt(el) { if (!el) return null; const f = el.querySelector(".andes-money-amount__fraction"); if (!f) return null; const c = el.querySelector(".andes-money-amount__cents"); const n = parseInt((f.innerText || "").replace(/\D/g, "")); if (!n) return null; return n + (c ? parseInt(c.innerText.replace(/\D/g, "")) / 100 : 0); }
    const EH_KIT = /kit|leve\s*\d|\d\s*un(id)?|combo|c\/\s*\d|conjunto|\bcom\s+\d+\b|\bpack\b/i;
    const seen = {}, out = [];
    document.querySelectorAll(".poly-card, li.ui-search-layout__item").forEach(li => {
      const a = li.querySelector("a.poly-component__title") || li.querySelector('a[href*="/MLB"]');
      if (!a) return;
      const link = (a.href || "").split("#")[0].split("?")[0];
      if (/click1|mclics/.test(link) || seen[link]) return;
      const nome = (a.innerText || a.getAttribute("title") || "").trim().split("\n")[0];
      if (!nome || nome.length < 6 || !EH_KIT.test(nome)) return;
      if (/(^|\s)Ad$/.test(li.innerText.trim())) return; // patrocinado
      const prevEl = li.querySelector(".andes-money-amount--previous");
      const curEl = li.querySelector(".andes-money-amount.poly-price__amount:not(.andes-money-amount--previous)") || li.querySelector(".poly-price__current .andes-money-amount:not(.andes-money-amount--previous)");
      const cur = amt(curEl), prev = amt(prevEl);
      const preco = (cur != null ? cur : prev);
      if (preco == null) return;
      const revEl = li.querySelector(".poly-component__review-compacted, .poly-reviews__rating");
      const revTxt = revEl ? revEl.innerText.replace(/\s+/g, " ").trim() : "";
      const nota = (revTxt.match(/\b([0-5][.,]\d)\b/) || [])[1] || "";
      const aval = (revTxt.match(/\(([\d.]+)\)/) || [])[1] || "";
      const vend = (li.innerText.match(/\+?\s*[\d.]+\s*(mil\s*)?vendidos?/i) || [])[0] || "";
      const vendEl = li.querySelector(".poly-component__seller");
      const vendedor = vendEl ? vendEl.innerText.replace(/^por\s*/i, "").trim() : "";
      seen[link] = 1;
      out.push({ nome: nome.slice(0, 110), preco, nota, aval, vend: vend.trim(), vendedor, link });
    });
    return out;
  });
}

async function rolar(page) { try { await page.evaluate(async () => { for (let i = 0; i < 5; i++) { window.scrollBy(0, 1500); await new Promise(r => setTimeout(r, 450)); } window.scrollTo(0, 0); }); } catch (e) {} }

(async () => {
  const { lancar } = require("./navegador");
  const ctx = await lancar();
  const linhas = [], zeros = [];
  const familias = itens.slice(0, MAX_FAM);
  for (const item of familias) {
    const page = await ctx.newPage();
    try {
      const url = `https://lista.mercadolivre.com.br/${slug("kit " + item.termo)}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
      // espera inteligente: segue assim que os cards aparecem (max 8s), + settle curto
      await page.waitForSelector(".poly-card", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await rolar(page);
      await page.waitForTimeout(800);
      const kits = (await extrairKitsML(page)).slice(0, POR_FAMILIA);
      for (const k of kits) {
        linhas.push({
          Marketplace: "Mercado Livre", Data: HOJE, Categoria: semAcento(item.cat),
          Kit: semAcento(k.nome), Marca: semAcento(detectarMarca(k.nome)),
          Preco: String(k.preco).replace(".", ","), Nota: k.nota.replace(".", ","),
          Vendidos_texto: semAcento(k.vend), Vendidos_estimado: estimarVendas(k.vend),
          Avaliacoes: k.aval, Frete_BH: "", Link: k.link,
        });
      }
      if (!kits.length) zeros.push(item.cat);
      console.log(`[${kits.length ? "OK" : " 0"}] ${item.cat}: ${kits.length} kits`);
    } catch (e) {
      zeros.push(item.cat + " (erro)");
      console.error(`[FALHA] ${item.cat}: ${(e.message || "").slice(0, 50)}`);
    } finally { await page.close(); }
  }
  await ctx.close();

  const CAB = ["Marketplace", "Data", "Categoria", "Kit", "Marca", "Preco", "Nota", "Vendidos_texto", "Vendidos_estimado", "Avaliacoes", "Frete_BH", "Link"];
  const csv = "﻿" + [CAB.join(";"), ...linhas.map(l => CAB.map(c => csvCell(l[c])).join(";"))].join("\r\n") + "\r\n";
  fs.writeFileSync(SAIDA, csv, "utf8");
  console.log(`\n=== ${linhas.length} kits do ML salvos em ML_Kits.csv ===`);
  if (zeros.length) console.log(`Familias sem kit/erro (${zeros.length}): ${zeros.join(", ")}`);
})();
