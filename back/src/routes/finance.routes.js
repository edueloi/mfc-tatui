// Rotas de pagamentos e finanças

const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { rowToEventSale, rowToPayment, rowToLedger, rowToLedgerEntity } = require('../models/converters');
const { nowIso, toInt } = require('../utils/helpers');
const { canBeChargedMonthly } = require('../utils/payment-rules');
const { validReceiptDate } = require('../utils/payment-accounting');
const { ensureEventSchema, isEventLocked } = require('../utils/events-schema');

const router = express.Router();

// Cada lançamento pertence a um Livro Caixa (financial_entities). A coluna é criada sozinha na primeira execução.
let ledgerReady;
const ensureLedgerEntityColumn = () => {
  if (!ledgerReady) {
    ledgerReady = (async () => {
      const column = await db.prepare("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ledger' AND COLUMN_NAME = 'entity_id'").get();
      if (!column) await db.prepare('ALTER TABLE ledger ADD COLUMN entity_id VARCHAR(36) NULL').run();
    })().catch(error => { ledgerReady = undefined; console.error('Não foi possível preparar a coluna entity_id do livro caixa:', error.message); throw error; });
  }
  return ledgerReady;
};

// Vendas de eventos
router.get('/event-sales', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM event_sales ORDER BY date DESC').all();
  res.json(rows.map(rowToEventSale));
});

router.post('/event-sales', async (req, res) => {
  const data = req.body || {};
  await ensureEventSchema();
  const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(data.eventId);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });
  if (!Number(event.is_active)) return res.status(422).json({ error: 'Este evento foi cancelado.' });
  if (isEventLocked(event)) return res.status(422).json({ error: 'Este evento já foi encerrado. Reabra o evento para registrar vendas.' });
  // Sem taxa não há ingresso para vender.
  if (!Number(event.has_fee) || !(parseFloat(event.ticket_value) > 0)) return res.status(422).json({ error: 'Este evento não tem taxa, então não há venda de ingresso.' });
  if (!data.teamId || !data.memberId) return res.status(400).json({ error: 'Informe a equipe e o vendedor.' });
  if (!(parseFloat(data.amount) > 0)) return res.status(400).json({ error: 'Informe um valor maior que zero.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.date || ''))) return res.status(400).json({ error: 'Informe a data da venda.' });
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
    String(data.status || '').toLowerCase() === 'pendente' ? 'Pendente' : 'Pago', 
    data.date
  );
  const row = await db.prepare('SELECT * FROM event_sales WHERE id = ?').get(id);
  res.status(201).json(rowToEventSale(row));
});

router.delete('/event-sales/:id', async (req, res) => {
  try {
    await ensureEventSchema();
    const sale = await db.prepare('SELECT * FROM event_sales WHERE id = ?').get(req.params.id);
    if (!sale) return res.status(204).end();
    const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(sale.event_id);
    if (event && isEventLocked(event)) return res.status(422).json({ error: 'Este evento já foi encerrado. Reabra o evento para alterar vendas.' });
    await db.prepare('DELETE FROM event_sales WHERE id = ?').run(req.params.id);
    res.status(204).end();
  } catch (error) { res.status(500).json({ error: 'Erro ao excluir venda: ' + error.message }); }
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
  try {
    await ensureLedgerEntityColumn();
    const { entityId } = req.query;
    const rows = entityId
      ? await db.prepare('SELECT * FROM ledger WHERE entity_id = ? ORDER BY date DESC').all(entityId)
      : await db.prepare('SELECT * FROM ledger ORDER BY date DESC').all();
    res.json(rows.map(rowToLedger));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar lançamentos: ' + error.message });
  }
});

router.post('/ledger', async (req, res) => {
  try {
    await ensureLedgerEntityColumn();
    const data = req.body || {};
    const amount = Number(data.amount);
    if (!['IN', 'OUT'].includes(data.type)) return res.status(400).json({ error: 'Informe se o lançamento é entrada ou saída.' });
    if (!(amount > 0)) return res.status(400).json({ error: 'Informe um valor maior que zero.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.date || ''))) return res.status(400).json({ error: 'Informe uma data válida.' });
    if (data.entityId) {
      const entity = await db.prepare('SELECT id, year FROM financial_entities WHERE id = ?').get(data.entityId);
      if (!entity) return res.status(404).json({ error: 'Livro caixa não encontrado.' });
      if (Number(data.date.slice(0, 4)) !== Number(entity.year)) return res.status(422).json({ error: `A data precisa estar em ${entity.year}, o exercício deste livro.` });
    }
    const id = uuid();
    await db.prepare(`
      INSERT INTO ledger (id, team_id, entity_id, type, description, amount, date, category, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.teamId || null, data.entityId || null, data.type, String(data.description || '').slice(0, 255), amount, data.date, data.category || null, data.createdBy || null);
    const row = await db.prepare('SELECT * FROM ledger WHERE id = ?').get(id);
    res.status(201).json(rowToLedger(row));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar lançamento: ' + error.message });
  }
});

router.delete('/ledger/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM ledger WHERE id = ?').run(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir lançamento: ' + error.message });
  }
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
  try {
    await ensureLedgerEntityColumn();
    const { id } = req.params;
    const used = await db.prepare('SELECT COUNT(*) AS total FROM ledger WHERE entity_id = ?').get(id);
    if (Number(used?.total) > 0) return res.status(422).json({ error: 'Este livro tem lançamentos. Exclua os lançamentos antes de excluir o livro.' });
    await db.prepare('DELETE FROM financial_entities WHERE id = ?').run(id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir livro: ' + error.message });
  }
});

module.exports = router;
