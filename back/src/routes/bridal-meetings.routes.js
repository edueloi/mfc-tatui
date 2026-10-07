// Rotas de Encontros (turmas/edições do Encontro de Noivos)

const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { rowToBridalMeeting } = require('../models/converters');
const { nowIso, toInt } = require('../utils/helpers');

const router = express.Router();

router.get('/', async (req, res) => {
  const rows = await db.prepare(`
    SELECT bm.*, (SELECT COUNT(*) FROM bridal_couples bc WHERE bc.event_id = bm.id) AS couples_count
    FROM bridal_meetings bm
    ORDER BY bm.date DESC
  `).all();

  res.json(rows.map(row => ({
    ...rowToBridalMeeting(row),
    couplesCount: row.couples_count || 0
  })));
});

router.get('/:id', async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM bridal_meetings WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Encontro não encontrado.' });

    const coupleRows = await db.prepare(`
      SELECT bc.id, bc.status, p1.name AS noivo_name, p2.name AS noiva_name
      FROM bridal_couples bc
      LEFT JOIN bridal_partners p1 ON p1.couple_id = bc.id AND p1.role = 'noivo'
      LEFT JOIN bridal_partners p2 ON p2.couple_id = bc.id AND p2.role = 'noiva'
      WHERE bc.event_id = ?
      ORDER BY p1.name
    `).all(req.params.id);

    res.json({
      ...rowToBridalMeeting(row),
      couples: coupleRows.map(c => ({
        id: c.id,
        status: c.status,
        noivoName: c.noivo_name || '',
        noivaName: c.noiva_name || ''
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar encontro:', error);
    res.status(500).json({ error: 'Erro ao buscar encontro: ' + error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.name || !data.date) {
      return res.status(400).json({ error: 'Nome e data são obrigatórios.' });
    }

    const id = uuid();
    const ts = nowIso();

    await db.prepare(`
      INSERT INTO bridal_meetings (id, city_id, name, date, start_time, end_time, location, pix_key, is_active, created_at, updated_at)
      VALUES (@id, @cityId, @name, @date, @startTime, @endTime, @location, @pixKey, @isActive, @createdAt, @updatedAt)
    `).run({
      id,
      cityId: data.cityId || null,
      name: data.name,
      date: data.date,
      startTime: data.startTime || '',
      endTime: data.endTime || '',
      location: data.location || '',
      pixKey: data.pixKey || '',
      isActive: toInt(data.isActive !== false),
      createdAt: ts,
      updatedAt: ts
    });

    const row = await db.prepare('SELECT * FROM bridal_meetings WHERE id = ?').get(id);
    res.status(201).json(rowToBridalMeeting(row));
  } catch (error) {
    console.error('Erro ao criar encontro:', error);
    res.status(500).json({ error: 'Erro ao criar encontro: ' + error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body || {};
    if (!data.name || !data.date) {
      return res.status(400).json({ error: 'Nome e data são obrigatórios.' });
    }

    const existing = await db.prepare('SELECT is_active FROM bridal_meetings WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Encontro não encontrado.' });

    await db.prepare(`
      UPDATE bridal_meetings SET
        city_id = @cityId, name = @name, date = @date, start_time = @startTime,
        end_time = @endTime, location = @location, pix_key = @pixKey,
        is_active = @isActive, updated_at = @updatedAt
      WHERE id = @id
    `).run({
      id,
      cityId: data.cityId || null,
      name: data.name,
      date: data.date,
      startTime: data.startTime || '',
      endTime: data.endTime || '',
      location: data.location || '',
      pixKey: data.pixKey || '',
      isActive: data.isActive === undefined ? toInt(existing.is_active) : toInt(data.isActive !== false),
      updatedAt: nowIso()
    });

    const row = await db.prepare('SELECT * FROM bridal_meetings WHERE id = ?').get(id);
    res.json(rowToBridalMeeting(row));
  } catch (error) {
    console.error('Erro ao atualizar encontro:', error);
    res.status(500).json({ error: 'Erro ao atualizar encontro: ' + error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM bridal_meetings WHERE id = ?').run(req.params.id);
    res.status(204).end();
  } catch (error) {
    console.error('Erro ao excluir encontro:', error);
    res.status(500).json({ error: 'Erro ao excluir encontro: ' + error.message });
  }
});

module.exports = router;
