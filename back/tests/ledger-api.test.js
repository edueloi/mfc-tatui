const test = require('node:test');
const assert = require('node:assert/strict');

// Integração opcional no backend local. Remove somente registros criados pelo próprio teste.
test('livro caixa: grava, edita, dá baixa e preserva valor previsto', { skip: !process.env.MFC_LEDGER_TEST_URL }, async () => {
  const base = process.env.MFC_LEDGER_TEST_URL;
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(data.error || String(response.status));
    return data;
  };
  let book;
  let entry;
  try {
    book = await request('/ledger-entities', 'POST', { name: '[Teste automatizado] Livro Caixa ' + Date.now(), year: 2026, initialBalance: 100 });
    entry = await request('/ledger', 'POST', { entityId: book.id, type: 'OUT', amount: 80, expectedAmount: 80, status: 'PENDING', date: '2026-10-08', dueDate: '2026-10-15', valueKind: 'FIXED', category: 'Teste', counterparty: 'Fornecedor de teste', notes: 'Teste temporário' });
    assert.equal(entry.status, 'PENDING');
    assert.equal(entry.expectedAmount, 80);
    const settled = await request('/ledger/' + entry.id, 'PUT', { status: 'SETTLED', amount: 85.5, date: '2026-10-10', paymentMethod: 'PIX' });
    assert.equal(settled.amount, 85.5);
    assert.equal(settled.expectedAmount, 80);
    assert.equal(settled.status, 'SETTLED');
    assert.equal(settled.dueDate, '2026-10-15');
    assert.equal(settled.paymentMethod, 'PIX');
    await assert.rejects(request('/ledger/' + entry.id, 'PUT', { date: '2025-10-10' }), /exercício/);
    await assert.rejects(request('/ledger/' + entry.id, 'PUT', { amount: -1 }), /valor/);
    await assert.rejects(request('/ledger-entities/' + book.id, 'PUT', { name: book.name, year: 2025, initialBalance: 100 }), /exercício/);
    const rows = await request('/ledger?entityId=' + book.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].date, '2026-10-10');
    assert.equal(rows[0].amount, 85.5);
    const cancelled = await request('/ledger/' + entry.id, 'PUT', { status: 'CANCELLED' });
    assert.equal(cancelled.status, 'CANCELLED');
  } finally {
    if (entry) await request('/ledger/' + entry.id, 'DELETE');
    if (book) await request('/ledger-entities/' + book.id, 'DELETE');
  }
});
