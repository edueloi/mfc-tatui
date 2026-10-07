const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = { gender: 'Feminino', dob: '1990-02-10', mfcDate: '2020-01-01', status: 'Ativo', teamId: 'team-a', phone: '(15) 99999-1234' };
    const members = [
      { ...base, id: '1', name: 'Ana Silva', profession: 'Médica', cpf: '123.456.789-00' },
      { ...base, id: '2', name: 'Beatriz Alves', profession: '  MEDICA  ', status: 'Inativo', phone: null },
      { ...base, id: '3', name: 'João Souza', profession: 'Eletricista', teamId: null },
      { ...base, id: '4', name: 'Carlos Santos', profession: null },
      ...Array.from({ length: 17 }, (_, i) => ({ ...base, id: `extra-${i}`, name: `Membro ${i}`, profession: 'Professor' })),
    ];
    await page.route('http://localhost:4000/**', route => {
      assert.equal(route.request().method(), 'GET', 'A navegação não pode alterar cadastros.');
      const pathname = new URL(route.request().url()).pathname;
      return route.fulfill({ json: pathname === '/members' ? members : pathname === '/teams' ? [{ id: 'team-a', name: 'Equipe de teste' }] : [] });
    });
    await page.addInitScript(() => localStorage.setItem('mfc.currentUser', JSON.stringify({ id: 'test', name: 'Teste', role: 'Administrador' })));
    await page.goto('http://localhost:3000/mfcistas');
    await page.getByText('21 MFCistas encontrados de 21', { exact: true }).waitFor();
    await page.getByTitle('Próxima página').click();
    const search = page.getByRole('textbox', { name: 'Buscar MFCistas', exact: true });
    await search.fill('medica');
    await page.getByText('2 MFCistas encontrados de 21', { exact: true }).waitFor();
    assert.equal(await page.getByTitle('Página anterior').isDisabled(), true);
    await page.getByRole('tab', { name: 'Profissões', exact: true }).click();
    await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
    const professions = page.getByLabel('Profissões cadastradas', { exact: true });
    assert.equal(await professions.getByRole('button').count(), 5, 'Diferenças de acentos, espaços e caixa não duplicam profissões.');
    await professions.getByRole('button', { name: 'Médica 2', exact: true }).click();
    await page.getByText('2 MFCistas encontrados de 21', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Ativos', exact: true }).click();
    await page.getByText('1 MFCista encontrado de 21', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
    await professions.getByRole('button', { name: 'Não informada 1', exact: true }).click();
    await page.getByText('1 MFCista encontrado de 21', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Remover filtro de profissão' }).click();
    await search.fill('12345678900');
    await page.getByText('1 MFCista encontrado de 21', { exact: true }).waitFor();
    await search.fill('joao');
    await page.getByText('1 MFCista encontrado de 21', { exact: true }).waitFor();
    await search.fill('999991234');
    await page.getByText('20 MFCistas encontrados de 21', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
    await page.getByRole('textbox', { name: 'Buscar profissão', exact: true }).fill('inexistente');
    await page.getByText('Nenhuma profissão encontrada com esta busca.').waitFor();
    await page.getByRole('textbox', { name: 'Buscar profissão', exact: true }).fill('');
    const artifacts = path.join(__dirname, 'artifacts');
    fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, 'professions-desktop.png'), animations: 'disabled', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: 'Profissões', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, 'professions-mobile.png'), animations: 'disabled' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Sem rolagem horizontal da página no celular.');
    await page.getByRole('tab', { name: 'Profissões', exact: true }).focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.getByRole('tab', { name: 'MFCistas', exact: true }).getAttribute('aria-selected'), 'true');
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await page.getByLabel('Profissão', { exact: true }).selectOption('eletricista');
    await page.getByText('1 MFCista encontrado de 21', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('OK: profissões agrupadas, filtros combinados, não informada, busca sem acentos, CPF/telefone, paginação, teclado e celular.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
