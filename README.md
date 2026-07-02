# Monitor de Preços Avante — versão GitHub (sem IA por coleta)

Coleta preços com um script JavaScript (Playwright), roda de graça no **GitHub Actions**
(agendado), **versiona os dados no Git** (histórico de preço automático) e mostra um
**dashboard no GitHub Pages**. Não gasta tokens de IA a cada coleta.

## Estrutura
- `scraper/scraper.js` — o coletor (Node + Playwright).
- `scraper/sites.js`   — sites e como extrair cada um (edite pra add/ajustar).
- `scraper/itens.js`   — famílias de produto e marcas de interesse.
- `.github/workflows/coleta.yml` — agendamento no GitHub Actions.
- `data/precos.csv` / `data/precos.json` — dados (gerados/versionados a cada coleta).
- `index.html` — dashboard (GitHub Pages).

## Passo a passo pra colocar no ar

### 1. Criar conta e repositório
1. Crie uma conta em https://github.com (grátis).
2. Clique em **New repository** → nome ex.: `monitor-precos-avante` → **Public** → **Create**.

### 2. Subir os arquivos (jeito fácil, sem terminal)
1. Na página do repo, clique **"uploading an existing file"**.
2. Arraste TUDO que está nesta pasta `github-monitor` (incluindo a pasta `.github`).
   - Dica: se o navegador não deixar arrastar a pasta `.github`, entre nela e suba o
     arquivo `coleta.yml` mantendo o caminho `.github/workflows/coleta.yml`.
3. Clique **Commit changes**.

### 3. Ligar o Actions e rodar a 1ª coleta
1. Aba **Actions** → se pedir, clique **"I understand… enable workflows"**.
2. Abra **"Coleta de precos"** → botão **Run workflow** → confirme.
3. Espere ~3–5 min. Ele coleta e faz commit de `data/precos.csv` e `data/precos.json`.

### 4. Ligar o dashboard (GitHub Pages)
1. Aba **Settings** → **Pages**.
2. Em **Source**, escolha **Deploy from a branch** → branch **main** → pasta **/ (root)** → **Save**.
3. Em ~1 min aparece a URL (ex.: `https://SEU-USUARIO.github.io/monitor-precos-avante/`).
   Abra: é o dashboard lendo `data/precos.json`.

### 5. Agendamento
Já está agendado toda segunda 09:00 UTC no `coleta.yml` (linha `cron`). Mude o horário/dia
lá se quiser. Roda sozinho, de graça, e o histórico vai se acumulando no CSV (versionado no Git).

## Como ajustar
- **Adicionar família**: edite `scraper/itens.js` (adicione `{ cat, termo }`).
- **Adicionar site**: edite `scraper/sites.js` (copie um bloco e ajuste `url` e o seletor).
- **Marketplaces (ML, Amazon, Magalu, Americanas)**: costumam bloquear IP de datacenter
  (GitHub Actions) com captcha. Deixe esses na coleta via Claude Code, ou use proxy residencial.

## Rodar no seu PC (teste local, opcional)
```
cd scraper
npm install
npx playwright install chromium
node scraper.js
```
