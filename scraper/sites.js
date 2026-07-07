// Adaptadores por site — versão robusta (scroll p/ lazy-load + extratores validados).
// Regra de preço: numa card, MAIOR valor = regular, MENOR = promo (ignora parcelas).

function extratorGenerico(sel) {
  return async (page) => page.evaluate((sel) => {
    const limpar = t => t
      .replace(/\d+\s*x\s*(de\s*)?R\$\s*[\d.,]+/gi, " ")
      .replace(/em at[eé][^R]*R\$\s*[\d.,]+/gi, " ")
      .replace(/R\$\s*[\d.,]+\s*\/\s*(l|kg|ml|g|un)/gi, " ");
    const seen = {}, res = [];
    document.querySelectorAll(sel).forEach(a => {
      const raw = (a.innerText || "");
      if (/patrocinado|anúncio|\bad\b/i.test(raw)) return;
      const link = (a.href || "").split("?")[0];
      const linhas = raw.split("\n").map(s => s.trim()).filter(Boolean);
      let nome = (linhas.find(l => l.length > 5 && /[a-zà-ÿ]/i.test(l) && !/^r\$/i.test(l) && !/^-?\d+%/.test(l)) || linhas[0] || "");
      nome = nome.replace(/[\r\n;]+/g, " ").trim().slice(0, 90);
      if (!nome || nome.length < 6 || seen[link]) return;
      let el = a, txt = "";
      for (let i = 0; i < 6 && el; i++) { el = el.parentElement; if (el && /R\$/.test(el.innerText || "")) { txt = el.innerText; break; } }
      if (!txt) return;
      const precos = (limpar(txt).match(/R\$\s*\d[\d.]*,\d{2}/g) || [])
        .map(x => parseFloat(x.replace(/[^\d,]/g, "").replace(".", "").replace(",", ".")))
        .filter(n => n > 0);
      if (!precos.length) return;
      seen[link] = 1;
      const reg = Math.max(...precos), promo = precos.length > 1 ? Math.min(...precos) : "";
      res.push({ descricao: nome, preco_regular: reg, preco_promo: promo === reg ? "" : promo, link, formato: /kit|leve\s*\d|\d\s*un|combo/i.test(nome) ? "Kit Nun" : "Unidade" });
    });
    return res.slice(0, 15);
  }, sel);
}

// Mercado Livre — poly-card (validado 02/07). Mira preço atual x riscado, ignora parcela.
async function extratorML(page) {
  return page.evaluate(() => {
    function amt(el){ if(!el) return null; let f=el.querySelector(".andes-money-amount__fraction"); if(!f) return null; let c=el.querySelector(".andes-money-amount__cents"); let n=parseInt((f.innerText||"").replace(/\D/g,"")); if(!n) return null; return n+(c?parseInt(c.innerText.replace(/\D/g,""))/100:0); }
    let out=[], seen={};
    document.querySelectorAll("li.ui-search-layout__item, .poly-card").forEach(li=>{
      let a=li.querySelector("a.poly-component__title")||li.querySelector(".poly-component__title a")||li.querySelector('a[href*="/MLB"]');
      if(!a) return;
      let link=(a.href||"").split("#")[0].split("?")[0];
      if(/click1|mclics/.test(link)||seen[link]) return;
      let nome=(a.innerText||a.getAttribute("title")||"").trim().split("\n")[0].slice(0,90);
      if(!nome||nome.length<6) return;
      let prevEl=li.querySelector(".andes-money-amount--previous");
      let curEl=li.querySelector(".andes-money-amount.poly-price__amount:not(.andes-money-amount--previous)")||li.querySelector(".poly-price__current .andes-money-amount:not(.andes-money-amount--previous)");
      let cur=amt(curEl), prev=amt(prevEl), reg, promo="";
      if(prev&&cur&&prev>cur){ reg=prev; promo=cur; } else { reg=cur||prev; if(!reg) return; }
      let vend=(li.querySelector(".poly-component__seller")||{}).innerText||"";
      seen[link]=1;
      out.push({ descricao:nome, preco_regular:reg, preco_promo:promo, link, vendido_por:vend.replace(/por\s*/i,"").trim(), formato:/kit|leve\s*\d|\d\s*un(id)?|combo|conjunto/i.test(nome)?"Kit Nun":"Unidade" });
    });
    return out.slice(0,15);
  });
}

// Lojas Rede — VTEX, nome vem do slug do link (o card só mostra "AVANTE"). Validado 02/07.
async function extratorLojasRede(page) {
  return page.evaluate(() => {
    function priceIn(el){ return ((el.innerText||"").match(/R\$\s*\d[\d.]*,\d{2}/g)||[]).map(x=>parseFloat(x.replace(/[^\d,]/g,"").replace(/\./g,"").replace(",","."))).filter(n=>n>0); }
    let seen={}, out=[];
    document.querySelectorAll('a[href$="/p"]').forEach(a=>{
      let link=(a.href||"").split("?")[0];
      if(seen[link]||/institucional/.test(link)) return;
      let s=link.split("/").filter(Boolean); s=s[s.length-2]||"";
      let nome=s.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase()).slice(0,90);
      if(nome.length<5) return;
      let card=a; for(let i=0;i<6&&card;i++){ card=card.parentElement; if(card&&/R\$/.test(card.innerText||"")) break; }
      if(!card) return;
      let nums=priceIn(card); if(!nums.length) return;
      seen[link]=1;
      let reg=Math.max(...nums), promo=nums.length>1?Math.min(...nums):"";
      out.push({ descricao:nome, preco_regular:reg, preco_promo:promo===reg?"":promo, link, formato:/kit|\d\s*un|combo/i.test(nome)?"Kit Nun":"Unidade" });
    });
    return out.slice(0,15);
  });
}

// Amazon — cards de resultado, ignora patrocinado, preço em .a-offscreen.
async function extratorAmazon(page) {
  return page.evaluate(() => {
    let out=[], seen={};
    document.querySelectorAll('div[data-component-type="s-search-result"]').forEach(d=>{
      if(d.querySelector(".puis-sponsored-label-text")||/patrocinad|sponsored/i.test((d.innerText||"").slice(0,40))) return;
      let a=d.querySelector("h2 a")||d.querySelector("a.a-link-normal[href*='/dp/']");
      if(!a) return;
      let link=(a.href||"").split("?")[0];
      let h2=d.querySelector("h2");
      let nome=((h2&&h2.innerText)||a.innerText||"").trim().slice(0,90);
      if(!nome||nome.length<6||seen[link]) return;
      let offs=[...d.querySelectorAll(".a-price .a-offscreen")].map(e=>parseFloat((e.innerText||"").replace(/[^\d,]/g,"").replace(/\./g,"").replace(",","."))).filter(n=>n>0);
      if(!offs.length) return;
      seen[link]=1;
      let reg=Math.max(...offs), promo=offs.length>1?Math.min(...offs):"";
      out.push({ descricao:nome, preco_regular:reg, preco_promo:promo===reg?"":promo, link, formato:/kit|\d\s*un|combo/i.test(nome)?"Kit Nun":"Unidade" });
    });
    return out.slice(0,15);
  });
}

// Super Sô — busca por JS (caixa de busca). Extrai linhas "De R$ X por R$ Y".
async function buscaSuperSo(page, termo) {
  try {
    const cx = await page.$('input[type="search"], input[name*="busca" i], input[placeholder*="usc" i], input[type="text"]');
    if (cx) { await cx.click(); await cx.fill(termo); await cx.press("Enter"); await page.waitForTimeout(3500); }
  } catch (e) {}
}
async function extratorSuperSo(page) {
  return page.evaluate(() => {
    const linhas = document.body.innerText.split("\n").map(s => s.trim()).filter(Boolean);
    const res = [], seen = {};
    for (let i = 0; i < linhas.length; i++) {
      const m = linhas[i].match(/De R\$\s*([\d.,]+)\s*por R\$\s*([\d.,]+)/) || linhas[i].match(/R\$\s*([\d.,]+)\s*un/);
      if (!m) continue;
      let nome = "";
      for (let j = i - 1; j >= 0 && j >= i - 4; j--) { const l = linhas[j]; if (/economize|adicionar/i.test(l) || /^\d+$/.test(l) || l.length < 5) continue; nome = l; break; }
      if (!nome || seen[nome]) continue; seen[nome] = 1;
      const reg = parseFloat((m[2] ? m[1] : m[1]).replace(".", "").replace(",", "."));
      const promo = m[2] ? parseFloat(m[2].replace(".", "").replace(",", ".")) : "";
      res.push({ descricao: nome, preco_regular: reg, preco_promo: (promo && promo < reg) ? promo : "", link: location.href, formato: /kit|\d\s*un|combo/i.test(nome) ? "Kit Nun" : "Unidade" });
    }
    return res.slice(0, 15);
  });
}

// Big Mais (Angular SPA) — Super ABC, Rex Delivery, Rena em Casa (supermercados MG). URL /p/busca/<termo>.
// Nome = alt da imagem; preco atual em .produto-preco-por; .produto-preco-de ("De R$ X por") = preco cheio riscado.
// IGNORA .preco-unitario (preco por quilo/litro). Sem CEP. Cards duplicam (desktop+mobile) -> dedup por nome.
async function extratorBigMais(page) {
  return page.evaluate(() => {
    const num = s => { const v = parseFloat(String(s).replace(/[^\d,]/g, "").replace(",", ".")); return isNaN(v) ? null : v; };
    const seen = {}, out = [];
    document.querySelectorAll("app-produtos-produto, app-produtos-produto-bigmais").forEach(c => {
      const img = c.querySelector("img.produto-imagem, img[alt]");
      const nome = ((img && img.getAttribute("alt")) || "").replace(/\s+/g, " ").trim().slice(0, 90);
      if (!nome || nome.length < 6 || seen[nome]) return;
      const deEl = c.querySelector(".produto-preco-de");     // preco cheio (riscado), quando em oferta
      const porEl = c.querySelector(".produto-preco-por");   // preco atual
      const por = porEl ? num(porEl.textContent) : null;
      const de = deEl ? num(deEl.textContent) : null;
      if (por == null && de == null) return;
      let reg, promo = "";
      if (de != null && por != null && por < de) { reg = de; promo = por; } else { reg = por != null ? por : de; }
      if (reg == null) return;
      seen[nome] = 1;
      out.push({ descricao: nome, preco_regular: reg, preco_promo: promo, link: location.href,
        formato: /kit|leve\s*\d|\d\s*un(id)?|combo|c\/\s*\d/i.test(nome) ? "Kit Nun" : "Unidade" });
    });
    return out.slice(0, 15);
  });
}

const slug = t => t.trim().replace(/\s+/g, "-");

function extratorSlug(seletorAncora) {
  return async (page) => page.evaluate((sel) => {
    const limpar = t => t
      .replace(/\d+\s*x\s*(de\s*)?R\$\s*[\d.,]+/gi, " ")
      .replace(/em at[eé][^R]*R\$\s*[\d.,]+/gi, " ")
      .replace(/R\$\s*[\d.,]+\s*\/\s*(l|kg|ml|g|un)/gi, " ");
    function nomeDoSlug(href) {
      let segs = (href || "").split("?")[0].split("/").filter(Boolean);
      let cand = segs.filter(x => /[a-zà-ÿ]/i.test(x) && x.includes("-") && !/^https?:$/.test(x) && x !== "p").map(x => x.replace(/\.html$/, ""));
      cand.sort((a, b) => b.split("-").length - a.split("-").length);
      return (cand[0] || "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim().slice(0, 90);
    }
    const seen = {}, res = [];
    document.querySelectorAll(sel).forEach(a => {
      if (/patrocinado|anúncio/i.test(a.innerText || "")) return;
      const link = (a.href || "").split("?")[0];
      const nome = nomeDoSlug(a.href || "");
      if (!nome || nome.length < 6 || seen[link]) return;
      let el = a, txt = "";
      for (let i = 0; i < 7 && el; i++) { el = el.parentElement; if (el && /R\$/.test(el.innerText || "")) { txt = el.innerText; break; } }
      if (!txt) return;
      const precos = (limpar(txt).match(/R\$\s*\d[\d.]*,\d{2}/g) || [])
        .map(x => parseFloat(x.replace(/[^\d,]/g, "").replace(".", "").replace(",", ".")))
        .filter(n => n > 0);
      if (!precos.length) return;
      seen[link] = 1;
      const reg = Math.max(...precos), promo = precos.length > 1 ? Math.min(...precos) : "";
      res.push({ descricao: nome, preco_regular: reg, preco_promo: promo === reg ? "" : promo, link, formato: /kit|leve\s*\d|\d\s*un|combo/i.test(nome) ? "Kit Nun" : "Unidade" });
    });
    return res.slice(0, 15);
  }, seletorAncora);
}

module.exports = [
  { nome: "Araújo",       canal: "Farmácia",    espera: 4000, scroll: true, url: t => `https://www.araujo.com.br/busca?q=${encodeURIComponent(t)}`, extrair: extratorSlug('a[href$=".html"]') },
  { nome: "Drogasil",     canal: "Farmácia",    espera: 4000, scroll: true, url: t => `https://www.drogasil.com.br/search?w=${encodeURIComponent(t)}`, extrair: extratorSlug('a[href*=".html"]') },
  { nome: "Pague Menos",  canal: "Farmácia",    espera: 3500, scroll: true, url: t => `https://www.paguemenos.com.br/${encodeURIComponent(t)}?_q=${encodeURIComponent(t)}&map=ft`, extrair: extratorSlug('a[href*="/p"]') },
  { nome: "Panvel",       canal: "Farmácia",    espera: 3500, scroll: true, url: t => `https://www.panvel.com/panvel/buscarProduto.do?termoPesquisa=${encodeURIComponent(t)}`, extrair: extratorSlug('a[href*="/p-"]') },
  { nome: "Carrefour",    canal: "Supermercado", espera: 3500, scroll: true, url: t => `https://www.carrefour.com.br/busca/${encodeURIComponent(t)}`, extrair: extratorSlug('a[href*="/p"]') },
  { nome: "Super Sô",     canal: "Supermercado", espera: 3500, scroll: true, filtroRelevancia: true, url: () => `https://www.superso.com.br/`, prepararBusca: buscaSuperSo, extrair: extratorSuperSo },
  { nome: "Lojas Rede",   canal: "Beleza",      espera: 4000, scroll: true, url: t => `https://www.lojasrede.com.br/${encodeURIComponent(t)}?_q=${encodeURIComponent(t)}&map=ft`, extrair: extratorLojasRede },
  // seletorPronto = espera INTELIGENTE: segue assim que os cards aparecem (em vez de espera fixa).
  { nome: "Mercado Livre", canal: "Marketplace", espera: 3500, scroll: true, seletorPronto: ".poly-card", url: t => `https://lista.mercadolivre.com.br/${slug(t)}`, extrair: extratorML },
  { nome: "Amazon",       canal: "Marketplace", espera: 3500, scroll: true, seletorPronto: 'div[data-component-type="s-search-result"]', url: t => `https://www.amazon.com.br/s?k=${encodeURIComponent(t)}`, extrair: extratorAmazon },
  // Supermercados MG na plataforma Big Mais (Angular). Sem CEP; ABC e Rex tambem vendem Avante.
  // filtroRelevancia: a busca deles casa qualquer palavra do termo -> filtra fora-da-familia (lib-relevancia).
  { nome: "Super ABC",    canal: "Supermercado", espera: 4500, scroll: true, filtroRelevancia: true, seletorPronto: "app-produtos-produto, app-produtos-produto-bigmais", url: t => `https://superabconline.com.br/p/busca/${encodeURIComponent(t)}`, extrair: extratorBigMais },
  { nome: "Rex Delivery", canal: "Supermercado", espera: 4500, scroll: true, filtroRelevancia: true, seletorPronto: "app-produtos-produto, app-produtos-produto-bigmais", url: t => `https://loja.rexdelivery.com.br/p/busca/${encodeURIComponent(t)}`, extrair: extratorBigMais },
  { nome: "Rena em Casa", canal: "Supermercado", espera: 4500, scroll: true, filtroRelevancia: true, seletorPronto: "app-produtos-produto, app-produtos-produto-bigmais", url: t => `https://www.renaemcasa.com.br/p/busca/${encodeURIComponent(t)}`, extrair: extratorBigMais }
];
