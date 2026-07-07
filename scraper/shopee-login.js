// shopee-login.js — abre o Chrome com o PERFIL DEDICADO da Shopee pra voce logar UMA vez.
// O login fica salvo no perfil (fora do OneDrive/temp) e vale pras coletas seguintes.
const path = require("path"), os = require("os");
const PERFIL = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "avante-shopee-perfil");

(async () => {
  const { lancar } = require("./navegador");
  const ctx = await lancar({ perfil: PERFIL });
  const page = await ctx.newPage();
  await page.goto("https://shopee.com.br/buyer/login", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  console.log("\n==============================================");
  console.log(" 1) Faca LOGIN na Shopee na janela que abriu");
  console.log("    (resolva o captcha se ela pedir).");
  console.log(" 2) Quando estiver logado, FECHE o navegador.");
  console.log("==============================================\n");
  await new Promise(res => ctx.on("close", res));
  console.log("Perfil salvo em: " + PERFIL);
  console.log("Pronto! Agora e so rodar kits-shopee.bat quando quiser coletar.");
})();
