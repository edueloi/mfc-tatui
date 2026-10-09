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
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'mfc-ui-extended-'));
  const script = await require('esbuild').build({ absWorkingDir: root, stdin: { contents: "\nimport React from 'react'; import {createRoot} from 'react-dom/client';\nimport {Calendar} from './components/ui/Calendar'; import {DatePicker} from './components/ui/DatePicker';\nimport {Combobox} from './components/ui/Combobox'; import {Switch} from './components/ui/Switch';\nimport {Pagination} from './components/ui/Pagination'; import {FileUpload} from './components/ui/FileUpload';\nimport {TokenTextarea} from './components/ui/TokenTextarea'; import {RichTextEditor} from './components/ui/RichTextEditor';\nimport {Badge} from './components/ui/Badge'; import {DetailField} from './components/ui/DetailField';\nimport {PaymentModal} from './components/ui/PaymentModal';\nwindow.fixture={submits:0,uploads:0,removed:0,paid:0};\nfunction Fixture(){\n const [date,setDate]=React.useState('2026-10-01'),[selected,setSelected]=React.useState(''),[checked,setChecked]=React.useState(false),[page,setPage]=React.useState(1);\n const [content,setContent]=React.useState('<p>Antes <span>trecho</span> depois</p>'),[token,setToken]=React.useState('Olá {{nome}}'),[payment,setPayment]=React.useState(false);\n return <main className=\"space-y-4 p-4 max-w-3xl mx-auto\">\n <form onSubmit={e=>{e.preventDefault();window.fixture.submits++}}><Calendar/></form>\n <div id=\"date\"><DatePicker label=\"Data\" value={date} onChange={setDate}/></div>\n <Combobox options={[{value:'superior',label:'Superior'},{value:'medio',label:'Ensino médio'}]} value={selected} onChange={setSelected}/>\n <output id=\"selection\">{selected}</output><Switch aria-label=\"Publicar\" checked={checked} onCheckedChange={setChecked}/>\n <Pagination total={60} page={page} pageSize={15} onPageChange={setPage} onPageSizeChange={()=>{}}/>\n <FileUpload label=\"Anexos\" files={[{id:'photo',fileName:'Foto da ação.png'}]} onUpload={()=>{window.fixture.uploads++}} onRemove={()=>{window.fixture.removed++}}/>\n <TokenTextarea value={token} onChange={setToken}/><Badge color=\"primary\">Publicado</Badge><dl><DetailField label=\"Descrição\" value=\"Ação\"/></dl>\n <RichTextEditor value={content} onChange={setContent}/><button id=\"pay\" onClick={()=>setPayment(true)}>Pagamento</button>\n <PaymentModal isOpen={payment} onClose={()=>setPayment(false)} comanda={{id:'fixture',total:30,paidAmount:0,client:{name:'Casal de teste'}}} onConfirm={async(method,details)=>{window.fixture.paid=details.totalPaying}}/>\n </main>\n}\ncreateRoot(document.getElementById('root')).render(<Fixture/>);\n", resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' } });
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


    for(let n=0;n<50;n++){if(await evaluate("!!document.querySelector('#pay')"))break;await pause();}
    await new Promise(resolve=>setTimeout(resolve,1000));
    const setInput=async(label,value)=>{
      await evaluate('(()=>{const label=[...document.querySelectorAll("label")].find(el=>el.textContent==='+JSON.stringify(label)+');const input=document.getElementById(label.htmlFor);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,'+JSON.stringify(value)+');input.dispatchEvent(new Event("input",{bubbles:true}));})()');await pause();
    };
    await evaluate("document.querySelector('[aria-label=\"Próximo mês\"]').click()");await pause();
    assert.equal(await evaluate('window.fixture.submits'),0,'Navegar no calendário não envia o formulário');
    await evaluate("document.querySelector('[role=switch]').click()");await pause();
    assert.equal(await evaluate("document.querySelector('[role=switch]').getAttribute('aria-checked')"),'true');
    await evaluate("document.querySelector('[role=combobox]').click()");await pause();
    await evaluate("[...document.querySelectorAll('[data-ui-popover] button')].find(el=>el.textContent.trim()==='Superior').click()");await pause();
    assert.equal(await evaluate("document.querySelector('#selection').textContent"),'superior');
    await evaluate("document.querySelector('[aria-label=\"Próxima página\"]').click()");await pause();
    assert.ok(await evaluate("document.querySelector('.ui-pagination').textContent.includes('16–30 de 60')"));
    await evaluate("document.querySelector('[aria-label=\"Remover Foto da ação.png\"]').click()");await pause();
    assert.equal(await evaluate('window.fixture.removed'),1);
    await evaluate("(()=>{const files=new DataTransfer();files.items.add(new File(['teste'],'ação.png',{type:'image/png'}));const input=document.querySelector('input[type=file]');input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()");await pause();
    assert.equal(await evaluate('window.fixture.uploads'),1);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.token-chip')).fontWeight"),'500');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.token-chip')).backgroundColor"),'rgb(239, 246, 255)');
    for(const width of [320,390,768,1366]){
      await command('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:false});await pause();
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Página sem estouro: '+width);
      await evaluate("document.querySelector('#date input').click()");await pause();
      assert.ok(await evaluate("!!document.querySelector('[title=\"Feriado nacional\"]')"));
      assert.ok(await evaluate("(()=>{const r=document.querySelector('.ui-date-popover').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})()"),'Calendário dentro da tela');
      await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await pause();
      assert.ok(await evaluate("!document.querySelector('.ui-date-popover')"),'Escape fecha apenas o calendário');
      await evaluate("document.querySelector('[title=\"Inserir imagem\"]').click()");await pause();
      assert.equal(await evaluate("document.querySelector('.ui-modal-title').textContent"),'Inserir imagem');
      assert.ok(await evaluate("document.querySelector('.ui-modal-body').scrollWidth<=document.querySelector('.ui-modal-body').clientWidth"),'Modal de imagem sem estouro: '+width);
      const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'image-dialog-'+width+'.png'),Buffer.from(shot.data,'base64'));
      await click('Cancelar');
    }
    // O diálogo pode receber foco sem perder a posição da seleção no texto.
    await evaluate("(()=>{const editor=document.querySelector('.rich-editor-content');editor.focus();const range=document.createRange();range.selectNodeContents(editor.querySelector('span'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);document.querySelector('[title=\"Inserir hiperlink\"]').click();})()");await pause();
    await setInput('Endereço do link','javascript:alert(1)');
    assert.ok(await evaluate("[...document.querySelectorAll('.ui-modal-actions button')].find(el=>el.textContent==='Inserir link').disabled"));
    await setInput('Endereço do link','https://example.com/ação');
    await setInput('Texto do link','Ação & famílias');
    await click('Inserir link');
    assert.equal(await evaluate("document.querySelector('.rich-editor-content a').textContent"),'Ação & famílias');
    assert.equal((await evaluate("document.querySelector('.rich-editor-content').textContent")).replaceAll('\u00a0',' '),'Antes Ação & famílias depois');
    await evaluate("document.querySelector('[title=\"Inserir imagem\"]').click()");await pause();
    await setInput('Endereço da imagem','data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    await setInput('Descrição da imagem','Ação com \"famílias\"');
    await click('Inserir imagem');
    assert.equal(await evaluate("document.querySelector('.rich-editor-content img').alt"),'Ação com \"famílias\"');
    await evaluate("document.querySelector('#pay').click()");await pause();
    assert.equal(await evaluate("document.querySelector('.ui-modal-title').textContent"),'Finalizar pagamento');
    await click('Confirmar pagamento');
    assert.equal(await evaluate('window.fixture.paid'),30,'Valores do pagamento preservados');
    assert.ok(await evaluate("!document.querySelector('[role=dialog]')"));
    console.log('UI complementar: calendário, seleção, paginação, anexos, variáveis, editor e pagamento OK');
    console.log('Capturas: '+output);
  } finally { socket?.close(); chrome.kill(); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
