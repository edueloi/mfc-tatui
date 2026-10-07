const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

function loadSource(entry) {
  const filename = path.join(__dirname, 'compiled-test.cjs');
  const result = buildSync({
    absWorkingDir: path.resolve(__dirname, '..'),
    entryPoints: [entry], bundle: true, write: false, platform: 'node',
    format: 'cjs', packages: 'external', define: { 'import.meta.env': '{}' }
  });
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(__dirname);
  compiled._compile(result.outputFiles[0].text, filename);
  return compiled.exports;
}

const accounting = loadSource('utils/paymentAccounting.ts');
const backend = require('../../back/src/utils/payment-accounting');
const receipt = {
  id: 'test-receipt', memberId: 'test-member', teamId: 'test-team',
  referenceMonth: '05/2026', date: '2026-11-10', amount: 50, status: 'Pago'
};

test('maio pago em novembro conserva atraso e não paga os demais meses', () => {
  const may = accounting.monthlySettlement(['test-member'], [receipt], 5, 2026);
  assert.equal(may.status, 'late');
  assert.equal(may.label, 'Pago em atraso');
  assert.match(may.description, /10\/11\/2026/);
  for (const month of [6, 7, 8, 9, 10, 11]) {
    assert.equal(accounting.monthlySettlement(['test-member'], [receipt], month, 2026).status, 'pending');
  }
});

test('dinheiro entra somente no caixa de novembro', () => {
  assert.equal(accounting.receivedInPeriod(receipt, 2026, 5), false);
  assert.equal(accounting.receivedInPeriod(receipt, 2026, 11), true);
  assert.equal(backend.receivedInPeriod(receipt, '11', '2026'), true);
  assert.equal(backend.receivedInPeriod(receipt, '05', '2026'), false);
});

test('várias mensalidades e virada de ano seguem a data real do recebimento', () => {
  const receipts = [5, 6, 7].map(month => ({ ...receipt, referenceMonth: `${month}/2025`, date: '2026-11-10' }));
  const total = receipts.filter(p => accounting.receivedInPeriod(p, 2026, 11)).reduce((sum, p) => sum + p.amount, 0);
  assert.equal(total, 150);
  assert.equal(receipts.filter(p => accounting.receivedInPeriod(p, 2025)).length, 0);
});

test('pagamento no mês ou antecipado não aparece em atraso', () => {
  for (const date of ['2026-05-10', '2026-04-30']) {
    assert.equal(accounting.monthlySettlement(['test-member'], [{ ...receipt, date }], 5, 2026).status, 'paid');
  }
});

test('pendente não conta como recebido ou mensalidade paga', () => {
  for (const status of ['Pendente', 'Isento']) {
    const pending = { ...receipt, status };
    assert.equal(accounting.receivedInPeriod(pending, 2026, 11), false);
    assert.equal(accounting.monthlySettlement(['test-member'], [pending], 5, 2026).status, 'pending');
    assert.equal(backend.receivedInPeriod(pending, 11, 2026), false);
  }
});

test('casal parcialmente pago continua parcial; isentos não viram pagos', () => {
  assert.equal(accounting.monthlySettlement(['test-member', 'spouse'], [receipt], 5, 2026).status, 'partial');
  assert.equal(accounting.monthlySettlement([], [receipt], 5, 2026).status, 'none');
});

test('referências com zero e status legado em maiúsculas funcionam', () => {
  assert.equal(accounting.matchesReference(receipt, 5, 2026), true);
  assert.equal(accounting.isPaidPayment({ ...receipt, status: 'PAGO' }), true);
  assert.equal(backend.matchesReference({ reference_month: '05/2026' }, '5', '2026'), true);
});

test('datas válidas preservam o dia brasileiro sem deslocamento de fuso', () => {
  assert.equal(accounting.formatPaymentDate('2026-11-01'), '01/11/2026');
  assert.equal(backend.validReceiptDate('2026-11-01'), true);
  for (const date of ['', undefined, '2026-02-30', '2026-13-01', '10/11/2026']) {
    assert.equal(backend.validReceiptDate(date), false);
  }
});

test('Minha Equipe renderiza com família não selecionada, sem erro de payingMembers', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { MemoryRouter } = require('react-router-dom');
  const MyTeam = loadSource('views/MyTeam.tsx').default;
  const html = renderToString(React.createElement(MemoryRouter, null,
    React.createElement(MyTeam, { teamId: 'test-team', userId: 'test-user', userRole: 'Administrador' })));
  assert.match(html, /Nova Família/);
});
