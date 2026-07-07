// Gera Precos_Monitor.xlsx a partir do precos.json (roda no PC do usuario).
// Usa exceljs (mantido, sem as CVEs do pacote xlsx/SheetJS). So ESCREVE — nao abre planilha de terceiros.
const fs = require("fs"), path = require("path");
const ExcelJS = require("exceljs");
const DATA = path.join(__dirname, "..", "data");

function ler() {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, "precos.json"), "utf8")); }
  catch (e) {
    const t = fs.readFileSync(path.join(DATA, "precos-data.js"), "utf8");
    return JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
  }
}

const COLS = ["Data_coleta","Canal","Site","Categoria","Marca","Descrição","Tamanho",
  "Preço regular","Preço promo","Disponibilidade","Vendido por","Loja oficial?",
  "Nota","Nº avaliações","Qtd vendida","Link","Formato","Fonte"];
const LARGURAS = [12,13,16,22,16,40,10,12,12,14,18,12,7,13,12,40,12,12];

(async () => {
  const dados = ler();
  if (!dados.length) { console.log("Sem dados em precos.json."); process.exit(1); }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Precos", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLS.map((c, i) => ({ header: c, key: c, width: LARGURAS[i] }));
  ws.getRow(1).font = { bold: true };
  // addRow com string simples grava como texto (nao como formula) -> nao ha injecao de formula no xlsx.
  for (const r of dados) ws.addRow(COLS.map(c => r[c] ?? ""));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLS.length } };

  // Nome datado (MM-DD da coleta mais recente) na pasta dedicada "Coletas".
  const maxData = dados.reduce((m, r) => (r.Data_coleta > m ? r.Data_coleta : m), "");
  const mmdd = /^\d{4}-\d{2}-\d{2}$/.test(maxData) ? maxData.slice(5) : new Date().toISOString().slice(5, 10);
  const dirSaidas = path.join(__dirname, "..", "..", "Coletas");
  fs.mkdirSync(dirSaidas, { recursive: true });
  const out = path.join(dirSaidas, `Coleta ${mmdd}.xlsx`);
  await wb.xlsx.writeFile(out);
  console.log(`OK! "Coleta ${mmdd}.xlsx" gerado com ${dados.length} linhas na pasta Coletas.`);
})().catch(e => { console.error("[ERRO] Falha ao gerar Excel:", e.message); process.exit(1); });
