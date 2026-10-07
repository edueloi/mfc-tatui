// Esquema dos eventos (colunas/tabelas criadas sozinhas) e vínculo com o Encontro de Noivos

const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');

const EVENT_COLUMNS = [
  ['event_kind', "VARCHAR(20) NOT NULL DEFAULT 'interno'"],
  ['has_fee', 'TINYINT(1) NOT NULL DEFAULT 1'],
  ['end_date', 'VARCHAR(20) NULL'],
  ['start_time', 'VARCHAR(10) NULL'],
  ['end_time', 'VARCHAR(10) NULL'],
  ['image_url', 'VARCHAR(255) NULL'],
  ['notes', 'TEXT NULL'],
  ['registration_open', 'TINYINT(1) NOT NULL DEFAULT 1'],
  ['registration_deadline', 'VARCHAR(20) NULL'],
  ['capacity', 'INT NULL'],
  ['participants_goal', 'INT NULL'],
  ['public_token', 'VARCHAR(36) NULL'],
  ['bridal_meeting_id', 'VARCHAR(36) NULL'],
  ['is_closed', 'TINYINT(1) NOT NULL DEFAULT 0'],
];

const EXPENSE_COLUMNS = [
  ['is_extra', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ['expense_date', 'VARCHAR(20) NULL'],
];

const columnsOf = async table => {
  const rows = await db.prepare('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?').all(table);
  return new Set(rows.map(row => row.COLUMN_NAME || row.column_name));
};

const tableExists = async table => !!(await db.prepare('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?').get(table));

/** Evento criado a partir de um encontro de noivos: externo, sem taxa (os casais pagam na ficha), mesmo nome/data/horário/local. */
const createEventFromMeeting = async meeting => {
  const id = uuid();
  await db.prepare(`
    INSERT INTO events (id, name, date, start_time, end_time, location, description, event_kind, has_fee, registration_open, is_active, show_on_dashboard,
      cost_value, goal_value, public_token, bridal_meeting_id, city_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'externo', 0, 0, ?, 1, 0, 0, ?, ?, ?)
  `).run(id, meeting.name, meeting.date, meeting.start_time || null, meeting.end_time || null, meeting.location || null,
    'Encontro de Noivos. Os casais são cadastrados e pagam pela ficha do encontro; aqui ficam os gastos, as entradas e o resultado.',
    Number(meeting.is_active) ? 1 : 0, uuid(), meeting.id, meeting.city_id || null);
  return id;
};

let schemaReady;
const ensureEventSchema = () => {
  if (!schemaReady) {
    schemaReady = (async () => {
      const names = await columnsOf('events');
      for (const [name, definition] of EVENT_COLUMNS) {
        if (names.has(name)) continue;
        await db.prepare(`ALTER TABLE events ADD COLUMN ${name} ${definition}`).run();
        // Eventos antigos sem valor de ingresso passam a ser "sem taxa".
        if (name === 'has_fee') await db.prepare('UPDATE events SET has_fee = 0 WHERE ticket_value IS NULL OR ticket_value = 0').run();
      }
      const expenseNames = await columnsOf('event_expenses');
      for (const [name, definition] of EXPENSE_COLUMNS) if (!expenseNames.has(name)) await db.prepare(`ALTER TABLE event_expenses ADD COLUMN ${name} ${definition}`).run();

      await db.prepare(`
        CREATE TABLE IF NOT EXISTS event_items (
          id VARCHAR(36) PRIMARY KEY, event_id VARCHAR(36) NOT NULL, name VARCHAR(255) NOT NULL, quantity INT NOT NULL DEFAULT 1, unit VARCHAR(30) NULL,
          team_id VARCHAR(36) NULL, assigned_to VARCHAR(255) NULL, status VARCHAR(20) NOT NULL DEFAULT 'Pendente', created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `).run();
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS event_registrations (
          id VARCHAR(36) PRIMARY KEY, event_id VARCHAR(36) NOT NULL, member_id VARCHAR(36) NULL, team_id VARCHAR(36) NULL, name VARCHAR(255) NOT NULL,
          phone VARCHAR(30) NULL, email VARCHAR(255) NULL, guests INT NOT NULL DEFAULT 0, status VARCHAR(20) NOT NULL DEFAULT 'Inscrito',
          amount_due DECIMAL(10,2) NOT NULL DEFAULT 0, amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0, payment_status VARCHAR(20) NOT NULL DEFAULT 'Pendente',
          source VARCHAR(20) NOT NULL DEFAULT 'manual', notes TEXT NULL, created_by VARCHAR(36) NULL, created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `).run();
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS event_incomes (
          id VARCHAR(36) PRIMARY KEY, event_id VARCHAR(36) NOT NULL, description VARCHAR(255) NOT NULL, amount DECIMAL(10,2) NOT NULL,
          income_date VARCHAR(20) NULL, created_by VARCHAR(36) NULL, created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `).run();

      const withoutToken = await db.prepare('SELECT id FROM events WHERE public_token IS NULL').all();
      for (const row of withoutToken) await db.prepare('UPDATE events SET public_token = ? WHERE id = ?').run(uuid(), row.id);

      // Todo encontro de noivos já cadastrado ganha o seu evento (uma vez só).
      if (await tableExists('bridal_meetings')) {
        const pending = await db.prepare('SELECT * FROM bridal_meetings WHERE id NOT IN (SELECT bridal_meeting_id FROM events WHERE bridal_meeting_id IS NOT NULL)').all();
        for (const meeting of pending) await createEventFromMeeting(meeting);
      }
    })().catch(error => { schemaReady = undefined; console.error('Não foi possível preparar o esquema de eventos:', error.message); throw error; });
  }
  return schemaReady;
};

/** Encontro de noivos criado: cria o evento ligado a ele. */
const eventForNewMeeting = async meetingId => {
  await ensureEventSchema();
  const existing = await db.prepare('SELECT id FROM events WHERE bridal_meeting_id = ?').get(meetingId);
  if (existing) return existing.id;
  const meeting = await db.prepare('SELECT * FROM bridal_meetings WHERE id = ?').get(meetingId);
  return meeting ? createEventFromMeeting(meeting) : null;
};

/** Encontro editado: nome, data, horário, local e situação acompanham no evento. */
const syncEventWithMeeting = async meetingId => {
  await ensureEventSchema();
  const meeting = await db.prepare('SELECT * FROM bridal_meetings WHERE id = ?').get(meetingId);
  if (!meeting) return;
  const event = await db.prepare('SELECT id FROM events WHERE bridal_meeting_id = ?').get(meetingId);
  if (!event) { await createEventFromMeeting(meeting); return; }
  await db.prepare('UPDATE events SET name = ?, date = ?, start_time = ?, end_time = ?, location = ?, is_active = ? WHERE id = ?')
    .run(meeting.name, meeting.date, meeting.start_time || null, meeting.end_time || null, meeting.location || null, Number(meeting.is_active) ? 1 : 0, event.id);
};

/** Encontro excluído: o evento fica (tem gastos e entradas), só deixa de estar ligado. */
const detachEventFromMeeting = async meetingId => {
  await ensureEventSchema();
  await db.prepare('UPDATE events SET bridal_meeting_id = NULL WHERE bridal_meeting_id = ?').run(meetingId);
};

const CLOSE_AFTER_DAYS = 7;
const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (date, days) => new Date(new Date(`${date}T12:00:00`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
/** Encerrado à mão ou 7 dias depois do fim do evento. */
const isEventLocked = row => Number(row.is_closed) === 1 || todayIso() > addDays(row.end_date || row.date, CLOSE_AFTER_DAYS);

module.exports = { ensureEventSchema, isEventLocked, eventForNewMeeting, syncEventWithMeeting, detachEventFromMeeting };
