// COLETA AMPLIADA (experimental). Reaproveita os sites que já funcionam (sites.js)
// e ACRESCENTA candidatos novos. Arquivo separado de propósito: se quebrar, o
// coletar-precos.bat (sites.js) continua intacto.
// OBS: rodando LOCAL com navegador real (navegador.js), todo site ganha o "pulo do gato".
// O que pode falhar num site novo é o ADAPTADOR (URL de busca / seletor). Rode e veja no
// "ultimo-resumo-ampliada.txt" quais voltaram 0 -> esses precisam de ajuste fino de URL/seletor.

const base = require("./sites"); // Araújo, Drogasil, Pague Menos, Panvel, Carrefour, Super Sô, Lojas Rede, ML, Amazon

// mesmo extrator por slug do sites.js (nome completo + tamanho vêm do link do produto)
function extratorSlug(seletorAncora) {
  return async (page) => page.evaluate((sel) => {
    const limpar = t => t.replace(/\d+\s*x\s*(de\s*)?R\$\s*[\d.,]+/gi, " ").replace(/em at[eé][^R]*R\$\s*[\d.,]+/gi, " ").replace(/R\$\s*[\d.,]+\s*\/\s*(l|kg|ml|g|un)/gi, " ");
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
      const precos = (limpar(txt).match(/R\$\s*\d[\d.]*,\d{2}/g) || []).map(x => parseFloat(x.replace(/[^\d,]/g, "").replace(".", "").replace(",", "."))).filter(n => n > 0);
      if (!precos.length) return;
      seen[link] = 1;
      const reg = Math.max(...precos), promo = precos.length > 1 ? Math.min(...precos) : "";
      res.push({ descricao: nome, preco_regular: reg, preco_promo: promo === reg ? "" : promo, link, formato: /kit|leve\s*\d|\d\s*un|combo/i.test(nome) ? "Kit Nun" : "Unidade" });
    });
    return res.slice(0, 15);
  }, seletorAncora);
}
const vtex = t => `?_q=${encodeURIComponent(t)}&map=ft`; // busca fulltext padrão VTEX

// === NOVOS CANDIDATOS (adaptadores a validar rodando) ===
const novos = [
  // === CONFIRMADOS (testados ao vivo 2026-07, entregam preço) ===
  { nome: "Droga Raia",        canal: "Farmácia", espera: 5000, scroll: true, url: t => `https://www.drogaraia.com.br/search?w=${encodeURIComponent(t)}`, extrair: extratorSlug('a[href*=".html"]') },
  { nome: "Drogaria São Paulo",canal: "Farmácia", espera: 5000, scroll: true, url: t => `https://www.drogariasaopaulo.com.br/search?w=${encodeURIComponent(t)}`, extrair: extratorSlug('a[href*="/p"]') },
  { nome: "Consulta Remédios", canal: "Farmácia", espera: 5000, scroll: true, url: t => `https://consultaremedios.com.br/busca?termo=${encodeURIComponent(t)}`, extrair: extratorSlug('a[href*="/p"]') },
  { nome: "Shopping dos Cosméticos", canal: "Beleza", espera: 5000, scroll: true, url: t => `https://www.shoppingdoscosmeticos.com.br/${encodeURIComponent(t)}?_q=${encodeURIComponent(t)}&map=ft`, extrair: extratorSlug('a[href*="/p"]') },
  { nome: "Beleza na Web",     canal: "Beleza", espera: 5000, scroll: true, url: t => `https://www.belezanaweb.com.br/${encodeURIComponent(t)}?_q=${encodeURIComponent(t)}&map=ft`, extrair: extratorSlug('a[href*="/p"]') }
];

// REMOVIDOS nos testes (não entregam preço out-of-the-box):
//  - Supermercados (Super Nosso, Supermercados BH, Verdemar, Apoio, Pão de Açúcar, Super Muffato,
//    Grupo Mateus, Comper, Angeloni): ESCONDEM preço atrás de CEP/entrega -> precisam de fluxo de CEP (futuro).
//  - Mercado da Beleza: URL de busca diferente (cai em "sem resultados").
//  - Época Cosméticos: SPA não renderiza preço com essa URL.
//  - Farmácia Indiana: "Access Denied" (bloqueio agressivo).

module.exports = [...base, ...novos];
