// Rotas de cidades

const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { rowToCity } = require('../models/converters');
const { toInt } = require('../utils/helpers');

const router = express.Router();

router.get('/', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM cities ORDER BY name').all();
  res.json(rows.map(rowToCity));
});

router.post('/', async (req, res) => {
  const { name, uf, mfcSince } = req.body || {};
  if (!name || !uf) return res.status(400).json({ error: 'Nome e UF obrigatorios.' });
  const id = uuid();
  await db.prepare('INSERT INTO cities (id, name, uf, mfc_since, active) VALUES (?, ?, ?, ?, 1)')
    .run(id, name.trim(), uf.trim(), mfcSince || null);
  const row = await db.prepare('SELECT * FROM cities WHERE id = ?').get(id);
  res.status(201).json(rowToCity(row));
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, uf, mfcSince } = req.body || {};
  await db.prepare('UPDATE cities SET name = ?, uf = ?, mfc_since = ? WHERE id = ?')
    .run(name, uf, mfcSince || null, id);
  const row = await db.prepare('SELECT * FROM cities WHERE id = ?').get(id);
  res.json(rowToCity(row));
});

router.patch('/:id/active', async (req, res) => {
  const { id } = req.params;
  const { active } = req.body || {};
  await db.prepare('UPDATE cities SET active = ? WHERE id = ?').run(toInt(active), id);
  const row = await db.prepare('SELECT * FROM cities WHERE id = ?').get(id);
  res.json(rowToCity(row));
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  await db.prepare('DELETE FROM cities WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
