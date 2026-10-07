// Rotas de usuários do sistema

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { rowToUser } = require('../models/converters');
const { nowIso, toInt } = require('../utils/helpers');

const router = express.Router();

const ADMIN_ROLE = 'Administrador';
const MIN_PASSWORD = 6;

const usernameTaken = async (username, exceptId) => {
  const row = await db.prepare('SELECT id FROM users WHERE lower(username) = lower(?) AND id <> ?').get(String(username).trim(), exceptId || '');
  return !!row;
};

/** Sempre precisa sobrar ao menos um administrador ativo, senão ninguém mais acessa os Ajustes. */
const otherActiveAdmins = async (exceptId) => {
  const rows = await db.prepare('SELECT id FROM users WHERE role = ? AND active = 1 AND id <> ?').all(ADMIN_ROLE, exceptId);
  return rows.length;
};

router.get('/', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM users ORDER BY name').all();
  res.json(rows.map(rowToUser));
});

router.post('/', async (req, res) => {
  const data = req.body || {};
  if (!data.username || !data.password || !data.name || !data.cityId || !data.role) {
    return res.status(400).json({ error: 'Nome, usuário, senha, unidade e nível de acesso são obrigatórios.' });
  }
  if (String(data.password).length < MIN_PASSWORD) {
    return res.status(400).json({ error: `A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.` });
  }
  if (await usernameTaken(data.username)) {
    return res.status(409).json({ error: 'Já existe um usuário com este login.' });
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
  const current = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (!data.username || !data.name || !data.cityId || !data.role) {
    return res.status(400).json({ error: 'Nome, usuário, unidade e nível de acesso são obrigatórios.' });
  }
  if (data.password && String(data.password).length < MIN_PASSWORD) {
    return res.status(400).json({ error: `A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.` });
  }
  if (await usernameTaken(data.username, id)) {
    return res.status(409).json({ error: 'Já existe um usuário com este login.' });
  }

  // Campos que não vêm no corpo mantêm o valor atual (antes a equipe era apagada a cada edição).
  const active = data.active === undefined ? Number(current.active) : toInt(data.active);
  const teamId = data.teamId === undefined ? current.team_id : (data.teamId || null);
  const losesAdmin = current.role === ADMIN_ROLE && Number(current.active) === 1 && (data.role !== ADMIN_ROLE || !active);
  if (losesAdmin && (await otherActiveAdmins(id)) === 0) {
    return res.status(422).json({ error: 'Este é o único administrador ativo. Cadastre outro antes de alterar o nível ou inativar.' });
  }

  await db.prepare(`
    UPDATE users SET
      username = @username,
      email = @email,
      name = @name,
      city_id = @cityId,
      role = @role,
      team_id = @teamId,
      active = @active,
      password_hash = @passwordHash,
      updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id,
    username: String(data.username).trim(),
    email: data.email || '',
    name: String(data.name).trim(),
    cityId: data.cityId,
    role: data.role,
    teamId,
    active,
    passwordHash: data.password ? bcrypt.hashSync(data.password, 10) : current.password_hash,
    updatedAt: nowIso()
  });
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json(rowToUser(row));
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const current = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!current) return res.status(204).end();
  if (current.role === ADMIN_ROLE && Number(current.active) === 1 && (await otherActiveAdmins(id)) === 0) {
    return res.status(422).json({ error: 'Este é o único administrador ativo e não pode ser excluído.' });
  }
  await db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
