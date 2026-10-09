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
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'mfc-receipt-layout-'));
  const script = await require('esbuild').build({ absWorkingDir: root, stdin: { contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {FamilyPaymentModal} from './components/FamilyPaymentModal';
const year=new Date().getFullYear();
const unit={key:'fixture',type:'couple',displayName:'Bruno & Juliana',payingMembers:[{id:'a',name:'Bruno da Conceição de Albuquerque'},{id:'b',name:'Juliana da Conceição de Albuquerque'}],exemptMembers:[],amountPerPerson:15,monthlyTotal:30};
const initial=[{id:'1',memberId:'a',referenceMonth:'1/'+year,status:'Pago',date:year+'-01-09'},{id:'2',memberId:'b',referenceMonth:'1/'+year,status:'Pago',date:year+'-01-09'},{id:'3',memberId:'a',referenceMonth:'2/'+year,status:'Pago',date:year+'-02-09'}];
function Fixture(){const [payments,setPayments]=React.useState(initial);return <FamilyPaymentModal isOpen unit={unit} teamId="team" userId="user" payments={payments} defaultMonth={10} defaultYear={year} onClose={()=>window.fixtureClosed=true} onSaved={created=>setPayments(old=>[...old,...created])}/>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'mock-api', setup(build) { build.onLoad({ filter: /api\.ts$/ }, () => ({ loader: 'js', contents: `window.fixtureRequests=[];export const api={createPayment:async data=>{window.fixtureRequests.push(data);await new Promise(resolve=>setTimeout(resolve,200));return {...data,id:String(window.fixtureRequests.length)}}};` })); } }] });
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
    for (let n = 0; n < 50; n++) { if (await evaluate(`!!document.querySelector('.receipt-month')`)) break; await pause(); }
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal(await evaluate('window.fixtureRequests.length'), 0);
    assert.equal(await evaluate("document.querySelector('.receipt-month').disabled"), true, 'Janeiro já está quitado');
    assert.ok(await evaluate("document.querySelectorAll('.receipt-month')[1].textContent.includes('15,00')"), 'Parcial cobra só o contribuinte pendente');
    assert.ok(await evaluate("document.querySelector('.receipt-summary').textContent.includes('30,00')"));
    await evaluate("document.querySelectorAll('.receipt-month')[1].click()"); await pause();
    assert.ok(await evaluate("document.querySelector('.receipt-summary').textContent.includes('45,00')"));
    for (const width of [320, 390, 768, 1366]) {
      await command('Emulation.setDeviceMetricsOverride', { width, height: width < 400 ? 740 : 900, deviceScaleFactor: 1, mobile: false }); await pause();
      assert.ok(await evaluate(`(()=>{const body=document.querySelector('.ui-modal-body');return body.scrollWidth<=body.clientWidth && document.documentElement.scrollWidth<=innerWidth})()`), 'Sem estouro horizontal: '+width);
      assert.ok(await evaluate("document.querySelector('.ui-modal-actions').getBoundingClientRect().bottom<=innerHeight"), 'Confirmação acessível no rodapé');
      const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'modal-'+width+'.png'),Buffer.from(shot.data,'base64'));
    }
    await command('Emulation.setTouchEmulationEnabled',{enabled:true});
    assert.equal(await evaluate("getComputedStyle(document.querySelector('input')).fontSize"), '16px');
    await click('Limpar seleção');
    assert.ok(await evaluate("[...document.querySelectorAll('.ui-modal-actions button')].find(b=>b.textContent.includes('Confirmar')).disabled"));
    await evaluate("document.querySelectorAll('.receipt-month')[1].click()"); await pause();
    await evaluate(`(()=>{const input=document.querySelector('input[type=date]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2099-01-01');input.dispatchEvent(new Event('input',{bubbles:true}));})()`); await pause();
    assert.ok(await evaluate("[...document.querySelectorAll('.ui-modal-actions button')].find(b=>b.textContent.includes('Confirmar')).disabled"), 'Data futura bloqueia confirmação');
    await evaluate(`(()=>{const input=document.querySelector('input[type=date]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,input.max);input.dispatchEvent(new Event('input',{bubbles:true}));})()`); await pause();
    await evaluate("[...document.querySelectorAll('.ui-modal-actions button')].find(b=>b.textContent.includes('Confirmar')).click()");
    await pause();
    assert.ok(await evaluate("document.querySelector('fieldset').disabled"), 'Bloqueia alterações durante o envio');
    await new Promise(resolve=>setTimeout(resolve,400));
    const requests=await evaluate('window.fixtureRequests');
    assert.equal(requests.length,1,'Somente o contribuinte que falta é lançado');
    assert.equal(requests[0].amount,15);
    assert.equal(requests[0].memberId,'b');
    assert.equal(requests[0].method,'pix');
    assert.ok(requests[0].referenceMonth.startsWith('2/'));
    assert.equal(await evaluate('window.fixtureClosed'),true);
    console.log('Seleção, valores parciais, data, confirmação e layout responsivo: OK');
    console.log('Capturas: '+output);
  } finally { socket?.close(); chrome.kill(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
