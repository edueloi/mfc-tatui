// Rotas de autenticação

const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db-mysql');
const { rowToUser } = require('../models/converters');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario e senha sao obrigatorios.' });
    }

    // Buscar usuário
    const users = await db.prepare(
      'SELECT * FROM users WHERE lower(username) = lower(?) AND active = 1'
    ).all(username);
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenciais invalidas.' });
    }
    
    const userRow = users[0];

    // Verificar cidade
    const cities = await db.prepare(
      'SELECT * FROM cities WHERE id = ?'
    ).all(userRow.city_id);
    
    if (cities.length === 0 || !cities[0].active) {
      return res.status(403).json({ error: 'Cidade inativa. Acesso bloqueado.' });
    }

    // Validar senha
    const isValid = bcrypt.compareSync(password, userRow.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciais invalidas.' });
    }

    // Se user.team_id está null, tentar sincronizar do member
    if (!userRow.team_id) {
      const members = await db.prepare(
        'SELECT team_id FROM members WHERE name = ?'
      ).all(userRow.name);
      
      if (members.length > 0 && members[0].team_id) {
        userRow.team_id = members[0].team_id;
        // Atualizar no banco para próximos logins
        await db.prepare(
          'UPDATE users SET team_id = ? WHERE id = ?'
        ).run(members[0].team_id, userRow.id);
      }
    }

    return res.json({ user: rowToUser(userRow) });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro ao processar login.' });
  }
});

module.exports = router;
