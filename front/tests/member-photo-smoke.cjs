const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrZkAAAAASUVORK5CYII=', 'base64');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let uploads = 0;
    let saved;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://localhost:4000/**', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname === '/member-photos') {
        uploads++;
        assert.match(req.headers()['content-type'], /multipart\/form-data/);
        assert.ok(req.postDataBuffer().includes(png));
        return route.fulfill({ status: 201, json: { photoUrl: '/uploads/members/test-photo.png' } });
      }
      if (url.pathname === '/members' && req.method() === 'POST') {
        saved = { ...req.postDataJSON(), id: 'test-photo-member' };
        return route.fulfill({ status: 201, json: saved });
      }
      if (url.pathname === '/uploads/members/test-photo.png') return route.fulfill({ contentType: 'image/png', body: png });
      assert.equal(req.method(), 'GET', 'Não deve haver outras alterações de dados.');
      return route.fulfill({ json: url.pathname === '/members' && saved ? [saved] : [] });
    });
    await page.addInitScript(() => localStorage.setItem('mfc.currentUser', JSON.stringify({ id: 'test', name: 'Teste', role: 'Administrador' })));
    await page.goto('http://localhost:3000/mfcistas/novo');
    assert.equal(await page.getByLabel('URL da Foto').count(), 0);
    const input = page.getByLabel('Selecionar foto do MFCista');
    await input.setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png });
    await page.getByAltText('Foto do MFCista').waitFor();
    assert.equal(uploads, 0, 'Selecionar não envia antes de salvar.');
    await page.getByRole('button', { name: 'Remover foto' }).click();
    assert.equal(await page.getByAltText('Foto do MFCista').count(), 0);
    await input.setInputFiles({ name: 'texto.txt', mimeType: 'text/plain', buffer: Buffer.from('texto') });
    await page.getByRole('alert').waitFor();
    await input.setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png });
    await page.getByLabel('Nome Completo').fill('MFCista Teste');
    await page.getByRole('button', { name: 'Salvar Alterações' }).click();
    await page.waitForURL('**/mfcistas');
    assert.equal(uploads, 1);
    assert.equal(saved.photoUrl, '/uploads/members/test-photo.png');
    await page.goto('http://localhost:3000/mfcistas/test-photo-member/editar');
    await page.getByAltText('Foto do MFCista').waitFor();
    await page.waitForFunction(() => { const img = document.querySelector('img[alt="Foto do MFCista"]'); return img?.complete && img.naturalWidth > 0; });
    assert.deepEqual(errors, []);
    console.log('OK: seleção, prévia, remoção, validação, envio ao salvar e foto recarregada no cadastro.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
