const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

function loadSource(entry) {
  const filename = path.join(__dirname, 'compiled-celebrations-test.cjs');
  const result = buildSync({ absWorkingDir: path.resolve(__dirname, '..'), entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external' });
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(__dirname);
  compiled._compile(result.outputFiles[0].text, filename);
  return compiled.exports;
}

const { birthdayGroup, birthdayMessage, weddingMessage } = loadSource('utils/birthdayMessages.ts');
const { whatsappNumber, whatsappUrl } = loadSource('utils/whatsapp.ts');
const { meetingSlug, findMeeting, coupleSlug, findCouple } = loadSource('utils/bridalPaths.ts');

test('grupo da mensagem: menor de idade e 60+ vêm antes do sexo', () => {
  assert.equal(birthdayGroup(15, 'Feminino'), 'jovem');
  assert.equal(birthdayGroup(17, 'Masculino'), 'jovem');
  assert.equal(birthdayGroup(18, 'Masculino'), 'homem');
  assert.equal(birthdayGroup(40, 'Feminino'), 'mulher');
  assert.equal(birthdayGroup(60, 'Feminino'), 'idoso');
  assert.equal(birthdayGroup(35, 'Outro'), 'geral');
  assert.equal(birthdayGroup(null, 'Feminino'), 'mulher');
});

test('mensagens usam o primeiro nome e o tratamento correto', () => {
  assert.match(birthdayMessage('mulher', 'Maria da Silva', 'Feminino', 40), /^Querida Maria,/);
  assert.match(birthdayMessage('homem', 'João Souza', 'Masculino', 40), /^Querido João,/);
  assert.match(birthdayMessage('idoso', 'Ana Lima', 'Feminino', 72), /^Querida Ana, parabéns pelos seus 72 anos/);
  assert.match(birthdayMessage('jovem', 'Pedro', 'Masculino', 15), /^Oi, Pedro!/);
  assert.match(weddingMessage('Ana e João', 25), /Parabéns pelos 25 anos de casamento/);
});

test('whatsapp só gera link com telefone válido e codifica a mensagem', () => {
  assert.equal(whatsappNumber('(15) 99999-1234'), '5515999991234');
  assert.equal(whatsappNumber('1533334444'), '551533334444');
  assert.equal(whatsappNumber('5515999991234'), '5515999991234');
  assert.equal(whatsappNumber('99999'), '');
  assert.equal(whatsappUrl('', 'oi'), '');
  assert.equal(whatsappUrl('15999991234', 'Oi, tudo bem?'), 'https://wa.me/5515999991234?text=Oi%2C%20tudo%20bem%3F');
});

test('slug de encontro e casal: nome, desempate por data/id e id antigo', () => {
  const meetings = [{ id: 'm1', name: 'Encontro Agosto', date: '2026-08-01' }, { id: 'm2', name: 'Encontro Agosto', date: '2026-08-15' }, { id: 'm3', name: 'Sem encontro', date: '2026-09-01' }];
  assert.equal(meetingSlug(meetings[0], meetings), 'encontro-agosto-2026-08-01');
  assert.equal(findMeeting(meetings, 'encontro-agosto-2026-08-15').id, 'm2');
  assert.equal(meetingSlug(meetings[2], meetings), 'sem-encontro-turma');
  assert.equal(findMeeting(meetings, 'm1').id, 'm1');
  const couples = [{ id: 'abcdef123456', noivoName: 'João', noivaName: 'Maria' }, { id: 'zzzzzz999999', noivoName: 'João', noivaName: 'Maria' }, { id: 'c3', noivoName: 'Pedro', noivaName: 'Ana' }];
  assert.equal(coupleSlug(couples[2], couples), 'pedro-e-ana');
  assert.equal(coupleSlug(couples[0], couples), 'joao-e-maria-abcdef12');
  assert.equal(findCouple(couples, 'joao-e-maria-zzzzzz99').id, 'zzzzzz999999');
});

test('faixas etárias do perfil cobrem todas as idades sem sobreposição', () => {
  const { ageDistribution, AGE_RANGES } = loadSource('utils/ageRanges.ts');
  for (let i = 1; i < AGE_RANGES.length; i++) assert.equal(AGE_RANGES[i].min, AGE_RANGES[i - 1].max + 1);
  const born = years => { const d = new Date(); d.setFullYear(d.getFullYear() - years); d.setDate(d.getDate() - 2); return d.toISOString().slice(0, 10); };
  const ages = [3, 10, 11, 17, 18, 24, 25, 34, 35, 49, 50, 60, 61, 90];
  const { rows, unknown } = ageDistribution([...ages.map(age => ({ dob: born(age) })), { dob: '' }]);
  assert.deepEqual(rows.map(row => row.value), [2, 2, 2, 2, 2, 2, 2]);
  assert.equal(unknown, 1);
});

test('encontro fecha sozinho 7 dias depois da data ou quando encerrado à mão', () => {
  const { meetingStatus, CLOSE_AFTER_DAYS } = loadSource('utils/meetingStatus.ts');
  const at = (y, m, d) => new Date(y, m - 1, d, 9);
  const meeting = { date: '2026-09-13', isActive: true };
  assert.equal(CLOSE_AFTER_DAYS, 7);
  assert.equal(meetingStatus(meeting, at(2026, 9, 1)).closed, false);
  assert.equal(meetingStatus(meeting, at(2026, 9, 13)).closed, false);
  const after = meetingStatus(meeting, at(2026, 9, 17));
  assert.equal(after.closed, false); assert.equal(after.daysLeft, 3);
  assert.equal(meetingStatus(meeting, at(2026, 9, 20)).closed, false);
  const auto = meetingStatus(meeting, at(2026, 9, 21));
  assert.equal(auto.closed, true); assert.equal(auto.reason, 'auto');
  const manual = meetingStatus({ date: '2026-12-01', isActive: false }, at(2026, 9, 1));
  assert.equal(manual.closed, true); assert.equal(manual.reason, 'manual');
});
