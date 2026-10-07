// Rotas de pagamentos e finanças

const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { rowToEventSale, rowToPayment, rowToLedger, rowToLedgerEntity } = require('../models/converters');
const { nowIso, toInt } = require('../utils/helpers');
const { canBeChargedMonthly } = require('../utils/payment-rules');
const { validReceiptDate } = require('../utils/payment-accounting');

const router = express.Router();

// Vendas de eventos
router.get('/event-sales', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM event_sales ORDER BY date DESC').all();
  res.json(rows.map(rowToEventSale));
});

router.post('/event-sales', async (req, res) => {
  const data = req.body || {};
  const id = uuid();
  await db.prepare(`
    INSERT INTO event_sales (id, event_id, team_id, member_id, buyer_name, amount, status, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, 
    data.eventId, 
    data.teamId, 
    data.memberId, 
    data.buyerName || '', 
    data.amount || 0, 
    data.status || 'PAGO', 
    data.date
  );
  const row = await db.prepare('SELECT * FROM event_sales WHERE id = ?').get(id);
  res.status(201).json(rowToEventSale(row));
});

// Pagamentos de mensalidade
router.get('/payments', async (req, res) => {
  const rows = await db.prepare(`
    SELECT p.*, m.name as member_name, m.family_name
    FROM payments p
    LEFT JOIN members m ON p.member_id = m.id
    ORDER BY p.date DESC
  `).all();
  res.json(rows.map(rowToPayment));
});

router.post('/payments', async (req, res) => {
  const data = req.body || {};
  if (!data.memberId || !data.teamId || !data.referenceMonth) {
    return res.status(400).json({ error: 'Membro, equipe e referência da mensalidade são obrigatórios.' });
  }
  if (!/^(0?[1-9]|1[0-2])\/\d{4}$/.test(data.referenceMonth) || !validReceiptDate(data.date)) {
    return res.status(400).json({ error: 'Informe a referência da mensalidade (mês/ano) e uma data de recebimento válida.' });
  }
  const [referenceMonth, referenceYear] = data.referenceMonth.split('/').map(Number);
  const reference = `${referenceMonth}/${referenceYear}`;
  const paddedReference = `${String(referenceMonth).padStart(2, '0')}/${referenceYear}`;

  const member = await db.prepare(
    'SELECT id, team_id, relationship_type, pays_monthly, is_payment_inactive FROM members WHERE id = ?'
  ).get(data.memberId);

  if (!member) {
    return res.status(404).json({ error: 'Membro não encontrado.' });
  }

  if (member.team_id !== data.teamId) {
    return res.status(422).json({ error: 'O membro não pertence à equipe informada.' });
  }

  if (!canBeChargedMonthly(member)) {
    return res.status(422).json({ error: 'Este membro é dependente ou está isento de mensalidade.' });
  }

  const existing = await db.prepare(
    'SELECT id FROM payments WHERE member_id = ? AND reference_month IN (?, ?)'
  ).get(data.memberId, reference, paddedReference);
  if (existing) {
    return res.status(409).json({ error: 'A mensalidade deste membro já foi lançada para esta referência.' });
  }

  const id = uuid();
  await db.prepare(`
    INSERT INTO payments (id, member_id, team_id, amount, date, reference_month, status, launched_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, 
    data.memberId, 
    data.teamId, 
    data.amount || 0, 
    data.date, 
    reference,
    data.status || 'PAGO', 
    data.launchedBy || null
  );
  const row = await db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  res.status(201).json(rowToPayment(row));
});

// Livro-caixa (ledger)
router.get('/ledger', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM ledger ORDER BY date DESC').all();
  res.json(rows.map(rowToLedger));
});

router.post('/ledger', async (req, res) => {
  const data = req.body || {};
  const id = uuid();
  await db.prepare(`
    INSERT INTO ledger (id, team_id, type, description, amount, date, category, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.teamId || null,
    data.type,
    data.description || '',
    data.amount || 0,
    data.date,
    data.category || null,
    data.createdBy || null
  );
  const row = await db.prepare('SELECT * FROM ledger WHERE id = ?').get(id);
  res.status(201).json(rowToLedger(row));
});

// Entidades financeiras
router.get('/ledger-entities', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM financial_entities ORDER BY name').all();
  res.json(rows.map(rowToLedgerEntity));
});

router.post('/ledger-entities', async (req, res) => {
  const data = req.body || {};
  if (!data.name || !data.year) return res.status(400).json({ error: 'Dados obrigatorios.' });
  const id = uuid();
  await db.prepare('INSERT INTO financial_entities (id, name, year, created_by, observations, initial_balance) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, data.name, data.year, data.createdBy || null, data.observations || null, data.initialBalance || 0);
  const row = await db.prepare('SELECT * FROM financial_entities WHERE id = ?').get(id);
  res.status(201).json(rowToLedgerEntity(row));
});

router.put('/ledger-entities/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body || {};
  await db.prepare('UPDATE financial_entities SET name = ?, year = ?, observations = ?, initial_balance = ? WHERE id = ?')
    .run(data.name, data.year, data.observations || null, data.initialBalance || 0, id);
  const row = await db.prepare('SELECT * FROM financial_entities WHERE id = ?').get(id);
  res.json(rowToLedgerEntity(row));
});

router.delete('/ledger-entities/:id', async (req, res) => {
  const { id } = req.params;
  await db.prepare('DELETE FROM financial_entities WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
