// Rotas de Nucleação (acompanhamento pós Encontro de Noivos)

const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { rowToNucleationContact, rowToNucleationAttempt, rowToMember } = require('../models/converters');
const { nowIso } = require('../utils/helpers');

const router = express.Router();

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
      p2.name AS couple_noiva_name
    FROM nucleation_contacts nc
    LEFT JOIN bridal_partners p1 ON p1.couple_id = nc.couple_id AND p1.role = 'noivo'
    LEFT JOIN bridal_partners p2 ON p2.couple_id = nc.couple_id AND p2.role = 'noiva'
    ORDER BY nc.created_at DESC
  `).all();

  res.json(rows.map(row => ({
    ...rowToNucleationContact(row),
    attemptsCount: row.attempts_count || 0,
    coupleNoivoName: row.couple_noivo_name || null,
    coupleNoivaName: row.couple_noiva_name || null
  })));
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

    await db.prepare(`
      INSERT INTO nucleation_contacts (id, couple_id, name, phone_1, phone_2, status, created_at, updated_at)
      VALUES (@id, @coupleId, @name, @phone1, @phone2, @status, @createdAt, @updatedAt)
    `).run({
      id,
      coupleId: data.coupleId || null,
      name: data.name || '',
      phone1: data.phone1 || '',
      phone2: data.phone2 || '',
      status: data.status || 'Pendente',
      createdAt: ts,
      updatedAt: ts
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

    await db.prepare(`
      UPDATE nucleation_contacts SET
        name = @name, phone_1 = @phone1, phone_2 = @phone2, status = @status, updated_at = @updatedAt
      WHERE id = @id
    `).run({
      id,
      name: data.name || '',
      phone1: data.phone1 || '',
      phone2: data.phone2 || '',
      status: data.status || 'Pendente',
      updatedAt: ts
    });

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
