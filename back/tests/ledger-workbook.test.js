const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const { buildLedgerWorkbook, filterLedgerEntries } = require('../src/utils/ledger-workbook');
const book = { name: 'Livro de teste — Ação', year: 2026, initialBalance: 100 };
const entry = { id: '1', date: '2026-01-10', type: 'IN', amount: 120.5, costCenter: 'Sede', financialAccount: 'BB c/c', category: 'Receita', analytic: 'Aluguel', description: '=1+1' };
const entries = [entry, { ...entry, id: '2', type: 'OUT', amount: 30.2 }, { ...entry, id: '3', status: 'PENDING', amount: 80, dueDate: '2026-02-10' }, { ...entry, id: '4', type: 'OUT', status: 'PENDING', amount: 25 }, { ...entry, id: '5', status: 'CANCELLED', amount: 999 }];

test('Excel: valores, fórmulas, tabelas, filtros e gráficos nativos', async () => {
  const buffer = await buildLedgerWorkbook(book, entries);
  const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true });
  assert.ok(wb.SheetNames.includes('Balancete c.custo'));
  assert.ok(wb.SheetNames.includes('Sede'));
  const panel = wb.Sheets.Painel;
  assert.equal(panel.A8.v, 120.5);
  assert.equal(panel.C8.v, 30.2);
  assert.equal(panel.E8.v, 80);
  assert.equal(panel.G8.v, 25);
  assert.equal(panel.E13.v, 190.3);
  assert.equal(panel.E24.v, 190.3);
  assert.match(panel.B13.f, /SUMIFS/);
  assert.equal(wb.Sheets['Diário'].H7.t, 's');
  assert.equal(wb.Sheets['Diário'].H7.v, '=1+1');
  const zip = await JSZip.loadAsync(buffer);
  assert.ok(zip.file('xl/tables/table1.xml'));
  assert.match(await zip.file('xl/charts/chart1.xml').async('string'), /barChart/);
  assert.match(await zip.file('xl/charts/chart2.xml').async('string'), /lineChart/);
  assert.match(await zip.file('xl/worksheets/sheet1.xml').async('string'), /dataValidation/);
  assert.match(await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string'), /drawingLedger/);
});

test('Excel: recorte não incorpora saldo inicial e livro vazio permanece válido', async () => {
  const filtered = XLSX.read(await buildLedgerWorkbook(book, [entry], { scope: 'filtered' }), { type: 'buffer' });
  assert.equal(filtered.Sheets.Painel.E13.v, 120.5);
  const empty = XLSX.read(await buildLedgerWorkbook(book, []), { type: 'buffer' });
  assert.equal(empty.Sheets.Painel.E24.v, 100);
  assert.equal(empty.Sheets.Painel.A8.v, 0);
});

test('Excel: nomes de abas especiais, longos e repetidos não colidem', async () => {
  const names = ['Painel', 'Diário', 'Leia-me', 'A/B:C*D?E[F]', 'x'.repeat(40), 'x'.repeat(41)];
  const wb = XLSX.read(await buildLedgerWorkbook(book, names.map((costCenter, i) => ({ ...entry, id: String(i), costCenter }))), { type: 'buffer' });
  assert.equal(new Set(wb.SheetNames.map(name => name.toLowerCase())).size, wb.SheetNames.length);
  assert.ok(wb.SheetNames.every(name => name.length <= 31 && !/[\\/*?:\[\]]/.test(name)));
});

test('filtros de exportação: vencimento, atraso, centro, conta e acentos', () => {
  assert.deepEqual(filterLedgerEntries(entries, { tab: 'receber', month: '2' }).map(e => e.id), ['3']);
  assert.deepEqual(filterLedgerEntries(entries, { status: 'overdue' }, '2026-01-20').map(e => e.id), ['4']);
  assert.equal(filterLedgerEntries(entries, { costCenter: 'Outro' }).length, 0);
  assert.equal(filterLedgerEntries(entries, { financialAccount: 'Poupança' }).length, 0);
  assert.equal(filterLedgerEntries([{ ...entry, description: 'Doação da família' }], { search: 'doacao' }).length, 1);
});
