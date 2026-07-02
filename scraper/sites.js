// Adaptadores por site. Cada um diz: canal, como montar a URL de busca, e como extrair.
// Regra de preço universal: numa mesma card, o MAIOR valor = regular, o MENOR = promo.
// (funciona pra de/por, Pix, etc.). Instalação/parsing pode precisar de ajuste fino se um site mudar.

// Extrator genérico: pega âncoras de produto, sobe no DOM até achar preço, limpa parcelas.
function extratorGenerico(seletorAncora) {
  return async (page) => page.evaluate((sel) => {
    const limpar = t => t
      .replace(/\d+\s*x\s*(de\s*)?R\$\s*[\d.,]+/gi, " ")      // parcelas "12x de R$ 1,19"
      .replace(/em at[eé][^R]*R\$\s*[\d.,]+/gi, " ")           // "em até 5x..."
      .replace(/R\$\s*[\d.,]+\s*\/\s*(l|kg|ml|g|milímetro|mililitro|unidade|un)/gi, " "); // preço por unidade
    const seen = {}, res = [];
    document.querySelectorAll(sel).forEach(a => {
      const raw = (a.innerText || "");
      if (/patrocinado/i.test(raw)) return;                       // ignora anúncio
      const link = (a.href || "").split("?")[0];
      const linhas = raw.split("\n").map(s => s.trim()).filter(Boolean);
      let nome = (linhas.find(l => l.length > 5 && /[a-zà-ÿ]/i.test(l) && !/^r\$/i.test(l) && !/^-?\d+%/.test(l)) || linhas[0] || "");
      nome = nome.replace(/[\r\n;]+/g, " ").trim().slice(0, 90);   // só a 1a linha, sem ; nem quebra
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
      res.push({ descricao: nome, preco_regular: reg, preco_promo: promo === reg ? "" : promo, link });
    });
    return res.slice(0, 15);
  }, seletorAncora);
}

module.exports = [
  { nome: "Araújo", canal: "Farmácia", espera: 5000,
    url: t => `https://www.araujo.com.br/busca?q=${encodeURIComponent(t)}`,
    extrair: extratorGenerico('a[href$=".html"]') },

  { nome: "Drogasil", canal: "Farmácia", espera: 5000,
    url: t => `https://www.drogasil.com.br/search?w=${encodeURIComponent(t)}`,
    extrair: extratorGenerico('a[href*=".html"]') },

  { nome: "Pague Menos", canal: "Farmácia",
    url: t => `https://www.paguemenos.com.br/${encodeURIComponent(t)}?_q=${encodeURIComponent(t)}&map=ft`,
    extrair: extratorGenerico('a[href*="/p"]') },

  { nome: "Panvel", canal: "Farmácia",
    url: t => `https://www.panvel.com/panvel/buscarProduto.do?termoPesquisa=${encodeURIComponent(t)}`,
    extrair: extratorGenerico('a[href*="/p-"]') },

  { nome: "Carrefour", canal: "Supermercado",
    url: t => `https://www.carrefour.com.br/busca/${encodeURIComponent(t)}`,
    extrair: extratorGenerico('a[href*="/p"]') },

  // Super Sô: busca por JS (caixa de busca). Extrai por linhas: acha "De R$ X por R$ Y" e pega o nome na linha acima.
  { nome: "Super Sô", canal: "Supermercado", espera: 3500,
    url: () => `https://www.superso.com.br/`,
    prepararBusca: async (page, termo) => {
      try {
        const cx = await page.$('input[type="search"], input[name*="busca" i], input[placeholder*="usc" i], input[type="text"]');
        if (cx) { await cx.click(); await cx.fill(termo); await cx.press("Enter"); await page.waitForTimeout(3500); }
      } catch (e) {}
    },
    extrair: async (page) => page.evaluate(() => {
      const linhas = document.body.innerText.split("\n").map(s => s.trim()).filter(Boolean);
      const res = [], seen = {};
      for (let i = 0; i < linhas.length; i++) {
        const m = linhas[i].match(/De R\$\s*([\d.,]+)\s*por R\$\s*([\d.,]+)/);
        if (!m) continue;
        let nome = "";
        for (let j = i - 1; j >= 0 && j >= i - 4; j--) {
          const l = linhas[j];
          if (/economize/i.test(l) || /^\d+$/.test(l) || /adicionar/i.test(l) || l.length < 5) continue;
          nome = l; break;
        }
        if (!nome || seen[nome]) continue; seen[nome] = 1;
        const reg = parseFloat(m[1].replace(".", "").replace(",", "."));
        const promo = parseFloat(m[2].replace(".", "").replace(",", "."));
        res.push({ descricao: nome, preco_regular: reg, preco_promo: promo < reg ? promo : "", link: location.href });
      }
      return res.slice(0, 15);
    }) }

  // OBS: Mercado Livre / Amazon / Magazine Luiza / Americanas costumam BLOQUEAR IP de
  // datacenter (GitHub Actions) com captcha. Para esses, mantenha a coleta via Claude Code,
  // ou use um proxy residencial. Não incluídos aqui para não quebrar o Action.
];
