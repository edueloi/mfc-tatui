// Rotas de Nucleação (acompanhamento pós Encontro de Noivos)

const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { rowToNucleationContact, rowToNucleationAttempt, rowToMember } = require('../models/converters');
const { nowIso } = require('../utils/helpers');

const router = express.Router();

// Campos do cadastro de contato (casal + endereço + observações). O nome e os telefones continuam nas colunas antigas.
const CONTACT_EXTRA_COLUMNS = [
  ['noivo_name', 'VARCHAR(150)'], ['noivo_email', 'VARCHAR(150)'], ['noivo_dob', 'VARCHAR(10)'],
  ['noiva_name', 'VARCHAR(150)'], ['noiva_email', 'VARCHAR(150)'], ['noiva_dob', 'VARCHAR(10)'],
  ['zip', 'VARCHAR(9)'], ['street', 'VARCHAR(200)'], ['address_number', 'VARCHAR(20)'], ['neighborhood', 'VARCHAR(120)'],
  ['complement', 'VARCHAR(120)'], ['city', 'VARCHAR(120)'], ['state', 'VARCHAR(2)'], ['notes', 'TEXT'],
];
const CONTACT_FIELDS = {
  noivoName: 'noivo_name', noivoEmail: 'noivo_email', noivoDob: 'noivo_dob',
  noivaName: 'noiva_name', noivaEmail: 'noiva_email', noivaDob: 'noiva_dob',
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

router.get('/groups', async (req, res) => {
  try {
    const groups = await db.prepare(`SELECT ng.*, COUNT(nc.id) AS contacts_count
      FROM nucleation_groups ng LEFT JOIN nucleation_contacts nc ON nc.group_id = ng.id
      GROUP BY ng.id ORDER BY ng.name`).all();
    res.json(groups.map(group => ({ id: group.id, name: group.name, description: group.description || '', contactsCount: Number(group.contacts_count) || 0, createdAt: group.created_at, updatedAt: group.updated_at })));
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar grupos de nucleação: ' + error.message }); }
});

router.post('/groups', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (name.length < 3) return res.status(400).json({ error: 'Informe o nome do grupo (mínimo 3 letras).' });
    const id = uuid(), ts = nowIso();
    await db.prepare('INSERT INTO nucleation_groups (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, name, String(req.body?.description || '').trim(), ts, ts);
    res.status(201).json({ id, name, description: String(req.body?.description || '').trim(), contactsCount: 0, createdAt: ts, updatedAt: ts });
  } catch (error) { res.status(500).json({ error: 'Erro ao criar grupo de nucleação: ' + error.message }); }
});

router.get('/groups/:id', async (req, res) => {
  try {
    const group = await db.prepare('SELECT * FROM nucleation_groups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });
    const [contacts, history] = await Promise.all([
      db.prepare(`SELECT nc.*, ng.name AS group_name, (SELECT COUNT(*) FROM nucleation_attempts na WHERE na.nucleation_id = nc.id) AS attempts_count FROM nucleation_contacts nc LEFT JOIN nucleation_groups ng ON ng.id = nc.group_id WHERE nc.group_id = ? ORDER BY nc.name`).all(group.id),
      db.prepare('SELECT * FROM nucleation_group_history WHERE group_id = ? ORDER BY occurred_at DESC, created_at DESC').all(group.id),
    ]);
    res.json({ id: group.id, name: group.name, description: group.description || '', createdAt: group.created_at, updatedAt: group.updated_at,
      contacts: contacts.map(row => ({ ...rowToNucleationContact(row), attemptsCount: Number(row.attempts_count) || 0 })),
      history: history.map(item => ({ id: item.id, groupId: item.group_id, occurredAt: item.occurred_at || '', notes: item.notes || '', createdAt: item.created_at })) });
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar grupo de nucleação: ' + error.message }); }
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

router.post('/', async (req, res) => {
  try {
    const data = req.body || {};

    if (data.coupleId) {
      const existing = await db.prepare('SELECT id FROM nucleation_contacts WHERE couple_id = ?').get(data.coupleId);
      if (existing) {
        return res.status(400).json({ error: 'Este casal já foi enviado para a Nucleação.' });
      }
    }

    const id = uuid();
    const ts = nowIso();

    const extra = {};
    for (const [key, column] of Object.entries(CONTACT_FIELDS)) extra[column] = cleanField(key, data[key]);
    const name = text(data.name, 150) || joinNames(extra.noivo_name, extra.noiva_name);
    if (!name) return res.status(400).json({ error: 'Informe o nome do noivo ou da noiva.' });
    let groupId = null;
    if (data.groupId) {
      const group = await db.prepare('SELECT id FROM nucleation_groups WHERE id = ?').get(data.groupId);
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

    const contact = await loadContactFull(id);
    res.status(201).json(contact);
  } catch (error) {
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
