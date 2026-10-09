const test = require('node:test');
const assert = require('node:assert/strict');
const { validateLedger } = require('../src/utils/ledger-validation');
const valid = { type: 'OUT', amount: 125.50, date: '2026-10-08', dueDate: '2026-10-15', status: 'PENDING', valueKind: 'FIXED', expectedAmount: 120 };

test('conta pendente exige vencimento real e valor finito', () => {
  assert.equal(validateLedger(valid, 2026), null);
  for (const amount of [0, -1, Infinity, 'abc', 1e15]) assert.ok(validateLedger({ ...valid, amount }, 2026));
  assert.ok(validateLedger({ ...valid, dueDate: '' }, 2026));
  assert.ok(validateLedger({ ...valid, dueDate: '2026-02-30' }, 2026));
});
test('datas, exercício e classificações são validados também na edição', () => {
  assert.ok(validateLedger({ ...valid, date: '2026-02-30' }, 2026));
  assert.ok(validateLedger({ ...valid, date: '2025-10-08' }, 2026));
  assert.ok(validateLedger({ ...valid, status: 'inventado' }, 2026));
  assert.ok(validateLedger({ ...valid, valueKind: 'inventado' }, 2026));
  assert.ok(validateLedger({ ...valid, expectedAmount: -5 }, 2026));
  assert.equal(validateLedger({ ...valid, date: '2024-02-29' }, 2024), null);
});
test('lançamento antigo sem novos campos continua compatível', () => {
  assert.equal(validateLedger({ type: 'IN', amount: 45, date: '2026-10-08' }, 2026), null);
});
