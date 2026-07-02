// Une as duas fontes num só dataset para o dashboard:
//   data/precos.csv       -> coleta automática do GitHub Actions (farmácia/super/regional)
//   data/marketplaces.csv -> coleta do Claude Code (Mercado Livre, Amazon, Magalu... com nota/vendas)
// Saída: data/precos.json (fonte do dashboard), com coluna "Fonte" e sem duplicados.
const fs = require("fs"), path = require("path");
const DATA = path.join(__dirname, "..", "data");

const UNI = ["Data_coleta","Canal","Site","Categoria","Marca","Descrição","Tamanho",
  "Preço regular","Preço promo","Disponibilidade","Vendido por","Loja oficial?",
  "Nota","Nº avaliações","Qtd vendida","Link","Formato","Fonte"];

function parseLinha(line){ const o=[]; let c="",q=false;
  for(let i=0;i<line.length;i++){const ch=line[i];
    if(q){ if(ch==='"'){ if(line[i+1]==='"'){c+='"';i++;} else q=false; } else c+=ch; }
    else if(ch==='"') q=true; else if(ch===';'){ o.push(c); c=""; } else c+=ch; }
  o.push(c); return o; }
function lerCSV(file){ if(!fs.existsSync(file)) return [];
  const t=fs.readFileSync(file,"utf8").replace(/\r/g,"").trim(); if(!t) return [];
  const ls=t.split("\n"); const h=parseLinha(ls[0]);
  return ls.slice(1).filter(Boolean).map(l=>{const c=parseLinha(l);const o={};h.forEach((k,i)=>o[k]=c[i]??"");return o;}); }

function normalizar(row, fonte){ const o={}; UNI.forEach(k=>o[k]=row[k]??""); if(!o.Fonte) o.Fonte=fonte; if(!o.Formato) o.Formato="Unidade"; return o; }

const github = lerCSV(path.join(DATA,"precos.csv")).map(r=>normalizar(r,"GitHub"));
const claudeArquivos = ["marketplaces.csv","beleza.csv"];
let mkt = [];
for (const f of claudeArquivos) mkt = mkt.concat(lerCSV(path.join(DATA,f)).map(r=>normalizar(r,"Claude Code")));

// dedup por (data, site, descrição, tamanho) — mantém o primeiro
const seen={}, todas=[];
for(const r of [...github, ...mkt]){
  const k=[r.Data_coleta,r.Site,r["Descrição"],r.Tamanho].join("|");
  if(seen[k]) continue; seen[k]=1; todas.push(r);
}
fs.writeFileSync(path.join(DATA,"precos.json"), JSON.stringify(todas,0,0));
const porFonte = todas.reduce((a,r)=>((a[r.Fonte]=(a[r.Fonte]||0)+1),a),{});
console.log(`Consolidado: ${todas.length} linhas`, porFonte);
