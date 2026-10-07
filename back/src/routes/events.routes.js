// Rotas de eventos

const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { rowToEvent } = require('../models/converters');
const { toInt } = require('../utils/helpers');

const router = express.Router();

router.get('/', async (req, res) => {
  const eventRows = await db.prepare('SELECT * FROM events ORDER BY date DESC').all();
  const events = eventRows.map(rowToEvent);

  const expenseRows = await db.prepare('SELECT * FROM event_expenses').all();
  const quotaRows = await db.prepare('SELECT * FROM event_team_quotas').all();

  const expensesByEvent = {};
  expenseRows.forEach(row => {
    if (!expensesByEvent[row.event_id]) expensesByEvent[row.event_id] = [];
    expensesByEvent[row.event_id].push({ id: row.id, description: row.description, amount: row.amount });
  });

  const quotasByEvent = {};
  quotaRows.forEach(row => {
    if (!quotasByEvent[row.event_id]) quotasByEvent[row.event_id] = [];
    quotasByEvent[row.event_id].push({ teamId: row.team_id, quotaValue: row.quota_value });
  });

  const result = events.map(event => ({
    ...event,
    expenses: expensesByEvent[event.id] || [],
    teamQuotas: quotasByEvent[event.id] || []
  }));

  res.json(result);
});

router.post('/', async (req, res) => {
  const data = req.body || {};
  if (!data.name || !data.date || !data.cityId) {
    return res.status(400).json({ error: 'Dados obrigatorios.' });
  }
  const id = uuid();
  const isActive = data.isActive === undefined ? 1 : toInt(data.isActive);
  const showOnDashboard = data.showOnDashboard === undefined ? 1 : toInt(data.showOnDashboard);

  await db.prepare(`
    INSERT INTO events (
      id, name, date, cost_value, goal_value, city_id, is_active,
      show_on_dashboard, ticket_quantity, ticket_value
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.name,
    data.date,
    data.costValue || 0,
    data.goalValue || 0,
    data.cityId,
    isActive,
    showOnDashboard,
    data.ticketQuantity || null,
    data.ticketValue || null
  );

  const expenses = Array.isArray(data.expenses) ? data.expenses : [];
  const teamQuotas = Array.isArray(data.teamQuotas) ? data.teamQuotas : [];

  const expStmt = await db.prepare('INSERT INTO event_expenses (id, event_id, description, amount) VALUES (?, ?, ?, ?)');
  for (const exp of expenses) {
    await expStmt.run(uuid(), id, exp.description || '', exp.amount || 0);
  }

  const quotaStmt = await db.prepare('INSERT INTO event_team_quotas (id, event_id, team_id, quota_value) VALUES (?, ?, ?, ?)');
  for (const q of teamQuotas) {
    await quotaStmt.run(uuid(), id, q.teamId, q.quotaValue || 0);
  }

  const row = await db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  res.status(201).json({ ...rowToEvent(row), expenses, teamQuotas });
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body || {};
  const isActive = data.isActive === undefined ? 1 : toInt(data.isActive);
  const showOnDashboard = data.showOnDashboard === undefined ? 1 : toInt(data.showOnDashboard);

  await db.prepare(`
    UPDATE events SET
      name = ?,
      date = ?,
      cost_value = ?,
      goal_value = ?,
      city_id = ?,
      is_active = ?,
      show_on_dashboard = ?,
      ticket_quantity = ?,
      ticket_value = ?
    WHERE id = ?
  `).run(
    data.name,
    data.date,
    data.costValue || 0,
    data.goalValue || 0,
    data.cityId,
    isActive,
    showOnDashboard,
    data.ticketQuantity || null,
    data.ticketValue || null,
    id
  );

  await db.prepare('DELETE FROM event_expenses WHERE event_id = ?').run(id);
  await db.prepare('DELETE FROM event_team_quotas WHERE event_id = ?').run(id);

  const expenses = Array.isArray(data.expenses) ? data.expenses : [];
  const teamQuotas = Array.isArray(data.teamQuotas) ? data.teamQuotas : [];

  const expStmt = await db.prepare('INSERT INTO event_expenses (id, event_id, description, amount) VALUES (?, ?, ?, ?)');
  for (const exp of expenses) {
    await expStmt.run(uuid(), id, exp.description || '', exp.amount || 0);
  }

  const quotaStmt = await db.prepare('INSERT INTO event_team_quotas (id, event_id, team_id, quota_value) VALUES (?, ?, ?, ?)');
  for (const q of teamQuotas) {
    await quotaStmt.run(uuid(), id, q.teamId, q.quotaValue || 0);
  }

  const row = await db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  res.json({ ...rowToEvent(row), expenses, teamQuotas });
});

module.exports = router;
