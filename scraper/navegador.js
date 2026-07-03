// Abre o navegador certo pro ambiente:
//  - No SEU PC: Chrome/Edge REAL com janela (fura proteções anti-bot tipo Akamai).
//  - No GitHub Actions (nuvem): Chromium headless. Obs.: o IP de datacenter do GitHub
//    é bloqueado por Araújo/Drogasil/ML/Amazon — lá só saem os sites "fáceis".
const { chromium } = require("playwright");
const os = require("os"), path = require("path");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const ehCI = !!(process.env.CI || process.env.GITHUB_ACTIONS);

async function lancar() {
  if (ehCI) {
    const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"] });
    const ctx = await browser.newContext({ locale: "pt-BR", viewport: { width: 1366, height: 900 }, userAgent: UA });
    await ctx.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });
    const _close = ctx.close.bind(ctx);
    ctx.close = async () => { await _close(); await browser.close(); };
    console.log("Navegador: Chromium headless (nuvem/CI)");
    return ctx;
  }
  // Local: navegador real com janela
  const userDataDir = path.join(os.tmpdir(), "avante-scraper-perfil");
  const args = ["--disable-blink-features=AutomationControlled", "--start-maximized", "--no-first-run", "--no-default-browser-check"];
  const canais = ["chrome", "msedge", null];
  let ultimoErro;
  for (const channel of canais) {
    try {
      const ctx = await chromium.launchPersistentContext(userDataDir, {
        channel: channel || undefined, headless: false, viewport: null, locale: "pt-BR", userAgent: UA, args
      });
      await ctx.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });
      console.log("Navegador:", channel || "Chromium (embutido)");
      return ctx;
    } catch (e) { ultimoErro = e; }
  }
  throw new Error("Não consegui abrir Chrome, Edge nem Chromium: " + (ultimoErro && ultimoErro.message));
}
module.exports = { lancar };
