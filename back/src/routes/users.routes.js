// Rotas de usuários do sistema

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { rowToUser } = require('../models/converters');
const { nowIso } = require('../utils/helpers');

const router = express.Router();

router.get('/', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM users ORDER BY name').all();
  res.json(rows.map(rowToUser));
});

router.post('/', async (req, res) => {
  const data = req.body || {};
  if (!data.username || !data.password || !data.name || !data.cityId || !data.role) {
    return res.status(400).json({ error: 'Dados obrigatorios.' });
  }
  const id = uuid();
  const ts = nowIso();
  const passwordHash = bcrypt.hashSync(data.password, 10);
  await db.prepare(`
    INSERT INTO users (id, username, email, name, city_id, role, team_id, password_hash, created_at, updated_at, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, data.username.trim(), data.email || '', data.name.trim(), data.cityId, data.role, data.teamId || null, passwordHash, ts, ts);
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.status(201).json(rowToUser(row));
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body || {};
  const ts = nowIso();
  await db.prepare(`
    UPDATE users SET
      username = @username,
      email = @email,
      name = @name,
      city_id = @cityId,
      role = @role,
      team_id = @teamId,
      updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id,
    username: data.username,
    email: data.email || '',
    name: data.name,
    cityId: data.cityId,
    role: data.role,
    teamId: data.teamId || null,
    updatedAt: ts
  });
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json(rowToUser(row));
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  await db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
