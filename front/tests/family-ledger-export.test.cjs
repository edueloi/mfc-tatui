const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const { buildSync } = require('esbuild');
function load(entry) {
  const filename = path.join(__dirname, 'in-memory-test.cjs');
  const result = buildSync({ absWorkingDir: path.resolve(__dirname, '..'), entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external' });
  const compiled = new Module(filename, module); compiled.filename = filename; compiled.paths = Module._nodeModulePaths(__dirname);
  compiled._compile(result.outputFiles[0].text, filename); return compiled.exports;
}
const { familyPaymentHistory } = load('utils/familyPaymentHistory.ts');
const { ledgerReportHtml } = load('utils/ledgerReportHtml.ts');
const { teamLedgerReportHtml } = load('utils/teamLedgerReportHtml.ts');
const members = [
  { id: 'a', name: 'Eduardo da Silva', status: 'Ativo', teamId: 't1', familyName: 'Família Silva', relationshipType: 'Titular' },
  { id: 'b', name: 'Karen da Silva', status: 'Ativo', teamId: 't1', familyName: 'Família Silva', relationshipType: 'Cônjuge' },
  { id: 'c', name: 'Criança da Silva', status: 'Ativo', teamId: 't1', familyName: 'Família Silva', relationshipType: 'Filho' },
];
const payment = { id: 'p1', memberId: 'a', teamId: 't1', amount: 15, date: '2026-10-09', referenceMonth: '1/2026', status: 'Pago' };
const payments = [payment, { ...payment, id: 'p2', memberId: 'b' }, { ...payment, id: 'p3', referenceMonth: '2/2026' }, { ...payment, id: 'p4', memberId: 'b', referenceMonth: '2/2026', date: '2026-11-03' }];
const entries = payments.map(payment => ({ ...payment, id: `payment:${payment.id}`, paymentId: payment.id, type: 'IN', status: 'SETTLED', description: 'Mensalidade', counterparty: members.find(member => member.id === payment.memberId).name }));
const context = { teams: [{ id: 't1', name: 'São Bento' }, { id: 't2', name: 'São Lázaro' }], members, payments, monthlyAmount: 30 };

test('histórico soma casal por referência e data, preserva dias diferentes e centavos', () => {
  const history = familyPaymentHistory([...payments, { ...payment, id: 'ignore', status: 'Pendente' }, { ...payment, teamId: 'another' }], 't1', ['a', 'b']);
  assert.equal(history.length, 3);
  assert.equal(history.find(row => row.referenceMonth === '1/2026').amount, 30);
  assert.equal(history.filter(row => row.referenceMonth === '2/2026').length, 2);
  assert.equal(history[0].date, '2026-11-03');
  assert.equal(familyPaymentHistory([{ ...payment, amount: .1 }, { ...payment, amount: .2 }], 't1', ['a'])[0].amount, .3);
});

test('PDF organiza casais por equipe, separa competência e caixa e aplica cores', () => {
  const report = teamLedgerReportHtml(2026, entries, context);
  assert.match(report.overview, /Balancete das equipes/);
  assert.equal((report.pages.match(/class="section page-break"/g) || []).length, 2);
  assert.match(report.pages, /Eduardo e Karen/);
  assert.doesNotMatch(report.pages, /Criança|Eduardo da Silva/);
  assert.match(report.pages, /background:#fce7f3">30,00/);
  assert.match(report.pages, /background:#e0e7ff">15,00/);
  assert.match(report.pages, /Recebido: R\$ 60,00/);
  assert.match(report.pages, /1\/2026<\/td><td>09\/10\/2026<\/td><td class="amount">30,00/);
  const filtered = teamLedgerReportHtml(2026, entries.slice(0, 1), { ...context, payments: payments.slice(0, 1) });
  assert.match(filtered.pages, /Recebido: R\$ 15,00/);
  assert.match(filtered.pages, /15,00 ◐/);
  const escaped = teamLedgerReportHtml(2026, entries, { ...context, teams: [{ id: 't1', name: '<script>Equipe</script>' }] });
  assert.doesNotMatch(escaped.pages, /<script>/);
  assert.match(escaped.pages, /&lt;script&gt;/);
  const html = ledgerReportHtml({ id: 'mfc-team-payments-2026', name: 'Mensalidades das Equipes', year: 2026, initialBalance: 0 }, entries, 'all', context);
  assert.match(html, /<svg/);
  assert.ok(html.indexOf('Balancete das equipes') < html.indexOf('<h1>São Bento</h1>'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mfc-report-preview-'));
  fs.writeFileSync(path.join(dir, 'report.html'), html);
  console.log('Prévia PDF: ' + path.join(dir, 'report.html'));
});
