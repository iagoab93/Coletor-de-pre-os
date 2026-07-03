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

const slug = t => t.trim().replace(/\s+/g, "-");

module.exports = [
  { nome: "Araújo",       canal: "Farmácia",    espera: 4000, scroll: true, url: t => `https://www.araujo.com.br/busca?q=${encodeURIComponent(t)}`, extrair: extratorGenerico('a[href$=".html"]') },
  { nome: "Drogasil",     canal: "Farmácia",    espera: 4000, scroll: true, url: t => `https://www.drogasil.com.br/search?w=${encodeURIComponent(t)}`, extrair: extratorGenerico('a[href*=".html"]') },
  { nome: "Pague Menos",  canal: "Farmácia",    espera: 3500, scroll: true, url: t => `https://www.paguemenos.com.br/${encodeURIComponent(t)}?_q=${encodeURIComponent(t)}&map=ft`, extrair: extratorGenerico('a[href*="/p"]') },
  { nome: "Panvel",       canal: "Farmácia",    espera: 3500, scroll: true, url: t => `https://www.panvel.com/panvel/buscarProduto.do?termoPesquisa=${encodeURIComponent(t)}`, extrair: extratorGenerico('a[href*="/p-"]') },
  { nome: "Carrefour",    canal: "Supermercado", espera: 3500, scroll: true, url: t => `https://www.carrefour.com.br/busca/${encodeURIComponent(t)}`, extrair: extratorGenerico('a[href*="/p"]') },
  { nome: "Super Sô",     canal: "Supermercado", espera: 3500, scroll: true, url: () => `https://www.superso.com.br/`, prepararBusca: buscaSuperSo, extrair: extratorSuperSo },
  { nome: "Lojas Rede",   canal: "Beleza",      espera: 4000, scroll: true, url: t => `https://www.lojasrede.com.br/${encodeURIComponent(t)}?_q=${encodeURIComponent(t)}&map=ft`, extrair: extratorLojasRede },
  { nome: "Mercado Livre", canal: "Marketplace", espera: 3500, scroll: true, url: t => `https://lista.mercadolivre.com.br/${slug(t)}`, extrair: extratorML },
  { nome: "Amazon",       canal: "Marketplace", espera: 3500, scroll: true, url: t => `https://www.amazon.com.br/s?k=${encodeURIComponent(t)}`, extrair: extratorAmazon }
];
