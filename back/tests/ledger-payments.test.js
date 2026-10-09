const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { paymentLedgerEntries } = require('../src/utils/ledger-payments');
const { buildLedgerWorkbook } = require('../src/utils/ledger-workbook');
const mapping = [{ year: 2026, entity_id: 'book2026' }, { year: 2027, entity_id: 'book2027' }];
const payment = { id: 'p1', member_id: 'a', member_name: 'Ana da Conceição', team_id: 't1', team_name: 'São Bento', amount: '15.00', date: '2026-10-09', reference_month: '1/2026', status: 'Pago' };

test('Excel agrupa casal, mantém valores numéricos, filtro e histórico somado', async () => {
  const members = [{ id: 'a', name: 'Ana da Conceição', team_id: 't1', status: 'Ativo', relationship_type: 'Titular', family_name: 'Família A' }, { id: 'b', name: 'Bruno da Conceição', team_id: 't1', status: 'Ativo', relationship_type: 'Cônjuge', family_name: 'Família A' }, { id: 'c', name: 'Criança', team_id: 't1', status: 'Ativo', relationship_type: 'Filho', family_name: 'Família A' }];
  const payments = [payment, { ...payment, id: 'p2', member_id: 'b' }];
  const buffer = await buildLedgerWorkbook({ name: 'Mensalidades', year: 2026 }, paymentLedgerEntries(payments, mapping), { teams: [{ id: 't1', name: 'São Bento' }], members, payments, monthlyAmount: 30 });
  const zip = await require('jszip').loadAsync(buffer);
  let sheetsWithNotes = 0;
  for (const path of Object.keys(zip.files).filter(path => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))) {
    const xml = await zip.file(path).async('string');
    if (!xml.includes('<legacyDrawing ')) continue;
    sheetsWithNotes++;
    for (const tag of ['tableParts', 'extLst']) {
      if (xml.includes(`<${tag}`)) assert.ok(xml.indexOf('<legacyDrawing ') < xml.indexOf(`<${tag}`), `${path}: comentários devem preceder ${tag}`);
    }
  }
  assert.ok(sheetsWithNotes > 0, 'Regressão precisa conter notas e tabelas na mesma aba');
  const wb = new (require('exceljs').Workbook)(); await wb.xlsx.load(buffer);
  const sheet = wb.getWorksheet('São Bento');
  assert.equal(sheet.getCell('A7').value, 'Ana e Bruno');
  assert.equal(sheet.getCell('B7').value, 30);
  assert.equal(sheet.getCell('B7').fill.fgColor.argb, 'FCE7F3');
  assert.equal(sheet.getCell('K13').value, 30);
  assert.equal(sheet.getCell('C19').value, 'Ana e Bruno');
  assert.equal(sheet.getCell('D19').value, 30);
  assert.equal(sheet.views[0].state, 'frozen');
  assert.ok(Object.values(sheet.tables).every(table => table.table.columns.every(column => column.filterButton)));
  assert.equal(wb.worksheets[0].name, 'Painel');
});

test('referências antigas entram em outubro e na virada entram no novo livro', () => {
  const rows = paymentLedgerEntries([payment, { ...payment, id: 'p2', reference_month: '2/2026' }, { ...payment, id: 'p3', date: '2027-01-10', reference_month: '12/2026' }], mapping);
  assert.equal(rows.filter(row => row.entityId === 'book2026').reduce((sum, row) => sum + row.amount, 0), 30);
  assert.equal(rows[0].date, '2026-10-09');
  assert.equal(rows[0].referenceMonth, '1/2026');
  assert.equal(rows[2].entityId, 'book2027');
  assert.equal(rows[2].date, '2027-01-10');
  assert.ok(rows.every(row => row.readOnly));
});

test('exportação exclusiva das equipes não mistura livros, saldos ou lançamentos manuais', async () => {
  const rows = [...paymentLedgerEntries([payment], mapping), { id: 'manual', type: 'IN', status: 'SETTLED', amount: 999, date: '2026-10-09', description: 'Não incluir', category: 'Outro livro' }];
  const wb = new (require('exceljs').Workbook)();
  await wb.xlsx.load(await buildLedgerWorkbook({ id: 'book2026', name: 'Livro normal', year: 2026, initialBalance: 500 }, rows, { report: 'teams', teams: [{ id: 't1', name: 'São Bento' }] }));
  assert.deepEqual(wb.worksheets.filter(sheet => sheet.state === 'visible').slice(0, 3).map(sheet => sheet.name), ['Painel', 'Balancete Equipes', 'São Bento']);
  assert.equal(wb.getWorksheet('Painel').getCell('A8').value.result, 15);
  assert.equal(wb.getWorksheet('Diário').state, 'hidden');
  assert.ok(!wb.getWorksheet('A pagar'));
  const regular = new (require('exceljs').Workbook)();
  await regular.xlsx.load(await buildLedgerWorkbook({ name: 'Livro normal', year: 2026 }, rows));
  assert.ok(!regular.getWorksheet('Balancete Equipes'));
  assert.equal(regular.getWorksheet('Painel').getCell('A8').value.result, 1014);
});

test('não duplica pagamentos, não conta pendentes e não altera os originais', () => {
  const original = JSON.stringify(payment);
  assert.equal(paymentLedgerEntries([payment, payment], mapping).length, 1);
  assert.equal(paymentLedgerEntries([payment], mapping, [{ sourceKey: 'payment:p1' }]).length, 0);
  assert.equal(paymentLedgerEntries([{ ...payment, status: 'Pendente' }, { ...payment, amount: -1 }, { ...payment, date: '2026-02-30' }], mapping).length, 0);
  assert.equal(paymentLedgerEntries([payment], []).length, 0);
  assert.equal(JSON.stringify(payment), original);
});

test('Excel tem balancete de equipes e abas independentes com zeros e referências', async () => {
  const rows = paymentLedgerEntries([payment, { ...payment, id: 'p2', reference_month: '2/2026' }, { ...payment, id: 'p3', team_id: 't2', team_name: 'São Lázaro', date: '2026-11-10', reference_month: '11/2026', amount: 30 }], mapping);
  const buffer = await buildLedgerWorkbook({ name: 'Mensalidades das Equipes', year: 2026, initialBalance: 0 }, rows, { teams: [{ id: 't1', name: 'São Bento' }, { id: 't2', name: 'São Lázaro' }, { id: 't3', name: 'Nova Aliança' }] });
  const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true });
  for (const name of ['Balancete Equipes', 'São Bento', 'São Lázaro', 'Nova Aliança']) assert.ok(wb.SheetNames.includes(name));
  const overview = XLSX.utils.sheet_to_json(wb.Sheets['Balancete Equipes'], { range: 5 });
  const bento = overview.find(row => row['Equipe base'] === 'São Bento');
  assert.equal(bento.Jan, 0); assert.equal(bento.Out, 30); assert.equal(bento['Total anual'], 30);
  assert.equal(overview.find(row => row['Equipe base'] === 'São Lázaro').Nov, 30);
  assert.equal(overview.find(row => row['Equipe base'] === 'Nova Aliança')['Total anual'], 0);
  assert.equal(wb.Sheets['São Bento'].A7.v, 'Ana');
  assert.equal(wb.Sheets['São Bento'].B7.v, 15);
  assert.match(wb.Sheets['São Bento'].B7.c[0].t, /09\/10\/2026/);
  const styled = new (require('exceljs').Workbook)();
  await styled.xlsx.load(buffer);
  assert.equal(styled.getWorksheet('São Bento').getCell('B7').fill.fgColor.argb, 'FCE7F3');
  assert.equal(wb.Sheets['São Bento'].K13.v, 30);
  assert.equal(wb.Sheets['São Bento'].B19.v, '1/2026');
  assert.equal(wb.Sheets['São Bento'].B20.v, '2/2026');
  assert.equal(wb.Sheets['São Bento'].D19.v, 15);
  assert.equal(wb.Sheets.Painel.A8.v, 60);
});

test('abas de equipes homônimas ou com caracteres especiais ficam separadas por ID', async () => {
  const rows = paymentLedgerEntries([payment, { ...payment, id: 'p2', team_id: 't2', amount: 40 }], mapping);
  const wb = XLSX.read(await buildLedgerWorkbook({ name: 'Equipes', year: 2026 }, rows, { teams: [{ id: 't1', name: 'São Bento' }, { id: 't2', name: 'São Bento' }, { id: 't3', name: 'Famílias / [Ação]' }] }), { type: 'buffer' });
  assert.equal(wb.Sheets['São Bento'].K13.v, 15);
  assert.equal(wb.Sheets['São Bento (2)'].K13.v, 40);
  assert.equal(new Set(wb.SheetNames).size, wb.SheetNames.length);
});
