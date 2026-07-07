// lib-alertas.js — logica UNICA de precos/alertas, compartilhada por gerar-alertas.js e resumo-semanal.js.
// (Antes estava so no gerar-alertas; extrai pra nao divergir entre alerta e resumo.)
const MARCAS = require("./itens.js").MARCAS;

// "15,99" / "1.234,56" -> numero. "" -> null
const num = s => {
  s = String(s ?? "").trim().replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", ".");
  const v = parseFloat(s);
  return isNaN(v) ? null : v;
};
const brl = v => v == null ? "" : v.toFixed(2).replace(".", ",");
const temPromo = r => String(r["Preço promo"]).trim() !== "" && num(r["Preço promo"]) != null;
const precoEfetivo = r => { const p = num(r["Preço promo"]), g = num(r["Preço regular"]); return p != null ? p : g; };
const isAvante = r => /avante/i.test(r.Marca) || /avante/i.test(r["Descrição"]);
// Comparar so UNIDADE x UNIDADE: Formato=Unidade e descricao sem "kit" (kits distorcem o preco unitario).
const ehUnidade = r => (r.Formato || "Unidade") === "Unidade" && !/\bkit\b/i.test(r["Descrição"]);
const semAcento = s => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "");

// Marca "boa" p/ exibir: coluna Marca se conhecida; senao tenta na descricao; senao vazio.
function marcaExibir(r) {
  const known = MARCAS.map(m => semAcento(m).toLowerCase());
  const mCol = semAcento(r.Marca).toLowerCase();
  if (known.includes(mCol)) return r.Marca;
  const desc = semAcento(r["Descrição"]).toLowerCase();
  for (const m of MARCAS) if (desc.includes(semAcento(m).toLowerCase())) return m;
  return "";
}

// Mantem so a coleta MAIS RECENTE de cada loja (evita comparar precos de datas diferentes).
function filtrarUltimaColetaPorSite(dados) {
  const maxData = {};
  for (const r of dados) if (!maxData[r.Site] || r.Data_coleta > maxData[r.Site]) maxData[r.Site] = r.Data_coleta;
  return dados.filter(r => r.Data_coleta === maxData[r.Site]);
}

// Alerta principal: nas lojas onde a Avante vende, concorrente EM PROMOCAO e mais barato
// que a Avante na mesma categoria+tamanho (unidade x unidade). Retorna array ordenado por % desc.
function calcularAlertas(dados) {
  const sitesAvante = [...new Set(dados.filter(isAvante).map(r => r.Site))];
  const alertas = [];
  for (const site of sitesAvante) {
    const rows = dados.filter(r => r.Site === site);
    const slots = {};
    for (const r of rows.filter(r => isAvante(r) && ehUnidade(r))) {
      if (precoEfetivo(r) == null) continue;
      (slots[[r.Categoria, r.Tamanho].join("|")] ||= []).push(r);
    }
    for (const k of Object.keys(slots)) {
      const grupo = slots[k];
      const linhaMin = grupo.reduce((m, r) => precoEfetivo(r) < precoEfetivo(m) ? r : m, grupo[0]);
      const meu = precoEfetivo(linhaMin);
      const categoria = grupo[0].Categoria, tamanho = grupo[0].Tamanho;
      const conc = rows.filter(r =>
        !isAvante(r) && ehUnidade(r) &&
        r.Categoria === categoria &&
        (tamanho ? r.Tamanho === tamanho : true) &&
        temPromo(r) && precoEfetivo(r) != null && precoEfetivo(r) < meu
      );
      if (!conc.length) continue;
      conc.sort((x, y) => precoEfetivo(x) - precoEfetivo(y));
      const c = conc[0];
      const dif = +(meu - precoEfetivo(c)).toFixed(2);
      alertas.push({
        site, categoria, tamanho,
        avante_desc: linhaMin["Descrição"], avante_preco: meu,
        avante_regular: num(linhaMin["Preço regular"]), avante_emPromo: temPromo(linhaMin),
        avante_skus: new Set(grupo.map(r => r["Descrição"])).size,
        conc_marca: marcaExibir(c), conc_desc: c["Descrição"],
        conc_regular: num(c["Preço regular"]), conc_promo: num(c["Preço promo"]),
        conc_preco: precoEfetivo(c),
        diferenca: dif, pct: Math.round((dif / meu) * 100),
        conc_link: c.Link || "", data: c.Data_coleta || linhaMin.Data_coleta || "",
        n_concorrentes_promo: new Set(conc.map(x => x["Descrição"])).size
      });
    }
  }
  alertas.sort((a, b) => b.pct - a.pct || b.diferenca - a.diferenca);
  return alertas;
}

module.exports = {
  num, brl, temPromo, precoEfetivo, isAvante, ehUnidade, semAcento, marcaExibir,
  filtrarUltimaColetaPorSite, calcularAlertas,
};
