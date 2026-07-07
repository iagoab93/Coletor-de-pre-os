// gerar-analises.js — ANALISES GERENCIAIS (roda SEPARADO da coleta, local, custo zero de token).
// Le data/precos.json + data/historico/ + Kits_Consolidado.csv e gera Coletas/analises.html com:
//  1 Indice de competitividade  2 Dispersao Avante entre lojas  3 Comportamento promocional
//  4 Radar de ruptura           5 Analise completa de kits      6 Marcas novas
//  7 Curva de preco (ativa sozinha quando houver ~6 coletas / 3 semanas de historico)
const fs = require("fs"), path = require("path");
const lib = require("./lib-alertas");
const { num, brl, temPromo, precoEfetivo, isAvante, ehUnidade, semAcento, marcaExibir } = lib;
const MARCAS = require("./itens.js").MARCAS;

const RAIZ = path.join(__dirname, "..");
const DATA = path.join(RAIZ, "data");
const HIST = path.join(DATA, "historico");
const RAIZ_PROJ = path.join(RAIZ, "..");
const SAIDAS = path.join(RAIZ_PROJ, "Coletas");
fs.mkdirSync(SAIDAS, { recursive: true });

// ---------- carga ----------
const dadosAll = JSON.parse(fs.readFileSync(path.join(DATA, "precos.json"), "utf8"));
const atual = lib.filtrarUltimaColetaPorSite(dadosAll);

// snapshots: bootstrap (mesma logica do resumo-semanal) + leitura
fs.mkdirSync(HIST, { recursive: true });
for (const d of [...new Set(dadosAll.map(r => r.Data_coleta).filter(Boolean))]) {
  const f = path.join(HIST, `coleta-${d}.json`);
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(dadosAll.filter(r => r.Data_coleta === d)));
}
const snaps = fs.readdirSync(HIST).filter(f => /^coleta-.*\.json$/.test(f)).sort()
  .map(f => ({ data: f.replace(/^coleta-/, "").replace(/\.json$/, ""), rows: JSON.parse(fs.readFileSync(path.join(HIST, f), "utf8")) }));

// ---------- helpers ----------
const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const pct1 = v => (v > 0 ? "+" : "") + v.toFixed(1).replace(".", ",") + "%";
const norm = s => semAcento(s).toLowerCase();
// regular "contaminado" (preco de pack): ignora quando regular > 4x promo
const descontoSano = r => { const reg = num(r["Preço regular"]), pro = num(r["Preço promo"]); return (reg != null && pro != null && pro < reg && reg <= pro * 4) ? 1 - pro / reg : null; };
const VARIANTES = ["rosa mosqueta", "erva doce", "oleo de banho", "coco", "argan", "amendoa", "macadamia", "algodao", "girassol", "ricino", "eucalipto", "cacau", "karite", "banana", "mentol", "lavanda", "camomila", "aloe", "ureia"];
const variante = d => VARIANTES.find(v => norm(d).includes(v)) || "";

// ===================== 1. INDICE DE COMPETITIVIDADE =====================
function calcIndice() {
  const sitesAv = [...new Set(atual.filter(isAvante).map(r => r.Site))];
  const linhas = [];
  for (const site of sitesAv) {
    const rows = atual.filter(r => r.Site === site && ehUnidade(r) && precoEfetivo(r) != null);
    const slots = {};
    for (const r of rows.filter(isAvante)) (slots[[r.Categoria, r.Tamanho].join("|")] ||= []).push(r);
    for (const k of Object.keys(slots)) {
      const [categoria, tamanho] = k.split("|");
      const meu = Math.min(...slots[k].map(precoEfetivo));
      // concorrentes dedup por descricao (fica o menor preco de cada)
      const mapa = {};
      rows.filter(r => !isAvante(r) && r.Categoria === categoria && (tamanho ? r.Tamanho === tamanho : true))
        .forEach(r => { const d = r["Descrição"]; const p = precoEfetivo(r); if (!(d in mapa) || p < mapa[d]) mapa[d] = p; });
      const concs = Object.values(mapa);
      if (!concs.length) continue;
      const minC = Math.min(...concs), medC = concs.reduce((a, b) => a + b, 0) / concs.length;
      linhas.push({ site, categoria, tamanho, meu, minC, medC, nConc: concs.length,
        idxMed: (meu / medC - 1) * 100, idxMin: (meu / minC - 1) * 100 });
    }
  }
  linhas.sort((a, b) => b.idxMed - a.idxMed);
  const porLoja = {};
  for (const l of linhas) {
    const o = (porLoja[l.site] ||= { n: 0, soma: 0, acima: 0, abaixo: 0 });
    o.n++; o.soma += l.idxMed; if (l.idxMed > 2) o.acima++; else if (l.idxMed < -2) o.abaixo++;
  }
  return { linhas, porLoja };
}

// ===================== 2. DISPERSAO ENTRE LOJAS =====================
function calcDispersao() {
  const grupos = {};
  for (const r of atual.filter(r => isAvante(r) && ehUnidade(r) && precoEfetivo(r) != null)) {
    const k = [r.Categoria, r.Tamanho, variante(r["Descrição"])].join("|");
    const g = (grupos[k] ||= {});
    const p = precoEfetivo(r);
    if (!(r.Site in g) || p < g[r.Site]) g[r.Site] = p;
  }
  const out = [];
  for (const k of Object.keys(grupos)) {
    const sites = Object.entries(grupos[k]);
    if (sites.length < 2) continue;
    const precos = sites.map(([, p]) => p);
    const min = Math.min(...precos), max = Math.max(...precos);
    const [categoria, tamanho, varr] = k.split("|");
    out.push({ categoria, tamanho, variante: varr, min, max, spread: (max - min) / min * 100,
      detalhe: sites.sort((a, b) => a[1] - b[1]).map(([s, p]) => `${s}: R$ ${brl(p)}`).join("  ·  ") });
  }
  out.sort((a, b) => b.spread - a.spread);
  return out;
}

// ===================== 3. COMPORTAMENTO PROMOCIONAL =====================
function calcPromo() {
  const conhecidas = new Set(MARCAS.map(m => norm(m)));
  const porMarca = {};
  for (const s of snaps) for (const r of s.rows) {
    if (!ehUnidade(r)) continue;
    const m = marcaExibir(r) || (conhecidas.has(norm(r.Marca)) ? r.Marca : "");
    if (!m) continue;
    const o = (porMarca[norm(m)] ||= { marca: m, n: 0, promo: 0, descontos: [], lojas: new Set(), fam: {} });
    o.n++;
    if (temPromo(r)) {
      o.promo++; o.lojas.add(r.Site);
      const d = descontoSano(r); if (d != null) o.descontos.push(d);
      o.fam[r.Categoria] = (o.fam[r.Categoria] || 0) + 1;
    }
  }
  return Object.values(porMarca).filter(o => o.n >= 5).map(o => ({
    marca: o.marca, n: o.n, pctPromo: o.promo / o.n * 100,
    descMedio: o.descontos.length ? o.descontos.reduce((a, b) => a + b, 0) / o.descontos.length * 100 : null,
    lojas: [...o.lojas].join(", "),
    topFam: Object.entries(o.fam).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f]) => f).join("; "),
  })).sort((a, b) => b.pctPromo - a.pctPromo).slice(0, 14);
}

// ===================== 4. RADAR DE RUPTURA =====================
function calcRuptura() {
  // por site: compara as 2 ultimas datas em que o site foi coletado (chave = descricao, estavel no mesmo site)
  const porSiteData = {};
  for (const s of snaps) for (const r of s.rows) {
    if (!isAvante(r)) continue;
    ((porSiteData[r.Site] ||= {})[s.data] ||= new Map()).set(r["Descrição"], precoEfetivo(r));
  }
  const sumiu = [], entrou = [];
  for (const site of Object.keys(porSiteData)) {
    const datas = Object.keys(porSiteData[site]).sort();
    if (datas.length < 2) continue;
    const [ant, ult] = [porSiteData[site][datas[datas.length - 2]], porSiteData[site][datas[datas.length - 1]]];
    for (const [desc, p] of ant) if (!ult.has(desc)) sumiu.push({ site, desc, preco: p, quando: datas[datas.length - 2] });
    for (const [desc, p] of ult) if (!ant.has(desc)) entrou.push({ site, desc, preco: p });
  }
  return { sumiu, entrou };
}

// ===================== 5. ANALISE DE KITS =====================
function parseLinhaCSV(line) { const o = []; let c = "", q = false;
  for (let i = 0; i < line.length; i++) { const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true; else if (ch === ';') { o.push(c); c = ""; } else c += ch; }
  o.push(c); return o; }
function calcKits() {
  const f = path.join(RAIZ_PROJ, "Kits_Consolidado.csv");
  if (!fs.existsSync(f)) return null;
  const t = fs.readFileSync(f, "utf8").replace(/^﻿/, "").replace(/\r/g, "").trim().split("\n");
  const h = parseLinhaCSV(t[0]);
  const kits = t.slice(1).filter(Boolean).map(l => { const c = parseLinhaCSV(l); const o = {}; h.forEach((k, i) => o[k] = c[i] ?? ""); return o; });
  const qtdKit = nome => { const m = norm(nome).match(/kit\s*c?\/?\s*(\d{1,2})\b/) || norm(nome).match(/\b(\d{1,2})\s*un(id)?\b/) || norm(nome).match(/leve\s*(\d{1,2})/); const n = m ? +m[1] : null; return (n >= 2 && n <= 24) ? n : null; };
  const tamKit = nome => { const m = (nome || "").match(/(\d+[.,]?\d*)\s?(ml|kg|g|l)\b/i); return m ? m[1].replace(".", "") + m[2].toLowerCase() : ""; };
  // referencia de preco unitario avulso: mediana por categoria+tamanho (marketplaces, unidade)
  const ref = {};
  for (const r of atual.filter(r => ["Mercado Livre", "Amazon"].includes(r.Site) && ehUnidade(r) && precoEfetivo(r) != null)) {
    (ref[[norm(r.Categoria), r.Tamanho].join("|")] ||= []).push(precoEfetivo(r));
  }
  const mediana = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  for (const k of Object.keys(ref)) ref[k] = mediana(ref[k]);

  const enriquecidos = kits.map(k => {
    const n = qtdKit(k.Kit), tam = tamKit(k.Kit), preco = num(k.Preco);
    const precoUn = (n && preco) ? preco / n : null;
    const refUn = ref[[norm(k.Categoria), tam].join("|")] ?? null;
    return { ...k, n, tam, preco, precoUn, refUn,
      descImplicito: (precoUn != null && refUn) ? (1 - precoUn / refUn) * 100 : null,
      vendas: num(k.Vendidos_estimado) || 0 };
  });
  // formatos
  const fmt = {};
  for (const k of enriquecidos) if (k.n) { const o = (fmt[k.n] ||= { n: k.n, qtd: 0, vendas: 0 }); o.qtd++; o.vendas += k.vendas; }
  const formatos = Object.values(fmt).sort((a, b) => b.vendas - a.vendas || b.qtd - a.qtd);
  // por familia
  const fam = {};
  for (const k of enriquecidos) {
    const o = (fam[k.Categoria] ||= { cat: k.Categoria, qtd: 0, vendas: 0, descontos: [], marcas: {} });
    o.qtd++; o.vendas += k.vendas;
    if (k.descImplicito != null && k.descImplicito > -50 && k.descImplicito < 90) o.descontos.push(k.descImplicito);
    if (k.Marca) o.marcas[k.Marca] = (o.marcas[k.Marca] || 0) + 1;
  }
  const familias = Object.values(fam).map(o => ({ ...o,
    descMedio: o.descontos.length ? o.descontos.reduce((a, b) => a + b, 0) / o.descontos.length : null,
    topMarca: Object.entries(o.marcas).sort((a, b) => b[1] - a[1])[0]?.[0] || "" }))
    .sort((a, b) => b.vendas - a.vendas);
  const topGiro = enriquecidos.filter(k => k.vendas > 0).sort((a, b) => b.vendas - a.vendas).slice(0, 15);
  const avanteKits = enriquecidos.filter(k => /avante/i.test(k.Marca) || /avante/i.test(k.Kit));
  return { total: enriquecidos.length, formatos, familias, topGiro, avanteKits };
}

// ===================== 6. MARCAS NOVAS =====================
function calcMarcasNovas() {
  if (snaps.length < 2) return { novas: [], base: 0 };
  const ult = snaps[snaps.length - 1];
  const antes = new Set();
  for (const s of snaps.slice(0, -1)) for (const r of s.rows) { const m = marcaExibir(r); if (m) antes.add(norm(m)); }
  const novasMap = {};
  for (const r of ult.rows) {
    const m = marcaExibir(r);
    if (!m || antes.has(norm(m)) || isAvante(r)) continue;
    const o = (novasMap[norm(m)] ||= { marca: m, onde: new Set(), fam: new Set() });
    o.onde.add(r.Site); o.fam.add(r.Categoria);
  }
  return { novas: Object.values(novasMap).map(o => ({ marca: o.marca, onde: [...o.onde].join(", "), fam: [...o.fam].slice(0, 3).join("; ") })), base: antes.size, dataUlt: ult.data };
}

// ===================== 7. CURVA DE PRECO =====================
function calcCurva() {
  const datas = snaps.map(s => s.data);
  const spanDias = datas.length >= 2 ? Math.round((new Date(datas[datas.length - 1]) - new Date(datas[0])) / 864e5) : 0;
  const pronta = datas.length >= 6 && spanDias >= 21;
  if (!pronta) return { pronta, nColetas: datas.length, spanDias };
  // mediana do preco efetivo por familia x data (todas as lojas, unidade)
  const fam = {};
  for (const s of snaps) for (const r of s.rows) {
    if (!ehUnidade(r) || precoEfetivo(r) == null) continue;
    ((fam[r.Categoria] ||= {})[s.data] ||= []).push(precoEfetivo(r));
  }
  const mediana = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const linhas = Object.entries(fam)
    .filter(([, d]) => Object.keys(d).length >= Math.min(4, datas.length))
    .map(([cat, d]) => {
      const serie = datas.map(dt => d[dt] ? mediana(d[dt]) : null);
      const primeiros = serie.find(v => v != null), ultimos = [...serie].reverse().find(v => v != null);
      return { cat, serie, varTotal: primeiros ? (ultimos / primeiros - 1) * 100 : 0 };
    }).sort((a, b) => Math.abs(b.varTotal) - Math.abs(a.varTotal)).slice(0, 12);
  return { pronta, datas, linhas, nColetas: datas.length, spanDias };
}

// ===================== HTML =====================
const idx = calcIndice(), disp = calcDispersao(), promo = calcPromo(), rup = calcRuptura(),
  kits = calcKits(), novas = calcMarcasNovas(), curva = calcCurva();
const dataRef = [...new Set(atual.map(r => r.Data_coleta))].sort().pop() || "";

const cor = v => v > 2 ? "#b3123a" : v < -2 ? "#12633a" : "#8a5a00";
const tbl = (cab, linhas) => `<table><thead><tr>${cab.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${linhas.join("")}</tbody></table>`;

const secIndice = `
<h2 id="indice">1) Indice de competitividade <span class="sub">(vs concorrentes na MESMA loja/categoria/tamanho — negativo = voce mais barato)</span></h2>
<div class="resumo">${Object.entries(idx.porLoja).map(([s, o]) => `<div class="card"><b style="color:${cor(o.soma / o.n)}">${pct1(o.soma / o.n)}</b>${esc(s)}<br><span class="sub">${o.acima} acima · ${o.abaixo} abaixo da media</span></div>`).join("")}</div>
${tbl(["Loja", "Categoria", "Tam.", "Avante", "Media conc.", "Menor conc.", "vs media", "vs menor"],
  idx.linhas.map(l => `<tr><td>${esc(l.site)}</td><td>${esc(l.categoria)}</td><td>${esc(l.tamanho)}</td><td><b>R$ ${brl(l.meu)}</b></td><td>R$ ${brl(l.medC)} <span class="sub">(${l.nConc})</span></td><td>R$ ${brl(l.minC)}</td><td style="color:${cor(l.idxMed)};font-weight:700">${pct1(l.idxMed)}</td><td style="color:${cor(l.idxMin)}">${pct1(l.idxMin)}</td></tr>`))}`;

const secDisp = `
<h2 id="dispersao">2) Dispersao do produto Avante entre lojas <span class="sub">(mesmo produto, precos diferentes — spread alto = tabela desalinhada)</span></h2>
${disp.length ? tbl(["Produto", "Menor", "Maior", "Spread", "Onde"],
  disp.slice(0, 15).map(d => `<tr><td>${esc(d.categoria)} ${esc(d.tamanho)}${d.variante ? ` <span class="sub">(${esc(d.variante)})</span>` : ""}</td><td>R$ ${brl(d.min)}</td><td>R$ ${brl(d.max)}</td><td style="color:${d.spread > 15 ? "#b3123a" : "#8a5a00"};font-weight:700">${pct1(d.spread)}</td><td class="sub">${esc(d.detalhe)}</td></tr>`))
  : "<p>Sem produtos Avante em 2+ lojas na coleta atual.</p>"}`;

const secPromo = `
<h2 id="promo">3) Comportamento promocional por marca <span class="sub">(todas as coletas do historico — quem promove, quanto e onde)</span></h2>
${tbl(["Marca", "Observacoes", "% em promo", "Desconto medio", "Promove em", "Familias que mais promove"],
  promo.map(p => `<tr${/avante/i.test(p.marca) ? ' style="background:#fdf3f5"' : ""}><td><b>${esc(p.marca)}</b></td><td>${p.n}</td><td style="font-weight:700">${p.pctPromo.toFixed(0)}%</td><td>${p.descMedio != null ? p.descMedio.toFixed(0) + "%" : "—"}</td><td class="sub">${esc(p.lojas)}</td><td class="sub">${esc(p.topFam)}</td></tr>`))}`;

const secRup = `
<h2 id="ruptura">4) Radar de ruptura / distribuicao <span class="sub">(Avante que SUMIU ou ENTROU na prateleira vs coleta anterior de cada loja)</span></h2>
${rup.sumiu.length ? `<h3 style="color:#b3123a">🔻 Sumiram (${rup.sumiu.length}) — possivel ruptura ou descadastro</h3>` +
  tbl(["Loja", "Produto", "Preco anterior"], rup.sumiu.map(r => `<tr><td>${esc(r.site)}</td><td>${esc(r.desc)}</td><td>R$ ${brl(r.preco)}</td></tr>`)) : "<p>✅ Nenhum produto Avante sumiu.</p>"}
${rup.entrou.length ? `<h3 style="color:#12633a">🔺 Entraram (${rup.entrou.length}) — ganho de prateleira</h3>` +
  tbl(["Loja", "Produto", "Preco"], rup.entrou.map(r => `<tr><td>${esc(r.site)}</td><td>${esc(r.desc)}</td><td>R$ ${brl(r.preco)}</td></tr>`)) : ""}`;

const secKits = !kits ? `<h2 id="kits">5) Kits</h2><p>Kits_Consolidado.csv nao encontrado — rode kits-mercadolivre.bat (e/ou kits-shopee.bat) primeiro.</p>` : `
<h2 id="kits">5) Analise de kits (ML + Shopee) <span class="sub">${kits.total} kits · desconto implicito = preco/un do kit vs preco unitario avulso nos marketplaces</span></h2>
<h3>Formatos que o mercado monta (por volume de vendas Shopee)</h3>
<div class="resumo">${kits.formatos.slice(0, 6).map(f => `<div class="card"><b>Kit ${f.n}un</b>${f.qtd} ofertas<br><span class="sub">~${f.vendas.toLocaleString("pt-BR")} vendas</span></div>`).join("")}</div>
<h3>Familias por giro (Shopee) e desconto implicito medio</h3>
${tbl(["Familia", "Kits", "Vendas est. (Shopee)", "Desc. implicito medio", "Marca dominante"],
  kits.familias.slice(0, 15).map(f => `<tr><td>${esc(f.cat)}</td><td>${f.qtd}</td><td><b>${f.vendas.toLocaleString("pt-BR")}</b></td><td>${f.descMedio != null ? f.descMedio.toFixed(0) + "%" : "—"}</td><td>${esc(f.topMarca)}</td></tr>`))}
<h3>Top 15 kits por giro real (Shopee)</h3>
${tbl(["Kit", "Marca", "Preco", "Un/kit", "R$/un", "Vendas est."],
  kits.topGiro.map(k => `<tr><td>${esc(k.Kit.slice(0, 70))}</td><td>${esc(k.Marca)}</td><td>R$ ${brl(k.preco)}</td><td>${k.n ?? "—"}</td><td>${k.precoUn != null ? "R$ " + brl(k.precoUn) : "—"}</td><td><b>${k.vendas.toLocaleString("pt-BR")}</b></td></tr>`))}
<p><b>Avante em kits:</b> ${kits.avanteKits.length ? kits.avanteKits.length + " kit(s) — " + kits.avanteKits.slice(0, 4).map(k => esc(k.Kit.slice(0, 45))).join(" · ") : "NENHUM kit oficial/de terceiros com a marca — oportunidade aberta nos formatos acima."}</p>`;

const secNovas = `
<h2 id="novas">6) Marcas novas na prateleira <span class="sub">(apareceram na coleta de ${esc(novas.dataUlt || "-")} e nao existiam nas anteriores)</span></h2>
${novas.novas.length ? tbl(["Marca", "Onde apareceu", "Em quais familias"],
  novas.novas.map(n => `<tr><td><b>${esc(n.marca)}</b></td><td>${esc(n.onde)}</td><td class="sub">${esc(n.fam)}</td></tr>`))
  : "<p>✅ Nenhuma marca nova detectada nesta coleta.</p>"}
<p class="sub">Obs.: com o historico ainda curto, entradas podem ser so variacao de coleta. A leitura fica confiavel com ~1 mes de dados.</p>`;

const secCurva = curva.pronta ? `
<h2 id="curva">7) Curva de preco por familia <span class="sub">(mediana do preco efetivo em todas as lojas, por coleta)</span></h2>
${tbl(["Familia", ...curva.datas.map(d => d.slice(5)), "Variacao"],
  curva.linhas.map(l => `<tr><td>${esc(l.cat)}</td>${l.serie.map(v => `<td>${v != null ? "R$ " + brl(v) : "—"}</td>`).join("")}<td style="color:${cor(l.varTotal)};font-weight:700">${pct1(l.varTotal)}</td></tr>`))}` : `
<h2 id="curva">7) Curva de preco <span class="sub">(em construcao)</span></h2>
<p>⏳ Acumulando historico: <b>${curva.nColetas} coleta(s)</b> em <b>${curva.spanDias} dia(s)</b>. Esta secao ativa sozinha com ~6 coletas em 3+ semanas (as coletas de domingo e quarta ja alimentam isso automaticamente).</p>`;

const html = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Analises — Monitor Avante</title>
<style>
 body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;background:#f6f7f9;color:#1c2430}
 header{background:#1c2430;color:#fff;padding:22px 26px} header h1{margin:0;font-size:21px} header p{margin:6px 0 0;opacity:.85;font-size:13px}
 nav{position:sticky;top:0;background:#fff;padding:10px 26px;box-shadow:0 1px 4px rgba(0,0,0,.1);z-index:5}
 nav a{color:#1560d4;text-decoration:none;font-size:13px;margin-right:14px}
 .wrap{padding:22px 26px;max-width:1150px;margin:0 auto}
 h2{font-size:17px;margin:34px 0 10px;border-bottom:2px solid #dde1e7;padding-bottom:6px}
 h3{font-size:14px;margin:18px 0 8px} .sub{color:#7a8290;font-size:12px;font-weight:400}
 .resumo{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}
 .card{background:#fff;border-radius:10px;padding:12px 16px;box-shadow:0 1px 3px rgba(0,0,0,.08);font-size:13px}
 .card b{font-size:20px;display:block}
 table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);margin:8px 0 4px}
 th,td{padding:8px 10px;text-align:left;font-size:12.5px;border-bottom:1px solid #eef0f3;vertical-align:top}
 th{background:#f0f2f5;font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;color:#5a6472}
 tr:hover td{background:#fafbfc}
</style></head><body>
<header><h1>📈 Analises gerenciais — Monitor Avante</h1>
<p>Base: coleta mais recente de cada loja (ate ${esc(dataRef)}) + historico de ${snaps.length} coleta(s). Gerado localmente, sem custo de IA.</p></header>
<nav><a href="#indice">1 Competitividade</a><a href="#dispersao">2 Dispersao</a><a href="#promo">3 Promocoes</a><a href="#ruptura">4 Ruptura</a><a href="#kits">5 Kits</a><a href="#novas">6 Marcas novas</a><a href="#curva">7 Curva de preco</a></nav>
<div class="wrap">${secIndice}${secDisp}${secPromo}${secRup}${secKits}${secNovas}${secCurva}
<p class="sub" style="margin-top:30px">Notas: comparacoes so UNIDADE x UNIDADE (kits analisados a parte na secao 5); "regular" com cara de preco de pack (&gt;4x o promo) e ignorado no calculo de desconto; dispersao agrupa por categoria+tamanho+variante (ex.: coco vs argan nao se misturam).</p>
</div></body></html>`;
fs.writeFileSync(path.join(SAIDAS, "analises.html"), html, "utf8");

console.log(`\n=== ANALISES GERADAS (Coletas/analises.html) ===`);
console.log(`1) Competitividade: ${idx.linhas.length} comparacoes em ${Object.keys(idx.porLoja).length} lojas`);
console.log(`2) Dispersao: ${disp.length} produtos Avante em 2+ lojas (maior spread: ${disp[0] ? pct1(disp[0].spread) : "-"})`);
console.log(`3) Promocoes: ${promo.length} marcas analisadas`);
console.log(`4) Ruptura: ${rup.sumiu.length} sumiram, ${rup.entrou.length} entraram`);
console.log(`5) Kits: ${kits ? kits.total + " kits, " + kits.avanteKits.length + " com Avante" : "sem arquivo consolidado"}`);
console.log(`6) Marcas novas: ${novas.novas.length}`);
console.log(`7) Curva: ${curva.pronta ? "ATIVA" : `acumulando (${curva.nColetas} coletas / ${curva.spanDias} dias)`}\n`);
