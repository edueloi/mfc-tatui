const { db } = require('../db-mysql');
const { v4: uuid } = require('uuid');
const { eventCostCenter } = require('../utils/ledger-centers');
const { ensureEventSchema } = require('../utils/events-schema');

module.exports = (router, ensureLedger) => {
  router.get('/ledger-cost-centers', async (req, res) => {
    try {
      await ensureLedger(); await ensureEventSchema();
      const events = await db.prepare('SELECT id, name, date FROM events').all();
      for (const event of events) await eventCostCenter(event);
      const rows = await db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM ledger l WHERE l.cost_center_id=c.id) AS entry_count FROM ledger_cost_centers c WHERE c.deleted_at IS NULL ORDER BY c.name`).all();
      res.json(rows.map(row => ({ id: row.id, name: row.name, description: row.description, eventId: row.event_id, entryCount: Number(row.entry_count) })));
    } catch (error) { res.status(500).json({ error: 'Não foi possível carregar os centros de custo: ' + error.message }); }
  });
  router.post('/ledger-cost-centers', async (req, res) => {
    try {
      await ensureLedger();
      const name = String(req.body.name || '').trim();
      if (name.length < 2 || name.length > 160) return res.status(400).json({ error: 'Informe um nome de 2 a 160 caracteres.' });
      const existing = await db.prepare('SELECT * FROM ledger_cost_centers WHERE name=?').get(name);
      if (existing && !existing.deleted_at) return res.status(409).json({ error: 'Já existe um centro com esse nome.' });
      const id = existing?.id || uuid();
      if (existing) await db.prepare('UPDATE ledger_cost_centers SET deleted_at=NULL, description=? WHERE id=?').run(String(req.body.description || '').slice(0, 500), id);
      else await db.prepare('INSERT INTO ledger_cost_centers(id,name,description) VALUES(?,?,?)').run(id, name, String(req.body.description || '').slice(0, 500));
      res.status(201).json({ id, name, description: String(req.body.description || '').slice(0, 500), eventId: existing?.event_id || null, entryCount: 0 });
    } catch (error) { res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: error.code === 'ER_DUP_ENTRY' ? 'Já existe um centro com esse nome.' : 'Não foi possível criar o centro.' }); }
  });
  router.put('/ledger-cost-centers/:id', async (req, res) => {
    try {
      await ensureLedger();
      const name = String(req.body.name || '').trim();
      if (name.length < 2 || name.length > 160) return res.status(400).json({ error: 'Informe um nome de 2 a 160 caracteres.' });
      const saved = await db.transaction(async connection => {
        const [rows] = await connection.execute('SELECT * FROM ledger_cost_centers WHERE id=? AND deleted_at IS NULL FOR UPDATE', [req.params.id]);
        if (!rows[0]) return null;
        await connection.execute('UPDATE ledger_cost_centers SET name=?, description=? WHERE id=?', [name, String(req.body.description || '').slice(0, 500), req.params.id]);
        await connection.execute('UPDATE ledger SET cost_center=? WHERE cost_center_id=?', [name, req.params.id]);
        return { id: req.params.id, name, description: String(req.body.description || '').slice(0, 500), eventId: rows[0].event_id };
      });
      if (!saved) return res.status(404).json({ error: 'Centro não encontrado.' });
      res.json(saved);
    } catch (error) { res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: error.code === 'ER_DUP_ENTRY' ? 'Já existe um centro com esse nome.' : 'Não foi possível atualizar o centro.' }); }
  });
  router.delete('/ledger-cost-centers/:id', async (req, res) => {
    try {
      await ensureLedger();
      const used = await db.transaction(async connection => {
        await connection.execute('SELECT id FROM ledger_cost_centers WHERE id=? FOR UPDATE', [req.params.id]);
        const [rows] = await connection.execute('SELECT id FROM ledger WHERE cost_center_id=? LIMIT 1', [req.params.id]);
        if (rows.length) return true;
        await connection.execute('UPDATE ledger_cost_centers SET deleted_at=NOW() WHERE id=?', [req.params.id]);
        return false;
      });
      if (used) return res.status(409).json({ error: 'Este centro possui lançamentos. Reclassifique os lançamentos antes de excluí-lo.' });
      res.status(204).end();
    } catch (error) { res.status(500).json({ error: 'Não foi possível excluir o centro.' }); }
  });
};
