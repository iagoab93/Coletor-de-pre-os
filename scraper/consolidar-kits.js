// consolidar-kits.js — junta os kits da Shopee + Mercado Livre num arquivo unico.
// Le: ../../Shopee_Kits.csv (raiz do projeto) e ../ML_Kits.csv (github-monitor).
// Gera: ../../Kits_Consolidado.csv e ../../Kits_Consolidado.xlsx (na raiz, junto do Shopee_Kits).
const fs = require("fs"), path = require("path");
const ExcelJS = require("exceljs");

const RAIZ_PROJ = path.join(__dirname, "..", ".."); // "Monitor de preco"
const GH = path.join(__dirname, "..");              // "github-monitor"

// --- parser CSV ";" com aspas ---
function parseLinha(line) {
  const o = []; let c = "", q = false;
  for (let i = 0; i < line.length; i++) { const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true; else if (ch === ';') { o.push(c); c = ""; } else c += ch; }
  o.push(c); return o;
}
function lerCSV(file) {
  if (!fs.existsSync(file)) return { header: [], rows: [] };
  let t = fs.readFileSync(file, "utf8").replace(/^﻿/, "").replace(/\r/g, "").trim();
  if (!t) return { header: [], rows: [] };
  const ls = t.split("\n"); const header = parseLinha(ls[0]);
  const rows = ls.slice(1).filter(Boolean).map(l => { const c = parseLinha(l); const o = {}; header.forEach((k, i) => o[k] = c[i] ?? ""); return o; });
  return { header, rows };
}

const COLS = ["Marketplace", "Data", "Categoria", "Kit", "Marca", "Preco", "Nota", "Vendidos_texto", "Vendidos_estimado", "Avaliacoes", "Frete_BH", "Link"];

// Shopee: prefere a coleta AUTOMATICA local (Shopee_Kits_Auto.csv, gerada pelo kits-shopee.bat);
// se nao existir/estiver vazia, usa a manual da raiz (Shopee_Kits.csv, coletada por IA).
let shopee;
const autoRows = lerCSV(path.join(GH, "Shopee_Kits_Auto.csv")).rows;
if (autoRows.length) {
  shopee = autoRows.map(r => { const o = {}; for (const c of COLS) o[c] = r[c] ?? ""; if (!o.Marketplace) o.Marketplace = "Shopee"; return o; });
  console.log(`Shopee: usando a coleta automatica local (${shopee.length} kits).`);
} else {
  shopee = lerCSV(path.join(RAIZ_PROJ, "Shopee_Kits.csv")).rows.map(r => {
    const o = { Marketplace: "Shopee" };
    for (const c of COLS) if (c !== "Marketplace") o[c] = r[c] ?? "";
    return o;
  });
  console.log(`Shopee: usando a coleta manual (${shopee.length} kits) — rode kits-shopee.bat p/ ter a automatica.`);
}
const ml = lerCSV(path.join(GH, "ML_Kits.csv")).rows.map(r => {
  const o = {}; for (const c of COLS) o[c] = r[c] ?? ""; if (!o.Marketplace) o.Marketplace = "Mercado Livre"; return o;
});

const todas = [...shopee, ...ml];
const nEst = v => { const n = parseInt(String(v).replace(/\D/g, "")); return isNaN(n) ? 0 : n; };
// ordena: por categoria, depois mais vendidos primeiro (Shopee tem esse dado; ML fica no fim da categoria)
todas.sort((a, b) => a.Categoria.localeCompare(b.Categoria) || nEst(b.Vendidos_estimado) - nEst(a.Vendidos_estimado));

// --- CSV ---
const cell = v => { v = String(v ?? "").replace(/[\r\n]+/g, " ").trim(); if (/^[=+\-@\t]/.test(v)) v = "'" + v; return /[;"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const csv = "﻿" + [COLS.join(";"), ...todas.map(r => COLS.map(c => cell(r[c])).join(";"))].join("\r\n") + "\r\n";
fs.writeFileSync(path.join(RAIZ_PROJ, "Kits_Consolidado.csv"), csv, "utf8");

// --- XLSX ---
(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Kits", { views: [{ state: "frozen", ySplit: 1 }] });
  const larguras = [14, 12, 26, 46, 14, 10, 7, 14, 14, 11, 10, 46];
  ws.columns = COLS.map((c, i) => ({ header: c, key: c, width: larguras[i] }));
  ws.getRow(1).font = { bold: true };
  for (const r of todas) ws.addRow(COLS.map(c => r[c] ?? ""));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLS.length } };
  await wb.xlsx.writeFile(path.join(RAIZ_PROJ, "Kits_Consolidado.xlsx"));

  const porMkt = todas.reduce((a, r) => ((a[r.Marketplace] = (a[r.Marketplace] || 0) + 1), a), {});
  console.log(`Kits consolidados: ${todas.length} (${JSON.stringify(porMkt)})`);
  console.log("Gerados: Kits_Consolidado.csv e Kits_Consolidado.xlsx (na pasta Monitor de preco).");
})().catch(e => { console.error("[ERRO] xlsx:", e.message); process.exit(1); });
