const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

function loadSource(entry) {
  const filename = path.join(__dirname, 'compiled-billing-test.cjs');
  const result = buildSync({ absWorkingDir: path.resolve(__dirname, '..'), entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external' });
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(__dirname);
  compiled._compile(result.outputFiles[0].text, filename);
  return compiled.exports;
}

const { buildBillingUnits, overdueMonths, unpaidForMonth } = loadSource('utils/billingUnits.ts');
const { teamSlug, findTeamByParam } = loadSource('utils/teamSlug.ts');
const person = (id, extra) => ({ id, name: `Pessoa ${id}`, status: 'Ativo', teamId: 't', familyName: 'Silva', relationshipType: 'Titular', paysMonthly: true, isPaymentInactive: false, ...extra });
const receipt = (id, ref, date = '2026-07-10') => ({ id: id + ref, memberId: id, teamId: 't', amount: 15, date, referenceMonth: ref, status: 'Pago' });

test('casal paga junto e dependentes ficam isentos', () => {
  const units = buildBillingUnits([person('a'), person('b', { relationshipType: 'Cônjuge' }), person('c', { relationshipType: 'Filho(a)' })], 30);
  assert.equal(units.length, 1);
  assert.equal(units[0].type, 'couple');
  assert.equal(units[0].amountPerPerson, 15);
  assert.equal(units[0].monthlyTotal, 30);
  assert.deepEqual(units[0].exemptMembers.map(member => member.id), ['c']);
});

test('cônjuge isento: titular paga o valor cheio', () => {
  const [unit] = buildBillingUnits([person('a'), person('b', { relationshipType: 'Cônjuge', paysMonthly: false })], 30);
  assert.equal(unit.type, 'single');
  assert.equal(unit.amountPerPerson, 30);
  assert.deepEqual(unit.exemptMembers.map(member => member.id), ['b']);
});

test('membro isento sem família aparece sem cobrança e inativo sem família não aparece', () => {
  const units = buildBillingUnits([person('d', { familyName: '', paysMonthly: false }), person('e', { familyName: '', status: 'Inativo' })], 30);
  assert.equal(units.length, 1);
  assert.equal(units[0].payingMembers.length, 0);
});

test('fevereiro a junho em atraso e julho pago em dia', () => {
  const [unit] = buildBillingUnits([person('a'), person('b', { relationshipType: 'Cônjuge' })], 30);
  const payments = ['a', 'b'].flatMap(id => [receipt(id, '1/2026', '2026-01-10'), receipt(id, '7/2026')]);
  assert.deepEqual(overdueMonths(unit, payments, 2026, 7), [2, 3, 4, 5, 6]);
  assert.equal(unpaidForMonth(unit, payments, 7, 2026).length, 0);
  assert.equal(unpaidForMonth(unit, payments, 3, 2026).length, 2);
});

test('slug da equipe usa o nome, desambigua por cidade e aceita o id antigo', () => {
  const teams = [{ id: 't1', name: 'Equipe São José', city: 'Tatuí' }, { id: 't2', name: 'Equipe Sao Jose', city: 'Itapetininga' }, { id: 't3', name: 'Nossa Senhora', city: 'Tatuí' }];
  assert.equal(teamSlug(teams[2], teams), 'nossa-senhora');
  assert.equal(teamSlug(teams[0], teams), 'equipe-sao-jose-tatui');
  assert.equal(findTeamByParam(teams, 'equipe-sao-jose-itapetininga').id, 't2');
  assert.equal(findTeamByParam(teams, 't3').id, 't3');
  assert.equal(findTeamByParam(teams, 'inexistente'), null);
});
