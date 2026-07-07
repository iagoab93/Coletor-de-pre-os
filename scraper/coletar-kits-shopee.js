// coletar-kits-shopee.js — coleta KITS na Shopee LOCALMENTE (custo ZERO de token).
// Usa o perfil com login salvo (rode shopee-login.bat UMA vez antes).
// Se a Shopee pedir captcha/login no meio, mostra um POPUP e espera voce resolver na janela.
// Saida: ../Shopee_Kits_Auto.csv (mesmo esquema do ML_Kits; o consolidar-kits prefere este arquivo).
const fs = require("fs"), path = require("path"), os = require("os");
const itens = require("./itens");
const MARCAS = itens.MARCAS;
const { popup } = require("./notificar-popup");

const PERFIL = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "avante-shopee-perfil");
const HOJE = new Date().toISOString().slice(0, 10);
const SAIDA = path.join(__dirname, "..", "Shopee_Kits_Auto.csv");
const MAX_FAM = process.env.MAX_FAM ? +process.env.MAX_FAM : itens.length;
const POR_FAMILIA = 8;

const detectarMarca = nome => (MARCAS.find(m => new RegExp("\\b" + m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(nome)) || "").trim();
const semAcento = s => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "");
const csvCell = v => { v = String(v ?? "").replace(/[\r\n]+/g, " ").trim(); if (/^[=+\-@\t]/.test(v)) v = "'" + v; return /[;"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
function estimarVendas(txt) {
  if (!txt) return "";
  const m = txt.match(/([\d.,]+)\s*(mil)?/i); if (!m) return "";
  let n = parseFloat(m[1].replace(/\./g, "").replace(",", ".")); if (isNaN(n)) return "";
  if (/mil/i.test(txt)) n *= 1000;
  return Math.round(n);
}

// A Shopee esta pedindo verificacao/login? (URL de verify/captcha/login, ou pagina sem produtos pedindo conta)
async function precisaHumano(page) {
  const url = page.url();
  if (/verify|captcha|verification|buyer\/login/i.test(url)) return true;
  try {
    return await page.evaluate(() => {
      const temCards = !!document.querySelector('a[href*="-i."]');
      if (temCards) return false;
      const t = (document.body?.innerText || "").slice(0, 1500).toLowerCase();
      return /verifica|captcha|rob[oô]|fa[çc]a login|entre na sua conta/.test(t);
    });
  } catch (e) { return false; }
}

async function extrairKitsShopee(page) {
  return page.evaluate(() => {
    const EH_KIT = /kit|leve\s*\d|\d\s*un(id)?|combo|c\/\s*\d|conjunto|pack/i;
    const seen = {}, out = [];
    document.querySelectorAll('a[href*="-i."]').forEach(a => {
      const card = a.closest("li") || a.closest("div[data-sqe]") || a;
      const href = (a.getAttribute("href") || "").split("?")[0];
      if (!href || seen[href]) return;
      const txt = (card.innerText || "").replace(/ /g, " ");
      if (/patrocinad|^\s*Ad\b/i.test(txt.slice(0, 60))) return; // anuncio
      const img = card.querySelector("img[alt]");
      let nome = ((img && img.alt) || "").trim();
      if (!nome) {
        const linhas = txt.split("\n").map(s => s.trim()).filter(l => l.length > 10 && !/^R\$/.test(l));
        nome = linhas[0] || "";
      }
      nome = nome.replace(/\s+/g, " ").slice(0, 110);
      if (!nome || nome.length < 8 || !EH_KIT.test(nome)) return;
      const precos = (txt.match(/R\$\s*[\d.]+(?:,\d{1,2})?/g) || [])
        .map(x => parseFloat(x.replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", ".")))
        .filter(n => n > 0);
      if (!precos.length) return;
      const vend = (txt.match(/[\d.,]+\s*(mil)?\s*\+?\s*vendidos?/i) || [])[0] || "";
      const nota = (txt.match(/\b([0-5][.,]\d)\b/) || [])[1] || "";
      seen[href] = 1;
      out.push({ nome, preco: Math.min(...precos), vend: vend.trim(), nota,
        link: "https://shopee.com.br" + href });
    });
    return out;
  });
}

async function rolar(page) { try { await page.evaluate(async () => { for (let i = 0; i < 6; i++) { window.scrollBy(0, 1600); await new Promise(r => setTimeout(r, 600)); } window.scrollTo(0, 0); }); } catch (e) {} }

(async () => {
  if (!fs.existsSync(PERFIL)) {
    console.log("[!] Perfil da Shopee ainda nao existe. Rode primeiro o shopee-login.bat e faca o login.");
    process.exit(1);
  }
  const { lancar } = require("./navegador");
  const ctx = await lancar({ perfil: PERFIL });
  const linhas = [], zeros = [];
  let abortar = false;
  for (const item of itens.slice(0, MAX_FAM)) {
    if (abortar) break;
    const page = await ctx.newPage();
    try {
      const url = `https://shopee.com.br/search?keyword=${encodeURIComponent("kit " + item.termo)}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForSelector('a[href*="-i."]', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1500);

      // Captcha/login? Avisa com POPUP e espera voce resolver na janela do Chrome.
      let tent = 0;
      while (await precisaHumano(page) && tent < 3) {
        tent++;
        console.log(`  [!] Shopee pedindo verificacao humana (tentativa ${tent}/3)...`);
        popup("Shopee precisa de voce",
          "A Shopee esta pedindo captcha ou login.\n\n1) Resolva na janela do Chrome que esta aberta.\n2) Depois clique OK aqui para a coleta continuar.");
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
        await page.waitForSelector('a[href*="-i."]', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1500);
      }
      if (await precisaHumano(page)) {
        console.log("  [X] Verificacao nao resolvida apos 3 avisos — parando a coleta (salvo o que ja coletei).");
        popup("Coleta Shopee interrompida", "Nao consegui passar da verificacao.\nO que ja foi coletado sera salvo.\nTente de novo mais tarde (o bloqueio costuma soltar).", 15);
        abortar = true; await page.close(); break;
      }

      await rolar(page);
      await page.waitForTimeout(1000);
      const kits = (await extrairKitsShopee(page)).slice(0, POR_FAMILIA);
      for (const k of kits) {
        linhas.push({
          Marketplace: "Shopee", Data: HOJE, Categoria: semAcento(item.cat),
          Kit: semAcento(k.nome), Marca: semAcento(detectarMarca(k.nome)),
          Preco: String(k.preco.toFixed(2)).replace(".", ","), Nota: k.nota.replace(".", ","),
          Vendidos_texto: semAcento(k.vend), Vendidos_estimado: estimarVendas(k.vend),
          Avaliacoes: "", Frete_BH: "", Link: k.link,
        });
      }
      if (!kits.length) zeros.push(item.cat);
      console.log(`[${kits.length ? "OK" : " 0"}] ${item.cat}: ${kits.length} kits`);
    } catch (e) {
      zeros.push(item.cat + " (erro)");
      console.error(`[FALHA] ${item.cat}: ${(e.message || "").slice(0, 50)}`);
    } finally { try { await page.close(); } catch (e) {} }
  }
  await ctx.close();

  if (!linhas.length) {
    console.log("\nNada coletado — NAO sobrescrevi o Shopee_Kits_Auto.csv anterior (se existir).");
    process.exit(abortar ? 1 : 0);
  }
  const CAB = ["Marketplace", "Data", "Categoria", "Kit", "Marca", "Preco", "Nota", "Vendidos_texto", "Vendidos_estimado", "Avaliacoes", "Frete_BH", "Link"];
  const csv = "﻿" + [CAB.join(";"), ...linhas.map(l => CAB.map(c => csvCell(l[c])).join(";"))].join("\r\n") + "\r\n";
  fs.writeFileSync(SAIDA, csv, "utf8");
  console.log(`\n=== ${linhas.length} kits da Shopee salvos em Shopee_Kits_Auto.csv ===`);
  if (zeros.length) console.log(`Familias sem kit/erro (${zeros.length}): ${zeros.join(", ")}`);
})();
