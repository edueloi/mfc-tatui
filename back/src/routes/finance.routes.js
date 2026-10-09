// Rotas de pagamentos e finanças

const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { rowToEventSale, rowToPayment, rowToLedger, rowToLedgerEntity } = require('../models/converters');
const { nowIso, toInt } = require('../utils/helpers');
const { canBeChargedMonthly } = require('../utils/payment-rules');
const { validReceiptDate } = require('../utils/payment-accounting');
const { ensureEventSchema, isEventLocked } = require('../utils/events-schema');
const { validateLedger } = require('../utils/ledger-validation');
const { buildLedgerWorkbook, filterLedgerEntries } = require('../utils/ledger-workbook');
const { ensureCostCenters, resolveCostCenter } = require('../utils/ledger-centers');
const { createPaymentIntegration } = require('../utils/ledger-payments');
const paymentIntegration = createPaymentIntegration(db);

const router = express.Router();

// Cada lançamento pertence a um Livro Caixa (financial_entities). A coluna é criada sozinha na primeira execução.
let ledgerReady;
const ensureLedgerEntityColumn = () => {
  if (!ledgerReady) {
    ledgerReady = (async () => {
      const column = await db.prepare("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ledger' AND COLUMN_NAME = 'entity_id'").get();
      if (!column) await db.prepare('ALTER TABLE ledger ADD COLUMN entity_id VARCHAR(36) NULL').run();
      const additions = {
        status: "VARCHAR(12) NOT NULL DEFAULT 'SETTLED'",
        due_date: 'VARCHAR(10) NULL',
        value_kind: "VARCHAR(10) NOT NULL DEFAULT 'VARIABLE'",
        expected_amount: 'DECIMAL(12,2) NULL',
        counterparty: 'VARCHAR(160) NULL',
        payment_method: 'VARCHAR(60) NULL',
        notes: 'TEXT NULL',
        cost_center: 'VARCHAR(160) NULL',
        analytic: 'VARCHAR(160) NULL',
        financial_account: 'VARCHAR(160) NULL',
        cost_center_id: 'VARCHAR(36) NULL',
        source_key: 'VARCHAR(120) NULL',
      };
      const columns = await db.prepare("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ledger'").all();
      const existing = new Set(columns.map(item => item.COLUMN_NAME));
      for (const [name, definition] of Object.entries(additions)) {
        if (!existing.has(name)) await db.prepare(`ALTER TABLE ledger ADD COLUMN ${name} ${definition}`).run();
      }
      await ensureCostCenters();
      await db.prepare("INSERT IGNORE INTO ledger_cost_centers (id, name) SELECT UUID(), cost_center FROM ledger WHERE cost_center IS NOT NULL AND cost_center <> '' GROUP BY cost_center").run();
      await db.prepare('UPDATE ledger l JOIN ledger_cost_centers c ON c.name = l.cost_center SET l.cost_center_id = c.id WHERE l.cost_center_id IS NULL').run();
      const index = await db.prepare("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ledger' AND INDEX_NAME='uq_ledger_source'").get();
      if (!index) await db.prepare('ALTER TABLE ledger ADD UNIQUE KEY uq_ledger_source(source_key)').run();
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
router.get('/ledger-payment-integration', async (req, res) => {
  try { res.json((await paymentIntegration.mappings()).map(row => ({ year: row.year, entityId: row.entity_id }))); }
  catch (error) { res.status(500).json({ error: 'Não foi possível consultar a integração das equipes.' }); }
});


router.get('/ledger', async (req, res) => {
  try {
    await ensureLedgerEntityColumn();
    const { entityId } = req.query;
    const rows = entityId
      ? await db.prepare('SELECT * FROM ledger WHERE entity_id = ? ORDER BY date DESC').all(entityId)
      : await db.prepare('SELECT * FROM ledger ORDER BY date DESC').all();
    const manual = rows.map(rowToLedger);
    const automatic = await paymentIntegration.entries(manual);
    res.json([...manual, ...automatic.filter(entry => !entityId || entry.entityId === entityId)].sort((a, b) => b.date.localeCompare(a.date)));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar lançamentos: ' + error.message });
  }
});

router.post('/ledger', async (req, res) => {
  try {
    await ensureLedgerEntityColumn();
    const data = req.body || {};
    const amount = Number(data.amount);
    let entity;
    if (data.entityId) {
      entity = await db.prepare('SELECT id, year FROM financial_entities WHERE id = ?').get(data.entityId);
      if (!entity) return res.status(404).json({ error: 'Livro caixa não encontrado.' });
    }
    const validation = validateLedger(data, entity?.year);
    if (validation) return res.status(400).json({ error: validation });
    const id = uuid();
    await db.transaction(async connection => {
    const center = await resolveCostCenter(data, connection);
    await connection.execute(`
      INSERT INTO ledger (id, team_id, entity_id, type, description, amount, date, category, created_by, status, due_date, value_kind, expected_amount, counterparty, payment_method, notes, cost_center, analytic, financial_account, cost_center_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, data.teamId || null, data.entityId || null, data.type, String(data.description || '').slice(0, 255), amount, data.date, String(data.category || '').slice(0, 255) || null, data.createdBy || null,
      data.status || 'SETTLED', data.dueDate || data.date, data.valueKind || 'VARIABLE', data.expectedAmount ?? amount, String(data.counterparty || '').slice(0, 160), String(data.paymentMethod || '').slice(0, 60), String(data.notes || '').slice(0, 5000), center?.name || '', String(data.analytic || '').trim().slice(0, 160), String(data.financialAccount || '').trim().slice(0, 160), center?.id || null]);
    });
    const row = await db.prepare('SELECT * FROM ledger WHERE id = ?').get(id);
    res.status(201).json(rowToLedger(row));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar lançamento: ' + error.message });
  }
});

router.put('/ledger/:id', async (req, res) => {
  try {
    if (req.params.id.startsWith('payment:')) return res.status(422).json({ error: 'Recebimento integrado da Tesouraria: não pode ser alterado como lançamento manual.' });
    await ensureLedgerEntityColumn();
    const row = await db.prepare('SELECT * FROM ledger WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Lançamento não encontrado.' });
    const data = { ...rowToLedger(row), ...req.body };
    if (req.body.costCenter !== undefined && req.body.costCenter !== row.cost_center && req.body.costCenterId === undefined) data.costCenterId = null;
    const entity = row.entity_id ? await db.prepare('SELECT year FROM financial_entities WHERE id = ?').get(row.entity_id) : null;
    const validation = validateLedger(data, entity?.year);
    if (validation) return res.status(400).json({ error: validation });
    await db.transaction(async connection => {
      const center = await resolveCostCenter(data, connection);
      await connection.execute(`UPDATE ledger SET type = ?, description = ?, amount = ?, date = ?, category = ?, status = ?, due_date = ?, value_kind = ?, expected_amount = ?, counterparty = ?, payment_method = ?, notes = ?, cost_center = ?, analytic = ?, financial_account = ?, cost_center_id = ? WHERE id = ?`,
        [data.type, String(data.description || '').slice(0, 255), Number(data.amount), data.date, String(data.category || '').slice(0, 255) || null,
        data.status || 'SETTLED', data.dueDate || data.date, data.valueKind || 'VARIABLE', data.expectedAmount ?? data.amount, String(data.counterparty || '').slice(0, 160), String(data.paymentMethod || '').slice(0, 60), String(data.notes || '').slice(0, 5000), center?.name || '', String(data.analytic || '').trim().slice(0, 160), String(data.financialAccount || '').trim().slice(0, 160), center?.id || null, row.id]);
    });
    res.json(rowToLedger(await db.prepare('SELECT * FROM ledger WHERE id = ?').get(row.id)));
  } catch (error) { res.status(500).json({ error: 'Erro ao atualizar lançamento: ' + error.message }); }
});

router.delete('/ledger/:id', async (req, res) => {
  try {
    if (req.params.id.startsWith('payment:')) return res.status(422).json({ error: 'Recebimento integrado da Tesouraria: não pode ser excluído como lançamento manual.' });
    await db.prepare('DELETE FROM ledger WHERE id = ?').run(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir lançamento: ' + error.message });
  }
});

// Entidades financeiras
router.get('/ledger-entities', async (req, res) => {
  try {
  await paymentIntegration.ensureBooks();
  const rows = await db.prepare('SELECT * FROM financial_entities ORDER BY name').all();
  res.json(rows.map(rowToLedgerEntity));
  } catch (error) { res.status(500).json({ error: 'Não foi possível carregar os livros caixa.' }); }
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
  await ensureLedgerEntityColumn();
  const existing = await db.prepare('SELECT * FROM financial_entities WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Livro caixa não encontrado.' });
  if (!String(data.name || '').trim() || !Number.isInteger(Number(data.year)) || Number(data.year) < 1900 || Number(data.year) > 9999 || !Number.isFinite(Number(data.initialBalance || 0))) return res.status(400).json({ error: 'Informe título, exercício e saldo inicial válidos.' });
  if (Number(existing.year) !== Number(data.year)) {
    if ((await paymentIntegration.mappings()).some(link => link.entity_id === id)) return res.status(422).json({ error: 'O exercício de um livro integrado às equipes não pode ser alterado.' });
    const used = await db.prepare('SELECT COUNT(*) AS total FROM ledger WHERE entity_id = ?').get(id);
    if (Number(used?.total) > 0) return res.status(422).json({ error: 'O exercício de um livro com lançamentos não pode ser alterado.' });
  }
  await db.prepare('UPDATE financial_entities SET name = ?, year = ?, observations = ?, initial_balance = ? WHERE id = ?')
    .run(data.name, data.year, data.observations || null, data.initialBalance || 0, id);
  const row = await db.prepare('SELECT * FROM financial_entities WHERE id = ?').get(id);
  res.json(rowToLedgerEntity(row));
});

// Excel completo do livro: painel, diário, balancetes, contas, pendências e uma aba por centro de custo.
router.get('/ledger-entities/:id/export', async (req, res) => {
  try {
    await ensureLedgerEntityColumn();
    const row = await db.prepare('SELECT * FROM financial_entities WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Livro caixa não encontrado.' });
    const book = rowToLedgerEntity(row);
    const teamsOnly = req.query.report === 'teams';
    if (teamsOnly && !(await paymentIntegration.mappings()).some(link => link.entity_id === book.id)) return res.status(422).json({ error: 'A exportação de equipes usa o livro integrado de mensalidades.' });
    const manual = (await db.prepare('SELECT * FROM ledger WHERE entity_id = ? ORDER BY date').all(book.id)).map(rowToLedger);
    const all = [...manual, ...(await paymentIntegration.entries(manual)).filter(entry => entry.entityId === book.id)].sort((a, b) => a.date.localeCompare(b.date));
    const scope = req.query.scope === 'filtered' ? 'filtered' : 'all';
    const filters = scope === 'filtered' ? req.query : {};
    const source = teamsOnly ? all.filter(entry => entry.paymentId) : all;
    const entries = scope === 'filtered' ? filterLedgerEntries(source, filters) : source;
    const teams = teamsOnly
      ? await db.prepare('SELECT id, name FROM teams ORDER BY name').all() : [];
    const [members, payments, config] = teams.length ? await Promise.all([
      db.prepare('SELECT id, name, team_id, status, relationship_type, pays_monthly, is_payment_inactive, family_name FROM members').all(),
      db.prepare('SELECT p.*, m.name AS member_name FROM payments p LEFT JOIN members m ON m.id = p.member_id').all(),
      db.prepare('SELECT monthly_payment_amount FROM financial_config WHERE id = 1').get(),
    ]) : [[], [], null];
    const buffer = await buildLedgerWorkbook(teamsOnly ? { ...book, name: 'Equipes Base', initialBalance: 0 } : book, entries, { report: teamsOnly ? 'teams' : 'ledger', scope, filters, teams, members, payments: scope === 'all' ? payments : payments.filter(payment => entries.some(entry => entry.paymentId === payment.id)), monthlyAmount: Number(config?.monthly_payment_amount) || 0 });
    const slug = String(book.name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').replace(new RegExp(`-${book.year}$`), '') || 'livro';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Disposition', `attachment; filename="livro-caixa-${teamsOnly ? 'equipes-base' : slug}-${book.year}.xlsx"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar a planilha: ' + error.message });
  }
});

router.delete('/ledger-entities/:id', async (req, res) => {
  try {
    await ensureLedgerEntityColumn();
    const { id } = req.params;
    if ((await paymentIntegration.mappings()).some(link => link.entity_id === id)) return res.status(422).json({ error: 'Este livro está integrado às mensalidades das equipes e não pode ser excluído.' });
    const used = await db.prepare('SELECT COUNT(*) AS total FROM ledger WHERE entity_id = ?').get(id);
    if (Number(used?.total) > 0) return res.status(422).json({ error: 'Este livro tem lançamentos. Exclua os lançamentos antes de excluir o livro.' });
    await db.prepare('DELETE FROM financial_entities WHERE id = ?').run(id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir livro: ' + error.message });
  }
});

require('./ledger-centers.routes')(router, ensureLedgerEntityColumn);
module.exports = router;
