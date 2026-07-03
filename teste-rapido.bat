@echo off
chcp 65001 >nul
title Teste rapido
cd /d "%~dp0scraper"
echo Testando o ambiente com navegador REAL (abre uma janela, ~30s)...
echo NAO feche a janela do navegador que aparecer; ela fecha sozinha.
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org
  echo.
  pause
  exit /b
)
echo Node: & node --version
echo.
node -e "const{lancar}=require('./navegador');(async()=>{try{const ctx=await lancar();const p=await ctx.newPage();await p.goto('https://www.araujo.com.br/busca?q=reparador de pontas',{timeout:45000,waitUntil:'domcontentloaded'});await p.waitForTimeout(5000);const t=await p.title();const body=(await p.evaluate(()=>document.body.innerText||'')).slice(0,300);const blocked=/access denied|forbidden|unusual traffic|verificar que voce|robo/i.test(t+' '+body);const cards=await p.evaluate(()=>document.querySelectorAll('a[href$=\".html\"]').length);if(blocked){console.log('');console.log('  >>> BLOQUEADO: a Araujo detectou automacao (Access Denied).');console.log('  >>> O modo local nao vai funcionar nesse site. Me avise.');}else{console.log('');console.log('  >>> OK! Araujo liberou. Titulo:',t.slice(0,40),'| produtos na pagina:',cards);}await ctx.close();}catch(e){console.log('  ERRO:',(e.message||'').slice(0,200));}})()"
echo.
pause
