const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const member = { id: 'test-1', name: 'Ana Teste', nickname: 'Ana', familyName: 'Teste', relationshipType: 'Titular', status: 'Ativo', teamId: 'test-team', paysMonthly: true, dob: '1990-01-01', mfcDate: '2020-01-01', street: 'Rua de exemplo', number: '100', neighborhood: 'Centro', city: 'Tatuí', state: 'SP', phone: '1532590683', movementRoles: [] };
  await page.route('http://localhost:4000/**', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') throw new Error('O teste não deve alterar dados.');
    const data = { '/members': [member, { ...member, id: 'test-2', name: 'João Teste', nickname: 'João', relationshipType: 'Cônjuge' }], '/teams': [{ id: 'test-team', name: 'Equipe de teste', city: 'Tatuí', state: 'SP' }], '/cities': [{ id: '1', name: 'Tatuí', uf: 'SP' }], '/config': { monthlyPaymentAmount: 45 }, '/payments': [], '/event-sales': [], '/events': [] };
    if (url.pathname.startsWith('/api/cep/')) {
      const cep = url.pathname.split('/').pop();
      if (cep === '18270400') await new Promise(resolve => setTimeout(resolve, 900));
      return route.fulfill({ json: { cep, logradouro: cep === '18270400' ? 'Rua anterior' : 'Rua atual', bairro: 'Centro', localidade: 'Tatuí', uf: 'SP', complemento: '' } });
    }
    return route.fulfill({ json: data[url.pathname] || [] });
  });
  await page.addInitScript(() => localStorage.setItem('mfc.currentUser', JSON.stringify({ id: 'test-user', name: 'Teste', role: 'Administrador', teamId: 'test-team', cityId: '1' })));
  await page.goto('http://localhost:3000/minha-equipe');
  await page.getByText('Ana & João', { exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  assert.equal(await dialog.evaluate(el => getComputedStyle(el).borderRadius), '0px');
  await page.locator('.ui-modal-actions').getByRole('button', { name: 'Lançar Mensalidade' }).waitFor();
  const artifacts = path.join(__dirname, 'artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  await page.screenshot({ path: path.join(artifacts, 'family-desktop.png'), animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Editar', exact: true }).click();
  assert.equal(await page.getByRole('dialog').count(), 2);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 1);
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await dialog.boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 391);
  assert.ok(box.y >= 0 && box.y + box.height <= 845);
  await page.screenshot({ path: path.join(artifacts, 'family-mobile.png') });
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');

  await page.goto('http://localhost:3000/mfcistas/novo');
  await page.getByRole('button', { name: 'Endereço', exact: true }).click();
  const cep = page.getByLabel('CEP', { exact: true });
  await cep.fill('18270400');
  await page.waitForRequest('**/api/cep/18270400');
  await cep.fill('18270000');
  await page.getByLabel('Rua / Logradouro').waitFor();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('input')).some(el => el.value === 'Rua atual'));
  await page.waitForTimeout(1100);
  assert.equal(await page.getByLabel('Rua / Logradouro').inputValue(), 'Rua atual');
  assert.equal(await page.getByLabel('Cidade', { exact: true }).inputValue(), 'Tatuí');
  assert.equal(await page.getByLabel('Estado', { exact: true }).inputValue(), 'SP');
  await page.screenshot({ path: path.join(artifacts, 'cep-mobile.png') });
  assert.deepEqual(errors, []);
  console.log('OK: modal reto, rodapé fixo, modal aninhado, Escape, bloqueio de rolagem, celular e CEP com respostas fora de ordem.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
