// Rotas de Nucleação (acompanhamento pós Encontro de Noivos)

const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { rowToNucleationContact, rowToNucleationAttempt, rowToMember } = require('../models/converters');
const { nowIso } = require('../utils/helpers');
const multer = require('multer');
const { parseNucleationWorkbook, buildTemplateWorkbook, norm } = require('../utils/nucleationImport');
const { attendeesFromContacts, buildAttendancePdf } = require('../utils/nucleationAttendancePdf');

const router = express.Router();

// Campos do cadastro de contato (casal + endereço + observações). O nome e os telefones continuam nas colunas antigas.
const CONTACT_EXTRA_COLUMNS = [
  ['noivo_name', 'VARCHAR(150)'], ['noivo_email', 'VARCHAR(150)'], ['noivo_dob', 'VARCHAR(10)'],
  ['noiva_name', 'VARCHAR(150)'], ['noiva_email', 'VARCHAR(150)'], ['noiva_dob', 'VARCHAR(10)'],
  ['noivo_profession', 'VARCHAR(120)'], ['noivo_education', 'VARCHAR(120)'], ['noivo_religion', 'VARCHAR(120)'],
  ['noiva_profession', 'VARCHAR(120)'], ['noiva_education', 'VARCHAR(120)'], ['noiva_religion', 'VARCHAR(120)'],
  ['noivo_birthplace', 'VARCHAR(120)'], ['noiva_birthplace', 'VARCHAR(120)'], ['noivo_parish', 'VARCHAR(150)'], ['noiva_parish', 'VARCHAR(150)'],
  ['wedding_date', 'VARCHAR(10)'], ['wedding_parish', 'VARCHAR(150)'], ['meeting_date', 'VARCHAR(10)'],
  ['zip', 'VARCHAR(9)'], ['street', 'VARCHAR(200)'], ['address_number', 'VARCHAR(20)'], ['neighborhood', 'VARCHAR(120)'],
  ['complement', 'VARCHAR(120)'], ['city', 'VARCHAR(120)'], ['state', 'VARCHAR(2)'], ['notes', 'TEXT'],
];
// Um grupo é também um encontro de nucleação: data, horário, local e responsável.
const GROUP_EXTRA_COLUMNS = [['event_date', 'VARCHAR(10)'], ['event_time', 'VARCHAR(5)'], ['location', 'VARCHAR(200)'], ['leader', 'VARCHAR(120)']];

const CONTACT_FIELDS = {
  noivoName: 'noivo_name', noivoEmail: 'noivo_email', noivoDob: 'noivo_dob',
  noivaName: 'noiva_name', noivaEmail: 'noiva_email', noivaDob: 'noiva_dob',
  noivoProfession: 'noivo_profession', noivoEducation: 'noivo_education', noivoReligion: 'noivo_religion',
  noivaProfession: 'noiva_profession', noivaEducation: 'noiva_education', noivaReligion: 'noiva_religion',
  noivoBirthplace: 'noivo_birthplace', noivaBirthplace: 'noiva_birthplace', noivoParish: 'noivo_parish', noivaParish: 'noiva_parish',
  weddingDate: 'wedding_date', weddingParish: 'wedding_parish', meetingDate: 'meeting_date',
  zip: 'zip', street: 'street', number: 'address_number', neighborhood: 'neighborhood',
  complement: 'complement', city: 'city', state: 'state', notes: 'notes',
};
const text = (value, max) => String(value ?? '').trim().slice(0, max);
const cleanField = (key, value) => key === 'state' ? text(value, 2).toUpperCase() : key === 'notes' ? text(value, 2000) : text(value, 200);
const joinNames = (a, b) => [a, b].map(item => String(item || '').trim()).filter(Boolean).join(' & ');

let nucleationGroupsReady;
const ensureNucleationGroups = () => {
  if (!nucleationGroupsReady) nucleationGroupsReady = (async () => {
    await db.prepare(`CREATE TABLE IF NOT EXISTS nucleation_groups (
      id VARCHAR(36) PRIMARY KEY, name VARCHAR(150) NOT NULL, description TEXT NULL,
      created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS nucleation_group_history (
      id VARCHAR(36) PRIMARY KEY, group_id VARCHAR(36) NOT NULL, occurred_at VARCHAR(20) NULL,
      notes TEXT NOT NULL, created_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).run();
    const columns = await db.prepare("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nucleation_contacts'").all();
    if (!columns.some(column => (column.COLUMN_NAME || column.column_name) === 'group_id')) {
      await db.prepare('ALTER TABLE nucleation_contacts ADD COLUMN group_id VARCHAR(36) NULL').run();
    }
    const groupColumns = await db.prepare("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nucleation_groups'").all();
    const haveGroup = new Set(groupColumns.map(column => column.COLUMN_NAME || column.column_name));
    for (const [name, type] of GROUP_EXTRA_COLUMNS) {
      if (!haveGroup.has(name)) await db.prepare(`ALTER TABLE nucleation_groups ADD COLUMN ${name} ${type} NULL`).run();
    }
    // Cadastro completo do casal (igual ao de noivo e noiva) e endereço.
    const existing = new Set(columns.map(column => column.COLUMN_NAME || column.column_name));
    for (const [name, type] of CONTACT_EXTRA_COLUMNS) {
      if (!existing.has(name)) await db.prepare(`ALTER TABLE nucleation_contacts ADD COLUMN ${name} ${type} NULL`).run();
    }
  })().catch(error => { nucleationGroupsReady = undefined; throw error; });
  return nucleationGroupsReady;
};

router.use(async (req, res, next) => {
  try { await ensureNucleationGroups(); next(); }
  catch (error) { next(error); }
});

async function loadContactFull(id) {
  const contactRow = await db.prepare('SELECT * FROM nucleation_contacts WHERE id = ?').get(id);
  if (!contactRow) return null;

  const attemptRows = await db.prepare('SELECT * FROM nucleation_attempts WHERE nucleation_id = ? ORDER BY created_at DESC').all(id);

  return {
    ...rowToNucleationContact(contactRow),
    attempts: attemptRows.map(rowToNucleationAttempt)
  };
}

router.get('/', async (req, res) => {
  const rows = await db.prepare(`
    SELECT
      nc.*,
      (SELECT COUNT(*) FROM nucleation_attempts na WHERE na.nucleation_id = nc.id) AS attempts_count,
      p1.name AS couple_noivo_name,
      p2.name AS couple_noiva_name,
      ng.name AS group_name
    FROM nucleation_contacts nc
    LEFT JOIN bridal_partners p1 ON p1.couple_id = nc.couple_id AND p1.role = 'noivo'
    LEFT JOIN bridal_partners p2 ON p2.couple_id = nc.couple_id AND p2.role = 'noiva'
    LEFT JOIN nucleation_groups ng ON ng.id = nc.group_id
    ORDER BY nc.created_at DESC
  `).all();

  res.json(rows.map(row => ({
    ...rowToNucleationContact(row),
    attemptsCount: row.attempts_count || 0,
    coupleNoivoName: row.couple_noivo_name || null,
    coupleNoivaName: row.couple_noiva_name || null
  })));
});

// ───────── Importação de planilha (inscrições do Encontro de Noivos) ─────────
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const digits = (value) => String(value || '').replace(/\D/g, '');

// Chaves para reconhecer casais já cadastrados: nomes do casal ou algum telefone igual.
async function loadExistingKeys() {
  const rows = await db.prepare('SELECT id, name, phone_1, phone_2, noivo_name, noiva_name FROM nucleation_contacts').all();
  const names = new Map(); const phones = new Map();
  for (const row of rows) {
    const [legacyA, legacyB] = String(row.name || '').split(/\s+&\s+/);
    names.set(`${norm(row.noivo_name || legacyA)}|${norm(row.noiva_name || legacyB)}`, row.name);
    for (const phone of [row.phone_1, row.phone_2]) if (digits(phone).length >= 10) phones.set(digits(phone), row.name);
  }
  return { names, phones };
}

function markDuplicates(couples, existing) {
  const seenNames = new Set(); const seenPhones = new Set();
  return couples.map((couple) => {
    const nameKey = `${norm(couple.noivo.name)}|${norm(couple.noiva.name)}`;
    const couplePhones = [couple.noivo.phone, couple.noiva.phone].filter((phone) => digits(phone).length >= 10);
    let duplicateOf = existing.names.get(nameKey) || couplePhones.map((phone) => existing.phones.get(phone)).find(Boolean) || '';
    let reason = duplicateOf ? 'Já cadastrado na Nucleação' : '';
    if (!duplicateOf && (seenNames.has(nameKey) || couplePhones.some((phone) => seenPhones.has(phone)))) { duplicateOf = 'repetido na planilha'; reason = 'Repetido na própria planilha'; }
    seenNames.add(nameKey); couplePhones.forEach((phone) => seenPhones.add(phone));
    return { ...couple, duplicate: !!duplicateOf, duplicateReason: reason, duplicateOf };
  });
}

router.get('/import/template', async (req, res) => {
  try {
    const workbook = await buildTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="modelo-nucleacao.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { res.status(500).json({ error: 'Não foi possível gerar o modelo: ' + error.message }); }
});

router.post('/import/preview', importUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Escolha o arquivo da planilha (.xlsx).' });
    if (!/\.xlsx$/i.test(req.file.originalname || '')) return res.status(400).json({ error: 'Use uma planilha do Excel no formato .xlsx.' });
    const parsed = await parseNucleationWorkbook(req.file.buffer);
    const couples = markDuplicates(parsed.couples, await loadExistingKeys());
    res.json({ fileName: req.file.originalname, sheet: parsed.sheet, peopleRows: parsed.peopleRows, couples });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Erro ao ler planilha de nucleação:', error);
    res.status(400).json({ error: 'Não foi possível ler a planilha. Confira se é um arquivo .xlsx válido. (' + error.message + ')' });
  }
});

router.post('/import/commit', async (req, res) => {
  try {
    const { couples, groupId } = req.body || {};
    if (!Array.isArray(couples) || !couples.length) return res.status(400).json({ error: 'Nenhum casal selecionado para importar.' });
    if (couples.length > 500) return res.status(400).json({ error: 'Importe no máximo 500 casais por vez.' });
    // Confere de novo no servidor: não duplica quem já foi cadastrado entre a prévia e a confirmação.
    const existing = await loadExistingKeys();
    let imported = 0; const skipped = []; const failed = [];
    for (const couple of couples) {
      const noivo = couple.noivo || {}; const noiva = couple.noiva || {};
      const label = [noivo.name, noiva.name].filter(Boolean).join(' & ') || 'Casal sem nome';
      const nameKey = `${norm(noivo.name)}|${norm(noiva.name)}`;
      const phoneHit = [noivo.phone, noiva.phone].some((phone) => digits(phone).length >= 10 && existing.phones.has(digits(phone)));
      if (existing.names.has(nameKey) || phoneHit) { skipped.push(label); continue; }
      try {
        await createContact({
          noivoName: noivo.name, noivoEmail: noivo.email, noivoDob: noivo.dob, noivoProfession: noivo.profession, noivoEducation: noivo.education,
          noivoReligion: noivo.religion, noivoBirthplace: noivo.birthplace, noivoParish: noivo.parish,
          noivaName: noiva.name, noivaEmail: noiva.email, noivaDob: noiva.dob, noivaProfession: noiva.profession, noivaEducation: noiva.education,
          noivaReligion: noiva.religion, noivaBirthplace: noiva.birthplace, noivaParish: noiva.parish,
          phone1: digits(noivo.phone), phone2: digits(noiva.phone),
          street: couple.street, city: couple.city, state: couple.state, notes: couple.notes,
          weddingDate: couple.weddingDate, weddingParish: couple.weddingParish, meetingDate: couple.meetingDate,
        }, { groupId });
        existing.names.set(nameKey, label);
        [noivo.phone, noiva.phone].forEach((phone) => { if (digits(phone).length >= 10) existing.phones.set(digits(phone), label); });
        imported += 1;
      } catch (error) { failed.push({ label, error: error.message }); }
    }
    res.json({ imported, skipped, failed });
  } catch (error) {
    console.error('Erro ao importar contatos de nucleação:', error);
    res.status(500).json({ error: 'Erro ao importar: ' + error.message });
  }
});

const groupJson = (group, contactsCount = 0) => ({
  id: group.id, name: group.name, description: group.description || '',
  eventDate: group.event_date || '', eventTime: group.event_time || '', location: group.location || '', leader: group.leader || '',
  contactsCount: Number(contactsCount) || 0, createdAt: group.created_at, updatedAt: group.updated_at,
});
const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
const cleanTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? String(value) : '';
const groupFields = (body) => ({
  event_date: cleanDate(body.eventDate), event_time: cleanTime(body.eventTime),
  location: text(body.location, 200), leader: text(body.leader, 120),
});
const idList = (value) => [...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))].slice(0, 1000);
// Só considera ids de contatos que existem de verdade.
async function existingContactIds(contactIds) {
  if (!contactIds.length) return [];
  const rows = await db.prepare(`SELECT id FROM nucleation_contacts WHERE id IN (${contactIds.map(() => '?').join(', ')})`).all(...contactIds);
  const found = new Set(rows.map(row => row.id));
  return contactIds.filter(id => found.has(id));
}
async function assignContacts(groupId, contactIds) {
  const ids = await existingContactIds(contactIds);
  if (!ids.length) return 0;
  const ts = nowIso();
  await db.prepare(`UPDATE nucleation_contacts SET group_id = ?, updated_at = ? WHERE id IN (${ids.map(() => '?').join(', ')})`).run(groupId, ts, ...ids);
  return ids.length;
}
async function groupContacts(groupId) {
  return db.prepare('SELECT * FROM nucleation_contacts WHERE group_id = ? ORDER BY name').all(groupId);
}

router.get('/groups', async (req, res) => {
  try {
    const groups = await db.prepare(`SELECT ng.*, COUNT(nc.id) AS contacts_count
      FROM nucleation_groups ng LEFT JOIN nucleation_contacts nc ON nc.group_id = ng.id
      GROUP BY ng.id ORDER BY ng.name`).all();
    res.json(groups.map(group => groupJson(group, group.contacts_count)));
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar grupos de nucleação: ' + error.message }); }
});

router.post('/groups', async (req, res) => {
  try {
    const name = text(req.body?.name, 150);
    if (name.length < 3) return res.status(400).json({ error: 'Informe o nome do grupo (mínimo 3 letras).' });
    const id = uuid(), ts = nowIso(), fields = groupFields(req.body || {});
    await db.prepare('INSERT INTO nucleation_groups (id, name, description, event_date, event_time, location, leader, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, text(req.body?.description, 2000), fields.event_date, fields.event_time, fields.location, fields.leader, ts, ts);
    const assigned = await assignContacts(id, idList(req.body?.contactIds));
    const group = await db.prepare('SELECT * FROM nucleation_groups WHERE id = ?').get(id);
    res.status(201).json(groupJson(group, assigned));
  } catch (error) { res.status(500).json({ error: 'Erro ao criar grupo de nucleação: ' + error.message }); }
});

// Cria vários grupos de uma vez e distribui as pessoas que ainda estão sem grupo (ou as escolhidas) em partes iguais.
router.post('/groups/generate', async (req, res) => {
  try {
    const body = req.body || {};
    const baseName = text(body.baseName, 120) || 'Grupo';
    let ids = await existingContactIds(idList(body.contactIds));
    if (!ids.length && !idList(body.contactIds).length) {
      const rows = await db.prepare("SELECT id FROM nucleation_contacts WHERE group_id IS NULL AND status IN ('Pendente', 'Em Andamento') ORDER BY created_at, name").all();
      ids = rows.map(row => row.id);
    }
    if (!ids.length) return res.status(400).json({ error: 'Não há pessoas sem grupo para distribuir.' });
    const count = Math.min(Math.max(parseInt(body.count, 10) || 1, 1), Math.min(50, ids.length));
    const fields = groupFields(body);
    const created = []; const per = Math.floor(ids.length / count); const extra = ids.length % count;
    let cursor = 0;
    for (let index = 0; index < count; index += 1) {
      const size = per + (index < extra ? 1 : 0);
      const members = ids.slice(cursor, cursor + size); cursor += size;
      const id = uuid(), ts = nowIso(), name = count === 1 ? baseName : `${baseName} ${index + 1}`;
      await db.prepare('INSERT INTO nucleation_groups (id, name, description, event_date, event_time, location, leader, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, name, text(body.description, 2000), fields.event_date, fields.event_time, fields.location, fields.leader, ts, ts);
      await assignContacts(id, members);
      created.push(groupJson(await db.prepare('SELECT * FROM nucleation_groups WHERE id = ?').get(id), members.length));
    }
    res.status(201).json({ groups: created, assigned: ids.length });
  } catch (error) { res.status(500).json({ error: 'Erro ao gerar grupos de nucleação: ' + error.message }); }
});

router.get('/groups/:id', async (req, res) => {
  try {
    const group = await db.prepare('SELECT * FROM nucleation_groups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });
    const [contacts, history] = await Promise.all([
      db.prepare(`SELECT nc.*, ng.name AS group_name, (SELECT COUNT(*) FROM nucleation_attempts na WHERE na.nucleation_id = nc.id) AS attempts_count FROM nucleation_contacts nc LEFT JOIN nucleation_groups ng ON ng.id = nc.group_id WHERE nc.group_id = ? ORDER BY nc.name`).all(group.id),
      db.prepare('SELECT * FROM nucleation_group_history WHERE group_id = ? ORDER BY occurred_at DESC, created_at DESC').all(group.id),
    ]);
    res.json({ ...groupJson(group, contacts.length),
      contacts: contacts.map(row => ({ ...rowToNucleationContact(row), attemptsCount: Number(row.attempts_count) || 0 })),
      history: history.map(item => ({ id: item.id, groupId: item.group_id, occurredAt: item.occurred_at || '', notes: item.notes || '', createdAt: item.created_at })) });
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar grupo de nucleação: ' + error.message }); }
});

router.put('/groups/:id', async (req, res) => {
  try {
    const group = await db.prepare('SELECT * FROM nucleation_groups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });
    const body = req.body || {};
    const has = key => Object.prototype.hasOwnProperty.call(body, key);
    const sets = { updated_at: nowIso() };
    if (has('name')) { const name = text(body.name, 150); if (name.length < 3) return res.status(400).json({ error: 'Informe o nome do grupo (mínimo 3 letras).' }); sets.name = name; }
    if (has('description')) sets.description = text(body.description, 2000);
    const fields = groupFields(body);
    if (has('eventDate')) sets.event_date = fields.event_date;
    if (has('eventTime')) sets.event_time = fields.event_time;
    if (has('location')) sets.location = fields.location;
    if (has('leader')) sets.leader = fields.leader;
    await db.prepare(`UPDATE nucleation_groups SET ${Object.keys(sets).map(column => `${column} = @${column}`).join(', ')} WHERE id = @id`).run({ id: group.id, ...sets });
    const updated = await db.prepare('SELECT ng.*, (SELECT COUNT(*) FROM nucleation_contacts nc WHERE nc.group_id = ng.id) AS contacts_count FROM nucleation_groups ng WHERE ng.id = ?').get(group.id);
    res.json(groupJson(updated, updated.contacts_count));
  } catch (error) { res.status(500).json({ error: 'Erro ao atualizar grupo de nucleação: ' + error.message }); }
});

// Excluir o grupo não apaga as pessoas: elas voltam a ficar "sem grupo".
router.delete('/groups/:id', async (req, res) => {
  try {
    const group = await db.prepare('SELECT id FROM nucleation_groups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });
    await db.prepare('UPDATE nucleation_contacts SET group_id = NULL, updated_at = ? WHERE group_id = ?').run(nowIso(), group.id);
    await db.prepare('DELETE FROM nucleation_group_history WHERE group_id = ?').run(group.id);
    await db.prepare('DELETE FROM nucleation_groups WHERE id = ?').run(group.id);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Erro ao excluir grupo de nucleação: ' + error.message }); }
});

router.post('/groups/:id/members', async (req, res) => {
  try {
    const group = await db.prepare('SELECT id FROM nucleation_groups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });
    const ids = idList(req.body?.contactIds);
    if (!ids.length) return res.status(400).json({ error: 'Escolha ao menos uma pessoa.' });
    const assigned = await assignContacts(group.id, ids);
    res.json({ assigned });
  } catch (error) { res.status(500).json({ error: 'Erro ao adicionar pessoas ao grupo: ' + error.message }); }
});

// Ficha de presença (PDF): ?download=1 baixa o arquivo; sem isso abre no navegador (dá para imprimir).
router.get('/groups/:id/attendance.pdf', async (req, res) => {
  try {
    const group = await db.prepare('SELECT * FROM nucleation_groups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });
    const names = attendeesFromContacts(await groupContacts(group.id));
    const extraRows = Math.min(Math.max(parseInt(req.query.extra, 10) || 0, 0), 30);
    const pdf = await buildAttendancePdf({ group, names, extraRows: req.query.extra === undefined ? 3 : extraRows });
    const slug = norm(group.name).replace(/\s+/g, '-') || 'grupo';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="ficha-presenca-${slug}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  } catch (error) { res.status(500).json({ error: 'Erro ao gerar a ficha de presença: ' + error.message }); }
});

router.post('/groups/:id/history', async (req, res) => {
  try {
    const group = await db.prepare('SELECT id FROM nucleation_groups WHERE id = ?').get(req.params.id);
    const notes = String(req.body?.notes || '').trim();
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });
    if (!notes) return res.status(400).json({ error: 'Descreva o histórico do grupo.' });
    const id = uuid(), ts = nowIso(), occurredAt = String(req.body?.occurredAt || '').slice(0, 20);
    await db.prepare('INSERT INTO nucleation_group_history (id, group_id, occurred_at, notes, created_at) VALUES (?, ?, ?, ?, ?)').run(id, group.id, occurredAt, notes, ts);
    res.status(201).json({ id, groupId: group.id, occurredAt, notes, createdAt: ts });
  } catch (error) { res.status(500).json({ error: 'Erro ao registrar histórico do grupo: ' + error.message }); }
});

router.put('/:id/group', async (req, res) => {
  try {
    const groupId = req.body?.groupId || null;
    if (groupId && !(await db.prepare('SELECT id FROM nucleation_groups WHERE id = ?').get(groupId))) return res.status(404).json({ error: 'Grupo não encontrado.' });
    await db.prepare('UPDATE nucleation_contacts SET group_id = ?, updated_at = ? WHERE id = ?').run(groupId, nowIso(), req.params.id);
    const contact = await loadContactFull(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado.' });
    res.json(contact);
  } catch (error) { res.status(500).json({ error: 'Erro ao vincular contato ao grupo: ' + error.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const contact = await loadContactFull(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado.' });
    res.json(contact);
  } catch (error) {
    console.error('Erro ao buscar contato:', error);
    res.status(500).json({ error: 'Erro ao buscar contato: ' + error.message });
  }
});

// Grava um contato (cadastro manual ou importação). Lança erro com .status quando os dados não servem.
async function createContact(data, { groupId: forcedGroupId } = {}) {
  if (data.coupleId) {
    const existing = await db.prepare('SELECT id FROM nucleation_contacts WHERE couple_id = ?').get(data.coupleId);
    if (existing) { const error = new Error('Este casal já foi enviado para a Nucleação.'); error.status = 400; throw error; }
  }

  const id = uuid();
  const ts = nowIso();

  const extra = {};
  for (const [key, column] of Object.entries(CONTACT_FIELDS)) extra[column] = cleanField(key, data[key]);
  const name = text(data.name, 150) || joinNames(extra.noivo_name, extra.noiva_name);
  if (!name) { const error = new Error('Informe o nome do noivo ou da noiva.'); error.status = 400; throw error; }
  let groupId = null;
  const wantedGroup = forcedGroupId || data.groupId;
  if (wantedGroup) {
    const group = await db.prepare('SELECT id FROM nucleation_groups WHERE id = ?').get(wantedGroup);
    groupId = group ? group.id : null;
  }

  const columns = ['id', 'couple_id', 'name', 'phone_1', 'phone_2', 'status', 'group_id', 'created_at', 'updated_at', ...Object.keys(extra)];
  await db.prepare(`INSERT INTO nucleation_contacts (${columns.join(', ')}) VALUES (${columns.map(column => '@' + column).join(', ')})`).run({
    id,
    couple_id: data.coupleId || null,
    name,
    phone_1: data.phone1 || '',
    phone_2: data.phone2 || '',
    status: data.status || 'Pendente',
    group_id: groupId,
    created_at: ts,
    updated_at: ts,
    ...extra
  });
  return id;
}

router.post('/', async (req, res) => {
  try {
    const id = await createContact(req.body || {});
    res.status(201).json(await loadContactFull(id));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Erro ao criar contato:', error);
    res.status(500).json({ error: 'Erro ao criar contato: ' + error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body || {};
    const ts = nowIso();

    const current = await db.prepare('SELECT * FROM nucleation_contacts WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Contato não encontrado.' });
    // Só altera o que veio no corpo: telas antigas que enviam apenas nome/telefones não apagam o resto.
    const has = key => Object.prototype.hasOwnProperty.call(data, key);
    const sets = { updated_at: ts };
    for (const [key, column] of Object.entries(CONTACT_FIELDS)) if (has(key)) sets[column] = cleanField(key, data[key]);
    const noivoName = has('noivoName') ? sets.noivo_name : current.noivo_name;
    const noivaName = has('noivaName') ? sets.noiva_name : current.noiva_name;
    if (has('name') || has('noivoName') || has('noivaName')) sets.name = text(data.name, 150) || joinNames(noivoName, noivaName) || current.name;
    if (has('phone1')) sets.phone_1 = data.phone1 || '';
    if (has('phone2')) sets.phone_2 = data.phone2 || '';
    if (has('status') && data.status) sets.status = data.status;
    await db.prepare(`UPDATE nucleation_contacts SET ${Object.keys(sets).map(column => `${column} = @${column}`).join(', ')} WHERE id = @id`).run({ id, ...sets });

    const contact = await loadContactFull(id);
    res.json(contact);
  } catch (error) {
    console.error('Erro ao atualizar contato:', error);
    res.status(500).json({ error: 'Erro ao atualizar contato: ' + error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM nucleation_contacts WHERE id = ?').run(req.params.id);
    res.status(204).end();
  } catch (error) {
    console.error('Erro ao excluir contato:', error);
    res.status(500).json({ error: 'Erro ao excluir contato: ' + error.message });
  }
});

// Registrar tentativa de contato
router.post('/:id/attempts', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body || {};
    const attemptId = uuid();
    const ts = nowIso();

    await db.prepare(`
      INSERT INTO nucleation_attempts (id, nucleation_id, scheduled_date, contacted_by, result, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(attemptId, id, data.scheduledDate || '', data.contactedBy || null, data.result || 'Agendado', data.notes || '', ts);

    // Se a tentativa teve sucesso, marca o contato como "Em Andamento" (a menos que já esteja convertido)
    if (data.result === 'Sucesso') {
      const contactRow = await db.prepare('SELECT * FROM nucleation_contacts WHERE id = ?').get(id);
      if (contactRow && contactRow.status === 'Pendente') {
        await db.prepare('UPDATE nucleation_contacts SET status = ?, updated_at = ? WHERE id = ?')
          .run('Em Andamento', nowIso(), id);
      }
    }

    const contact = await loadContactFull(id);
    res.status(201).json(contact);
  } catch (error) {
    console.error('Erro ao registrar tentativa:', error);
    res.status(500).json({ error: 'Erro ao registrar tentativa: ' + error.message });
  }
});

router.put('/attempts/:attemptId', async (req, res) => {
  try {
    const { attemptId } = req.params;
    const data = req.body || {};

    await db.prepare(`
      UPDATE nucleation_attempts SET
        scheduled_date = ?, contacted_by = ?, result = ?, notes = ?
      WHERE id = ?
    `).run(data.scheduledDate || '', data.contactedBy || null, data.result || 'Agendado', data.notes || '', attemptId);

    const attemptRow = await db.prepare('SELECT * FROM nucleation_attempts WHERE id = ?').get(attemptId);
    if (!attemptRow) return res.status(404).json({ error: 'Tentativa não encontrada.' });

    // Se a tentativa teve sucesso, marca o contato como "Em Andamento" (a menos que já esteja convertido)
    if (data.result === 'Sucesso') {
      const contactRow = await db.prepare('SELECT * FROM nucleation_contacts WHERE id = ?').get(attemptRow.nucleation_id);
      if (contactRow && contactRow.status === 'Pendente') {
        await db.prepare('UPDATE nucleation_contacts SET status = ?, updated_at = ? WHERE id = ?')
          .run('Em Andamento', nowIso(), attemptRow.nucleation_id);
      }
    }

    const contact = await loadContactFull(attemptRow.nucleation_id);
    res.json(contact);
  } catch (error) {
    console.error('Erro ao atualizar tentativa:', error);
    res.status(500).json({ error: 'Erro ao atualizar tentativa: ' + error.message });
  }
});

// Converter contato em MFCista (sem equipe)
router.post('/:id/convert', async (req, res) => {
  try {
    const { id } = req.params;
    const contactRow = await db.prepare('SELECT * FROM nucleation_contacts WHERE id = ?').get(id);
    if (!contactRow) return res.status(404).json({ error: 'Contato não encontrado.' });
    if (contactRow.converted_member_id) {
      return res.status(400).json({ error: 'Este contato já foi convertido em MFCista.' });
    }

    const data = req.body || {};
    const memberId = uuid();
    const ts = nowIso();

    await db.prepare(`
      INSERT INTO members (
        id, name, phone, status, team_id, family_name, relationship_type, pays_monthly,
        created_at, updated_at
      ) VALUES (
        @id, @name, @phone, @status, NULL, @familyName, 'Titular', 0,
        @createdAt, @updatedAt
      )
    `).run({
      id: memberId,
      name: data.name || contactRow.name,
      phone: data.phone || contactRow.phone_1,
      status: 'Aguardando',
      familyName: data.name || contactRow.name,
      createdAt: ts,
      updatedAt: ts
    });

    await db.prepare(`
      UPDATE nucleation_contacts SET status = 'Convertido', converted_member_id = @memberId, updated_at = @updatedAt
      WHERE id = @id
    `).run({ memberId, updatedAt: ts, id });

    const memberRow = await db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
    const contact = await loadContactFull(id);
    res.status(201).json({ contact, member: rowToMember(memberRow) });
  } catch (error) {
    console.error('Erro ao converter contato:', error);
    res.status(500).json({ error: 'Erro ao converter contato: ' + error.message });
  }
});

module.exports = router;
