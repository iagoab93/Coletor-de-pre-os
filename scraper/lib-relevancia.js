// lib-relevancia.js — filtra produtos fora da familia nas buscas de SUPERMERCADO.
// Motivo: Super So / ABC / Rex / Rena buscam por QUALQUER palavra do termo, entao "amaciante de
// calosidade" volta amaciante de roupa/de carne, "seiva de flores" volta flores artificiais, etc.
// Regra: o nome do produto precisa conter TODOS os termos de ALGUM grupo, e NENHUM termo de `none`.
// (stems sem acento, minusculo; casados como substring). Familia sem spec -> nao filtra.

const norm = s => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// keyed pela categoria (igual ao itens.js). groups = OR de ANDs. none = exclusoes.
const SPECS_RAW = {
  "Removedor de esmalte c/ acetona": { groups: [["removedor", "esmalt"], ["acetona"]], none: ["porta", "dosador", "organizador", "suporte"] },
  "Removedor de esmalte s/ acetona": { groups: [["removedor", "esmalt"]], none: ["porta", "dosador"] },
  "Gota secante": { groups: [["secante"]], none: ["louca", "abrilhantador", "maquina", "enxaguante"] },
  "Água oxigenada cremosa 40V": { groups: [["oxigenada"]] },
  "OX estabilizada 40V": { groups: [["oxigenada"], ["ox", "40"], ["estabilizada"]] },
  "Solução de amônia": { groups: [["amonia"]] },
  "Óleo capilar/corporal 100ml": { groups: [["oleo", "capilar"], ["oleo", "corporal"]], none: ["cozinha", "soja", "milho", "fritura"] },
  "Óleo Dr (finalizador)": { groups: [["oleo", "finalizador"], ["oleo", "capilar"]] },
  "Óleo de girassol c/ vit E": { groups: [["oleo", "girassol"]], none: ["pao", "castanha", "biscoito", "cozinha", "salada"] },
  "Óleo de rícino": { groups: [["oleo", "ricino"], ["ricino"]], none: ["condicionador", "shampoo", "mascara", "creme", "tratamento", "leave"] },
  "Óleo de banana (unha/cutícula)": { groups: [["oleo", "banana"]], none: ["doce", "bananinha", "passa", "chips"] },
  "Creme de cacau": { groups: [["creme", "cacau"]], none: ["achocolatado", "chocolate", "biscoito", "bombom", "recheado"] },
  "Canela de velho": { groups: [["canela", "velho"]] },
  "Loção hidratante corporal": { groups: [["locao", "corporal"], ["locao", "hidratante"]] },
  "Esfoliante corp/facial": { groups: [["esfoliante"]], none: ["esponja", "bucha", "luva de banho"] },
  "Seiva de flores": { groups: [["seiva"]] },
  "Amaciante de calosidades": { groups: [["calos"], ["amaciante", "cuticula"]], none: ["roupa", "carne", "concentrado"] },
  "Amolecedor de cutícula": { groups: [["amolecedor"], ["cuticula"]] },
  "Luva de silicone": { groups: [["luva", "silicone"]], none: ["cozinha", "forno", "panela", "lavar", "limpeza"] },
  "Pedra hume pó": { groups: [["hume"]] },
  "Pedra hume spray": { groups: [["hume"]] },
  "Talco desodorante p/ pés s/ perfume": { groups: [["talco"]], none: ["maisena", "amido"] },
  "Talco desodorante p/ pés mentolado": { groups: [["talco"]], none: ["maisena", "amido"] },
  "Reparador de pontas": { groups: [["reparador"]], none: ["caneta", "canetinha", "lapis"] },
  "Pó descolorante": { groups: [["descolorante"]] },
  "Sabonete íntimo": { groups: [["sabonete", "intimo"]] },
  "Sabonete líquido corporal": { groups: [["sabonete"]], none: ["intimo", "roupa", "prato", "louca"] },
  "Sabonete líquido óleo de banho": { groups: [["sabonete"], ["oleo de banho"]] },
  "Glicerina bidestilada": { groups: [["glicerina"]], none: ["sab ", "sabonete", "shampoo", "condicionador", "hidratante corporal"] },
  "Vaselina líquida": { groups: [["vaselina"]] },
  "Vaselina sólida": { groups: [["vaselina"]] },
  "Essência de eucalipto": { groups: [["essencia", "eucalipto"]], none: ["bala", "vela", "sabonete", "amaciante"] },
  "Água micelar": { groups: [["micelar"]] },
  "Pasta d'água com mentol": { groups: [["pasta", "agua"]], none: ["alho", "amendoim", "dente", "tomate", "temp"] },
  "Pomada de ureia (Kurapé)": { groups: [["ureia"], ["kurape"]], none: ["capilar", "modeladora", "cabelo"] },
  "Sebo de carneiro": { groups: [["carneiro"]] },
  "Repelente": { groups: [["repelente"]], none: ["roupa", "tecido", "eletric", "pastilha", "refil", "tomada", "aparelho"] },
};

// indexa por categoria normalizada (evita divergencia de acento)
const SPECS = new Map(Object.entries(SPECS_RAW).map(([k, v]) => [norm(k), v]));

function relevante(categoria, nome) {
  const spec = SPECS.get(norm(categoria));
  if (!spec) return true; // familia sem regra -> mantem
  const n = norm(nome);
  if (spec.none && spec.none.some(w => n.includes(w))) return false;
  return spec.groups.some(g => g.every(w => n.includes(w)));
}

module.exports = { relevante, norm };
