// Rotas de funções/papéis

const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { toBool } = require('../utils/helpers');

const router = express.Router();

router.get('/', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM roles ORDER BY name').all();
  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    isSystem: toBool(r.is_system),
    permissions: JSON.parse(r.permissions_json)
  })));
});

router.post('/', async (req, res) => {
  const { name, permissions } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nome obrigatorio.' });
  const id = uuid();
  await db.prepare('INSERT INTO roles (id, name, is_system, permissions_json) VALUES (?, ?, 0, ?)')
    .run(id, name.trim(), JSON.stringify(permissions || {}));
  const row = await db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  res.status(201).json({ id: row.id, name: row.name, isSystem: toBool(row.is_system), permissions: JSON.parse(row.permissions_json) });
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, permissions } = req.body || {};
  await db.prepare('UPDATE roles SET name = ?, permissions_json = ? WHERE id = ?')
    .run(name, JSON.stringify(permissions || {}), id);
  const row = await db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  res.json({ id: row.id, name: row.name, isSystem: toBool(row.is_system), permissions: JSON.parse(row.permissions_json) });
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  await db.prepare('DELETE FROM roles WHERE id = ? AND is_system = 0').run(id);
  res.status(204).end();
});

module.exports = router;
