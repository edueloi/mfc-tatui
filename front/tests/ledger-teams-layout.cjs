// Prévia isolada com API fictícia. Não publica nem modifica dados do sistema.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

async function run() {
  const root = path.resolve(__dirname, '..');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'mfc-ledger-teams-'));
  const script = await require('esbuild').build({ absWorkingDir: root, stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import Screen from './views/GeneralLedger';localStorage.setItem('mfc.currentUser',JSON.stringify({id:'user',role:'Teste'}));createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/livro-caixa']}><Routes><Route path="/livro-caixa/:bookSlug?" element={<Screen/>}/></Routes></MemoryRouter>);`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'mock-api', setup(build) { build.onLoad({ filter: /api\.ts$/ }, () => ({ loader: 'js', contents: "const teams=[{id:'t1',name:'São Bento',city:'Tatuí',state:'SP'},{id:'t2',name:'São Lázaro',city:'Tatuí',state:'SP'}];\nconst members=[{id:'a',name:'Ana da Conceição',status:'Ativo',teamId:'t1',familyName:'Família A',relationshipType:'Titular'},{id:'b',name:'Bruno da Conceição',status:'Ativo',teamId:'t1',familyName:'Família A',relationshipType:'Cônjuge'},{id:'c',name:'Carlos',status:'Ativo',teamId:'t2',relationshipType:'Titular'}];\nlet payments=[{id:'p1',memberId:'a',memberName:'Ana da Conceição',teamId:'t1',amount:15,date:'2026-10-09',referenceMonth:'1/2026',status:'Pago'}];\nconst books=[{id:'mfc-team-payments-2026',name:'Mensalidades das Equipes — 2026',year:2026,initialBalance:0},{id:'testmanual',name:'Livro manual',year:2026,initialBalance:0}];\nwindow.fixtureWrites=0;export const photoSrc=value=>value;export const api={getRoles:async()=>[{name:'Teste',isSystem:true}],getLedgerEntities:async()=>books,getLedger:async()=>[],getCostCenters:async()=>[],getTeams:async()=>teams,getMembers:async()=>members,getPayments:async()=>payments,getFinancialConfig:async()=>({monthlyPaymentAmount:30}),createPayment:async data=>{window.fixtureWrites++;const p={...data,id:String(window.fixtureWrites)};payments=[...payments,p];return p}};" })); } }] });
  fs.writeFileSync(path.join(output, 'app.js'), script.outputFiles[0].contents);
  fs.writeFileSync(path.join(output, 'tailwind.js'), await (await fetch('https://cdn.tailwindcss.com', { signal: AbortSignal.timeout(10000) })).text());
  fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="tailwind.js"></script><link rel="stylesheet" href="${pathToFileURL(path.join(root, 'index.css'))}"><body style="background:#f8fafc;padding:0 12px"><div id="root"></div><script src="app.js"></script></body></html>`);
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve));
  const chrome = spawn(process.env.MFC_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(output, 'chrome')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    let tabs;
    for (let n = 0; n < 40; n++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.some(t=>t.type==='page')) break; } catch {} await new Promise(resolve => setTimeout(resolve, 150)); }
    socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let sequence = 0; const pending = new Map();
    socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); } });
    const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; const timeout = setTimeout(() => reject(Error('Tempo excedido: ' + method)), 15000); pending.set(id, message => { clearTimeout(timeout); message.error ? reject(Error(message.error.message)) : resolve(message.result); }); socket.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const result = await command('Runtime.evaluate', { expression, returnByValue: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
    const pause = () => new Promise(resolve => setTimeout(resolve, 120));
    const click = async label => { await evaluate(`[...document.querySelectorAll('button')].find(button=>button.getClientRects().length && button.textContent.trim()===${JSON.stringify(label)}).click()`); await pause(); };
    await command('Page.enable');
    await command('Page.navigate', { url: pathToFileURL(path.join(output, 'index.html')).href });
    for (let n = 0; n < 50; n++) { if (await evaluate(`document.body?.textContent.includes('Mensalidades das Equipes — 2026')`)) break; await pause(); }
    await new Promise(resolve=>setTimeout(resolve,1000));
    assert.ok(await evaluate(`(()=>{const buttons=[...document.querySelectorAll('button')];return buttons.find(b=>b.textContent==='Centros de custo').parentElement===buttons.find(b=>b.textContent==='Preferências').parentElement})()`),'Centros de custo junto das preferências');
    await command('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
    const initial=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'livros.png'),Buffer.from(initial.data,'base64'));
    await click('Equipes base');
    await click('São Bento');
    assert.ok(await evaluate("document.querySelector('table thead').textContent.includes('Família')"));
    assert.equal(await evaluate("document.querySelector('table tbody').rows.length"),1,'Cada família é uma linha');
    assert.ok(await evaluate("document.querySelector('table tbody tr').cells[0].textContent.includes('Ana e Bruno')"));
    assert.ok(await evaluate("!document.querySelector('table tbody tr').textContent.includes('09/10/2026')"));
    assert.equal(await evaluate("getComputedStyle(document.querySelector('table tbody tr .ledger-payment-value')).backgroundColor"),'rgb(252, 231, 243)','Janeiro recebido em outubro fica rosa');
    assert.ok(await evaluate("![...document.querySelectorAll('[role=tab]')].some(t=>t.textContent==='Geral')"));
    await evaluate(`(()=>{const input=document.querySelector('[aria-label="Organização dos meses"]');input.value='cash';input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await pause();
    assert.ok(await evaluate("document.querySelector('table tbody tr').cells[1].textContent.includes('0,00')"));
    assert.ok(await evaluate("document.querySelector('table tbody tr').cells[10].textContent.includes('15,00')"),'Valor entra em outubro, não janeiro');
    await evaluate(`(()=>{const input=document.querySelector('[aria-label="Organização dos meses"]');input.value='reference';input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await pause();
    for(const width of [320,390,768,1366]){
      await command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await pause();
      assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"),'Tabela rola dentro da tela: '+width);
      await evaluate("document.querySelector('.ledger-family-matrix').scrollIntoView({block:'start'})");await pause();
      const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'matriz-'+width+'.png'),Buffer.from(shot.data,'base64'));
    }
    await evaluate("document.querySelector('[aria-label^=\"Receber Fevereiro de Ana e Bruno:\"]').click()");await pause();
    assert.ok(await evaluate("document.querySelector('[role=dialog]').textContent.includes('Confirmar recebimento')"));
    await evaluate("[...document.querySelectorAll('.ui-modal-actions button')].find(b=>b.textContent.includes('Confirmar')).click()");await new Promise(resolve=>setTimeout(resolve,400));
    assert.equal(await evaluate('window.fixtureWrites'),2,'Recebe o casal com a mesma lógica da tesouraria');
    assert.ok(await evaluate("document.querySelector('table tbody tr').cells[2].textContent.includes('30,00')"));
    await click('Histórico');
    assert.equal(await evaluate("document.querySelector('[role=dialog] table tbody').rows.length"),2,'As duas parcelas de fevereiro viram uma linha do casal');
    assert.ok(await evaluate("document.querySelector('[role=dialog] table tbody').textContent.includes('Ana e Bruno')"));
    assert.ok(await evaluate("document.querySelector('[role=dialog] table tbody').textContent.includes('30,00')"));
    await command('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});await pause();
    assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"),'Histórico responsivo');
    const historyShot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'historico-390.png'),Buffer.from(historyShot.data,'base64'));
    await click('Fechar');
    await command('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await pause();
    await click('Recebimentos');
    assert.equal(await evaluate("document.querySelector('table tbody').rows.length"),2,'Recebimentos também agrupam o casal');
    await click('Mês a mês');
    await click('São Lázaro');
    assert.equal(await evaluate("document.querySelector('table tbody').rows.length"),1);
    assert.ok(await evaluate("document.querySelector('table tbody').textContent.includes('Carlos')"));
    await click('Exportar equipes · 2026');
    assert.ok(await evaluate("document.querySelector('[role=dialog]').textContent.includes('Todas as equipes do ano')"));
    console.log('Abas por equipe, matriz e histórico por casal, quitação, exportação e responsividade: OK');
    console.log('Capturas: '+output);
  } finally { socket?.close(); chrome.kill(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
