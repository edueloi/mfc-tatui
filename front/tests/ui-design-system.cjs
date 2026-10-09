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
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'mfc-ui-contract-'));
  const script = await require('esbuild').build({ absWorkingDir: root, stdin: { contents: "\nimport React from 'react'; import {createRoot} from 'react-dom/client';\nimport toast from 'react-hot-toast'; import {BookOpen} from 'lucide-react';\nimport {Button, IconButton} from './components/ui/Button'; import {ContentCard} from './components/ui/PageWrapper'; import {PanelCard} from './components/ui/PanelCard'; import {StatCard} from './components/ui/StatCard'; import {GridTable} from './components/ui/GridTable'; import {Input} from './components/ui/Input'; import {Alert} from './components/ui/Alert'; import {Modal, ModalFooter} from './components/ui/Modal'; import {ToastProvider, useToast} from './components/ui/Toast';\nfunction Fixture(){\n const [open,setOpen]=React.useState(false);const notify=useToast();\n return <main className=\"space-y-4 p-4\">\n <ContentCard data-testid=\"card\"><Input label=\"Descrição\" placeholder=\"Ação comunitária\" />\n <div className=\"mt-3 flex flex-wrap gap-2\">{['primary','secondary','outline','ghost','danger','success'].map(variant=><Button key={variant} data-variant={variant} variant={variant}>Ação</Button>)}\n <IconButton aria-label=\"Livro\"><BookOpen/></IconButton><Button disabled>Desativado</Button></div></ContentCard>\n <PanelCard title=\"Publicações\"><Button id=\"open\" onClick={()=>setOpen(true)}>Abrir modal</Button></PanelCard>\n <StatCard title=\"Saldo\" value=\"R$ 30,00\" icon={BookOpen} />\n <GridTable data={[{id:'1',name:'Eduardo e Karen'}]} columns={[{header:'Família',accessor:'name'}]} keyExtractor={row=>row.id}/>\n <Alert title=\"Atenção\" variant=\"warning\">Confira a informação.</Alert>\n <Alert variant=\"error\">Não foi possível concluir a ação.</Alert>\n <Button id=\"notify\" onClick={()=>notify.success('Alteração salva')}>Notificar</Button>\n <Button id=\"legacy\" onClick={()=>toast.error('Falha de teste')}>Notificação existente</Button>\n <Modal isOpen={open} onClose={()=>setOpen(false)} title=\"Confirmação\" footer={<ModalFooter><Button onClick={()=>setOpen(false)}>Fechar</Button></ModalFooter>}>\n <Input label=\"Observação\" /><p>Ação, São Bento e Tatuí.</p></Modal>\n </main>\n}\ncreateRoot(document.getElementById('root')).render(<ToastProvider><ToastProvider><Fixture/></ToastProvider></ToastProvider>);\n", resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' } });
  fs.writeFileSync(path.join(output, 'app.js'), script.outputFiles[0].contents);
  fs.writeFileSync(path.join(output, 'tailwind.js'), await (await fetch('https://cdn.tailwindcss.com', { signal: AbortSignal.timeout(10000) })).text());
  fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="tailwind.js"></script><link rel="stylesheet" href="${pathToFileURL(path.join(root, 'components/ui/styles.css'))}"><body style="background:#f8fafc;padding:0 12px"><div id="root"></div><script src="app.js"></script></body></html>`);
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

    for (let n=0;n<50;n++){if(await evaluate("!!document.querySelector('#open')"))break;await pause();}
    await new Promise(resolve=>setTimeout(resolve,1000));
    const style=async(selector,property)=>evaluate('getComputedStyle(document.querySelector('+JSON.stringify(selector)+'))['+JSON.stringify(property)+']');
    await command('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await pause();
    assert.equal(await style('[data-variant=primary]','height'),'32px');
    assert.equal(await style('[data-variant=primary]','backgroundColor'),'rgb(37, 99, 235)');
    assert.equal(await style('[data-variant=primary]','fontWeight'),'500');
    assert.equal(await style('[data-testid=card]','borderRadius'),'8px');
    assert.equal(await style('[data-testid=card]','borderColor'),'rgb(226, 232, 240)');
    assert.equal(await style('label','fontSize'),'12px');
    assert.equal(await style('th','fontSize'),'10px');
    assert.equal(await style('th','fontWeight'),'500');
    assert.equal(await evaluate("document.querySelectorAll('[data-variant]').length"),6);
    assert.ok(await evaluate("document.querySelector('button[disabled]').disabled"));
    assert.equal(await evaluate("document.querySelector('[role=alert]').textContent"),'Não foi possível concluir a ação.');
    // As duas APIs usam um único host, mesmo com um provider aninhado.
    await evaluate("document.querySelector('#notify').click()");await pause();
    assert.equal(await evaluate("document.querySelectorAll('[role=status]').length"),2);
    assert.ok(await evaluate("[...document.querySelectorAll('[role=status]')].some(el=>el.textContent==='Alteração salva')"));
    await evaluate("document.querySelector('#legacy').click()");await pause();
    assert.ok(await evaluate("[...document.querySelectorAll('[role=status]')].some(el=>el.textContent==='Falha de teste')"));
    for(const width of [320,390,768,1366]){
      await command('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:false});await pause();
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Sem estouro: '+width);
      await evaluate("document.querySelector('#open').focus();document.querySelector('#open').click()");await pause();
      assert.equal(await style('.ui-modal','borderRadius'),'0px');
      assert.equal(await style('.ui-modal-title','fontSize'),'14px');
      assert.equal(await style('.ui-modal-title','fontWeight'),'600');
      assert.ok(await evaluate("(()=>{const r=document.querySelector('.ui-modal').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()"));
      assert.equal(await style('.ui-modal-body','paddingTop'),width<640?'12px':'16px');
      const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'ui-'+width+'.png'),Buffer.from(shot.data,'base64'));
      await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await pause();
      assert.ok(await evaluate("!document.querySelector('[role=dialog]')"));
      assert.equal(await evaluate("document.activeElement.id"),'open');
    }
    await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await evaluate("document.querySelector('#open').click()");await pause();
    assert.equal(await style('.ui-modal','animationName'),'none');
    console.log('UI isolada: padrão visual, UTF-8, variantes, notificações, modal e responsividade OK');
    console.log('Capturas: '+output);
  } finally { socket?.close(); chrome.kill(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
