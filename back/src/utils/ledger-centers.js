const { db } = require('../db-mysql');
const { v4: uuid } = require('uuid');
let ready;
function ensureCostCenters() {
  if (!ready) ready = db.prepare(`CREATE TABLE IF NOT EXISTS ledger_cost_centers (
    id VARCHAR(36) PRIMARY KEY, name VARCHAR(160) NOT NULL, description VARCHAR(500) NOT NULL DEFAULT '',
    event_id VARCHAR(36) NULL, deleted_at DATETIME NULL,
    UNIQUE KEY uq_ledger_center_name(name), UNIQUE KEY uq_ledger_center_event(event_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).run().catch(error => { ready = null; throw error; });
  return ready;
}
async function eventCostCenter(event) {
  await ensureCostCenters();
  const existing = await db.prepare('SELECT * FROM ledger_cost_centers WHERE event_id = ?').get(event.id);
  if (existing) return existing;
  const name = `${String(event.name).slice(0, 125)} · ${String(event.date).slice(0, 10)} · ${event.id.slice(0, 8)}`;
  await db.prepare('INSERT IGNORE INTO ledger_cost_centers (id, name, description, event_id) VALUES (?, ?, ?, ?)').run(uuid(), name, 'Centro vinculado ao evento. A contabilização é conferida no Livro Caixa.', event.id);
  return db.prepare('SELECT * FROM ledger_cost_centers WHERE event_id = ?').get(event.id);
}
async function resolveCostCenter(data, connection) {
  await ensureCostCenters();
  const query = async (sql, ...params) => connection ? (await connection.execute(sql, params))[0] : db.prepare(sql).all(...params);
  const lock = connection ? ' FOR UPDATE' : '';
  if (data.costCenterId) {
    const [row] = await query('SELECT * FROM ledger_cost_centers WHERE id = ? AND deleted_at IS NULL' + lock, data.costCenterId);
    if (!row) throw new Error('Centro de custo não encontrado ou excluído.');
    return row;
  }
  const name = String(data.costCenter || '').trim().slice(0, 160);
  if (!name) return null;
  await query('INSERT IGNORE INTO ledger_cost_centers (id, name) VALUES (?, ?)', uuid(), name);
  const [row] = await query('SELECT * FROM ledger_cost_centers WHERE name = ?' + lock, name);
  if (row.deleted_at) throw new Error('Esse centro foi excluído. Use outro nome ou um centro ativo.');
  return row;
}
module.exports = { ensureCostCenters, eventCostCenter, resolveCostCenter };
