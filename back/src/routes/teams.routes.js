// Rotas de equipes

const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { rowToTeam } = require('../models/converters');
const { nowIso, toInt } = require('../utils/helpers');

const router = express.Router();

router.get('/', async (req, res) => {
  const rows = await db.prepare(`
    SELECT t.*, (
      SELECT COUNT(1) FROM members m WHERE m.team_id = t.id
    ) AS member_count
    FROM teams t
    ORDER BY t.name
  `).all();
  res.json(rows.map(rowToTeam));
});

router.post('/', async (req, res) => {
  const { name, city, state, isYouth } = req.body || {};
  if (!name || !city || !state) return res.status(400).json({ error: 'Dados obrigatorios.' });
  const id = uuid();
  await db.prepare('INSERT INTO teams (id, name, city, state, is_youth, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name.trim(), city.trim(), state.trim(), toInt(isYouth), nowIso());
  const row = await db.prepare(`SELECT t.*, 0 AS member_count FROM teams t WHERE id = ?`).get(id);
  res.status(201).json(rowToTeam(row));
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, city, state, isYouth } = req.body || {};
  if (!name || !city || !state) return res.status(400).json({ error: 'Dados obrigatorios.' });
  await db.prepare('UPDATE teams SET name = ?, city = ?, state = ?, is_youth = ? WHERE id = ?')
    .run(name.trim(), city.trim(), state.trim(), toInt(isYouth), id);
  const row = await db.prepare(`SELECT t.*, (SELECT COUNT(1) FROM members m WHERE m.team_id = t.id) AS member_count FROM teams t WHERE id = ?`).get(id);
  res.json(rowToTeam(row));
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  await db.prepare('DELETE FROM teams WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
