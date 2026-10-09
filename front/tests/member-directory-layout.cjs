// Verificação isolada: usa dados fictícios e nunca altera cadastros do backend.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

async function run() {
  const root = path.resolve(__dirname, '..');
  const nucleation = process.argv.includes('--nucleation');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'mfc-members-layout-'));
  const fixture = Array.from({ length: 92 }, (_, index) => ({ id: String(index), name: index === 0 ? 'Ana Maria da Conceição de Albuquerque e Silva' : `MFCista ${String(index).padStart(3, '0')}`, gender: 'Feminino', phone: '(15) 99999-1234', dob: '1990-01-10', mfcDate: '2020-01-10', status: index % 3 ? 'Ativo' : 'Aguardando', teamId: 'team', profession: index === 0 ? 'Especialista em desenvolvimento e acompanhamento de projetos comunitários' : 'Professora', cpf: '' }));
  const contacts = fixture.map((member, index) => ({ id: member.id, name: member.name, phone1: member.phone, phone2: '(15) 99999-4321', status: index % 2 ? 'Pendente' : 'Em Andamento', groupId: 'group0', groupName: 'Grupo Nossa Senhora das Famílias e da Comunidade', attemptsCount: index }));
  const groups = Array.from({ length: 24 }, (_, i) => ({ id: `group${i}`, name: `Grupo ${i} — Nossa Senhora das Famílias e da Comunidade`, contactsCount: i === 0 ? 92 : 0 }));
  const result = await require('esbuild').build({ absWorkingDir: root, stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter} from 'react-router-dom'; import Screen from './views/${nucleation ? 'Nucleacao' : 'Members'}'; localStorage.setItem('mfc.currentUser',JSON.stringify({role:'Teste'})); createRoot(document.getElementById('root')).render(<MemoryRouter><Screen /></MemoryRouter>);`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixture-api', setup(build) { build.onLoad({ filter: /[\\/]api\.ts$/ }, () => ({ contents: `const members=${JSON.stringify(fixture)},contacts=${JSON.stringify(contacts)},groups=${JSON.stringify(groups)}; window.fixtureWrites=0; export const api = { getRoles: async () => [{name:'Teste',isSystem:true}],getMembers: async () => members, getTeams: async () => [{id:'team',name:'Equipe Nossa Senhora das Famílias e da Comunidade',city:'Tatuí',state:'SP'}],getNucleationContacts:async()=>contacts,getNucleationGroups:async()=>groups,getNucleationGroup:async id=>({...groups.find(g=>g.id===id),contacts: id==='group0'?contacts:[],history:[]}),updateMember:async(id,data)=>{window.fixtureWrites++;return {...members.find(m=>m.id===id),...data}} };`, loader: 'js' })); } }] });
  fs.writeFileSync(path.join(output, 'app.js'), result.outputFiles[0].contents);
  fs.writeFileSync(path.join(output, 'tailwind.js'), await (await fetch('https://cdn.tailwindcss.com', { signal: AbortSignal.timeout(10000) })).text());
  fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="tailwind.js"></script><link rel="stylesheet" href="${pathToFileURL(path.join(root, 'index.css'))}"><body style="background:#f8fafc;padding:0 12px"><div id="root"></div><script src="app.js"></script></body></html>`);
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve));
  const chrome = spawn(process.env.MFC_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(output, 'chrome')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    let tabs;
    for (let attempt = 0; attempt < 40; attempt++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await new Promise(resolve => setTimeout(resolve, 150)); } }
    assert.ok(tabs?.length, 'Chrome deve iniciar');
    socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let sequence = 0; const pending = new Map();
    socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.method === 'Runtime.exceptionThrown') console.error(message.params.exceptionDetails); if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); } });
    const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, message => message.error ? reject(Error(message.error.message)) : resolve(message.result)); socket.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => (await command('Runtime.evaluate', { expression, returnByValue: true })).result.value;
    await command('Page.enable');
    await command('Runtime.enable');
    await command('Page.navigate', { url: pathToFileURL(path.join(output, 'index.html')).href });
    for (let attempt = 0; attempt < 60; attempt++) { if (await evaluate(`!!document.querySelector('.member-identity') && getComputedStyle(document.querySelector('.space-y-4')).display === 'block' && getComputedStyle(document.querySelector('.member-mobile-heading')).display === 'flex' && getComputedStyle(document.querySelector('table')).width !== 'auto'`)) break; await new Promise(resolve => setTimeout(resolve, 200)); }
    // Espera a folha utilitária do ambiente de desenvolvimento.
    await new Promise(resolve => setTimeout(resolve, 1500));
    for (const width of [320, 390, 768, 1024, 1366, 1920]) {
      await command('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false });
      await new Promise(resolve => setTimeout(resolve, 150));
      const dimensions = await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,cards:[...document.querySelectorAll('.member-mobile-card')].filter(e=>e.getClientRects().length).length,table:!!document.querySelector('table').getClientRects().length})`);
      assert.ok(dimensions.scroll <= width, `Sem estouro horizontal: ${JSON.stringify(dimensions)}`);
      assert.equal(dimensions.table, width >= 1280);
      assert.equal(dimensions.cards > 0, width < 1280);
      console.log(JSON.stringify(dimensions));
      if (width === 390 || width === 1366) { const screenshot = await command('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, `${width}.png`), Buffer.from(screenshot.data, 'base64')); }
    }
    await evaluate(`document.querySelector('[aria-label="Última página"]').click()`);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(await evaluate(`document.body.textContent.includes('91–92 de 92')`), 'Paginação mantém os últimos registros acessíveis');
    if (!nucleation) {
      await evaluate(`document.querySelector('[aria-controls="member-advanced-filters"]').click()`);
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.ok(await evaluate(`!!document.getElementById('member-advanced-filters')`));
      await evaluate(`document.querySelector('[aria-label^="Gerenciar equipe de"]').click()`);
      await new Promise(resolve => setTimeout(resolve, 150));
      assert.ok(await evaluate(`document.querySelector('[role="dialog"]').textContent.includes('Equipe de destino')`));
      assert.equal(await evaluate('window.fixtureWrites'), 0, 'Abrir o modal não altera o cadastro');
      await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 820, deviceScaleFactor: 1, mobile: false });
      const screenshot = await command('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, 'modal.png'), Buffer.from(screenshot.data, 'base64'));
      await evaluate(`document.querySelector('[role="dialog"] [role="combobox"]').click()`);
      await new Promise(resolve => setTimeout(resolve, 100));
      await evaluate(`[...document.querySelectorAll('[data-ui-popover] button')].find(button=>button.textContent.includes('Sem equipe')).click()`);
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(await evaluate('window.fixtureWrites'), 0, 'Selecionar destino ainda não grava');
      await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent.includes('Salvar alterações')).click()`);
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(await evaluate('window.fixtureWrites'), 1, 'Salvar grava somente uma vez no backend fictício');
      assert.ok(await evaluate(`!document.querySelector('[role="dialog"]')`));
    } else {
      assert.equal(await evaluate(`document.querySelector('[aria-label="Grupo de nucleação"]').options.length`), 25);
    }
    await command('Emulation.setTouchEmulationEnabled', { enabled: true });
    await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 820, deviceScaleFactor: 1, mobile: true });
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('input')).fontSize`), '16px', 'Campo de busca legível com ponteiro de toque');
    console.log('Prévia e capturas: ' + output);
  } finally { socket?.close(); chrome.kill(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
