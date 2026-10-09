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
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'mfc-blog-layout-'));
  const posts = Array.from({ length: 31 }, (_, i) => ({ id: String(i), title: i ? `História ${i} — Encontro das famílias` : 'Ação comunitária das famílias de Nossa Senhora da Conceição', excerpt: 'Momentos da comunidade, partilha e convivência entre as famílias.', content: '<p>Uma história de união.</p>', published: i % 2 === 0, featured: i === 0, images: [], coverImage: '', updatedAt: '2026-10-09', createdAt: '2026-10-01' }));
  const script = await require('esbuild').build({ absWorkingDir: root, stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Blog from './views/BlogManagement';createRoot(document.getElementById('root')).render(<Blog/>);`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'mock-api', setup(build) { build.onLoad({ filter: /[\\/]api\.ts$/ }, () => ({ loader: 'js', contents: `let posts=${JSON.stringify(posts)};window.fixtureWrites=0;export const photoSrc=value=>value;export const api={getBlogPosts:async()=>structuredClone(posts),createBlogPost:async data=>{window.fixtureWrites++;const item={...data,id:'new',images:[]};posts.push(item);return item},updateBlogPost:async(id,data)=>{window.fixtureWrites++;const index=posts.findIndex(p=>p.id===id);posts[index]={...posts[index],...data};return structuredClone(posts[index])}};` })); } }] });
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
    const changeTitle = async value => { await evaluate(`(()=>{const input=document.querySelector('.blog-editor-area input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`); await pause(); };
    await command('Page.enable');
    await command('Page.navigate', { url: pathToFileURL(path.join(output, 'index.html')).href });
    for (let n = 0; n < 50; n++) { if (await evaluate(`!!document.querySelector('.blog-post-link')`)) break; await pause(); }
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal(await evaluate(`!!document.querySelector('[contenteditable="true"]')`), false, 'A lista não abre o editor automaticamente');
    await click('Destaques (1)');
    assert.equal(await evaluate(`document.querySelector('table tbody').rows.length`), 1);
    await click('Rascunhos (15)');
    assert.equal(await evaluate(`document.querySelector('table tbody').rows.length`), 15);
    await click('Publicações (31)');
    for (const width of [320, 390, 768, 1024, 1366]) {
      await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false }); await pause();
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `Lista sem estouro a ${width}px`);
      if (width === 1366) { const shot = await command('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, 'lista.png'), Buffer.from(shot.data, 'base64')); }
    }
    await click('Nova publicação');
    assert.ok(await evaluate(`!!document.querySelector('[contenteditable="true"]')`));
    assert.equal(await evaluate(`!![...document.querySelectorAll('.blog-post-link')].find(element=>element.getClientRects().length)`), false, 'Sem lista lateral enquanto edita');
    await changeTitle('História de teste com acentuação');
    await evaluate(`(()=>{const editor=document.querySelector('[contenteditable="true"]');editor.innerHTML='<p>Uma ação de união entre famílias.</p>';editor.dispatchEvent(new Event('input',{bubbles:true}));})()`); await pause();
    await click('Galeria (0)'); await click('Conteúdo');
    assert.equal(await evaluate(`document.querySelector('.blog-editor-area input').value`), 'História de teste com acentuação');
    assert.ok(await evaluate(`document.querySelector('[contenteditable="true"]').textContent.includes('Uma ação de união entre famílias.')`));
    await click('Voltar às publicações');
    assert.ok(await evaluate(`document.querySelector('[role="dialog"]').textContent.includes('Sair sem salvar?')`));
    await click('Cancelar');
    await click('Salvar alterações');
    assert.equal(await evaluate('window.fixtureWrites'), 1);
    assert.ok(await evaluate(`document.querySelector('.blog-editor-status').textContent.includes('Alterações salvas')`));
    for (const width of [320, 390, 768, 1024, 1366]) {
      await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false }); await pause();
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `Editor sem estouro a ${width}px`);
      const shot = await command('Page.captureScreenshot', { format: 'png' }); if (width === 390 || width === 1366) fs.writeFileSync(path.join(output, `editor-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
    for (const section of ['Galeria (0)', 'Publicação']) {
      await click(section);
      for (const width of [320, 390, 768, 1366]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false }); await pause();
        assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `${section} sem estouro a ${width}px`);
      }
    }
    await click('Voltar às publicações');
    assert.equal(await evaluate(`!!document.querySelector('[role="dialog"]')`), false);
    await click('Rascunhos (16)');
    assert.equal(await evaluate('window.fixtureWrites'), 1);
    console.log('Abas, criação, edição, troca de seções, aviso de saída e responsividade: OK');
    console.log('Capturas: ' + output);
  } finally { socket?.close(); chrome.kill(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
