const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');

test('centros: criar, classificar, renomear, exportar e excluir com proteção de histórico', { skip: !process.env.MFC_LEDGER_TEST_URL }, async () => {
  const base = process.env.MFC_LEDGER_TEST_URL;
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(data.error || String(response.status));
    return data;
  };
  let book, center, entry;
  try {
    center = await request('/ledger-cost-centers', 'POST', { name: '[Teste] Ação ' + Date.now(), description: 'Verificação temporária' });
    await assert.rejects(request('/ledger-cost-centers', 'POST', { name: center.name }), /Já existe/);
    book = await request('/ledger-entities', 'POST', { name: '[Teste] Exportação ' + Date.now(), year: 2026, initialBalance: 50 });
    entry = await request('/ledger', 'POST', { entityId: book.id, type: 'IN', amount: 123.45, date: '2026-10-08', category: 'Doação', costCenterId: center.id, analytic: 'Contribuição', financialAccount: 'Poupança' });
    assert.equal(entry.costCenter, center.name);
    assert.equal(entry.costCenterId, center.id);
    await assert.rejects(request('/ledger-cost-centers/' + center.id, 'DELETE'), /possui lançamentos/);
    center = await request('/ledger-cost-centers/' + center.id, 'PUT', { name: center.name + ' atualizado', description: 'Descrição atualizada' });
    const rows = await request('/ledger?entityId=' + book.id);
    assert.equal(rows[0].costCenter, center.name);
    assert.equal(rows[0].analytic, 'Contribuição');
    const response = await fetch(base + '/ledger-entities/' + book.id + '/export?scope=all');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /spreadsheetml/);
    const file = XLSX.read(Buffer.from(await response.arrayBuffer()), { type: 'buffer' });
    assert.equal(file.Sheets.Painel.E24.v, 173.45);
    assert.equal(file.Sheets['Diário'].B7.v, center.name);
    const empty = await fetch(base + '/ledger-entities/' + book.id + '/export?scope=filtered&costCenter=Inexistente');
    assert.equal(empty.status, 200);
    const emptyFile = XLSX.read(Buffer.from(await empty.arrayBuffer()), { type: 'buffer' });
    assert.equal(emptyFile.Sheets.Painel.E24.v, 0);
    await request('/ledger/' + entry.id, 'DELETE'); entry = null;
    await request('/ledger-cost-centers/' + center.id, 'DELETE');
    await assert.rejects(request('/ledger', 'POST', { entityId: book.id, type: 'IN', amount: 10, date: '2026-10-08', costCenterId: center.id }), /excluído/);
  } finally {
    if (entry) await request('/ledger/' + entry.id, 'DELETE');
    if (book) await request('/ledger-entities/' + book.id, 'DELETE');
    if (center) await request('/ledger-cost-centers/' + center.id, 'DELETE');
  }
});
