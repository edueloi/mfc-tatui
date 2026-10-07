// Rotas de eventos: dados, metas, gastos e entradas, inscrições, itens, vínculo com o Encontro de Noivos e inscrição pública por link

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const { v4: uuid } = require('uuid');
const { nowIso } = require('../utils/helpers');
const { db } = require('../db-mysql');
const { rowToEvent } = require('../models/converters');
const { toInt, toBool } = require('../utils/helpers');
const { ensureEventSchema, eventForNewMeeting } = require('../utils/events-schema');

const router = express.Router();

router.use(async (req, res, next) => {
  try { await ensureEventSchema(); next(); } catch (error) { res.status(500).json({ error: 'Erro ao preparar eventos: ' + error.message }); }
});

/* ───────────── Conversões e cálculos ───────────── */

const num = value => parseFloat(value) || 0;
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const clean = value => (value === undefined || value === null ? null : String(value).trim() || null);
const KINDS = ['interno', 'externo'];
const REGISTRATION_STATUS = ['Convidado', 'Inscrito', 'Confirmado', 'Cancelado'];
const ITEM_STATUS = ['Pendente', 'Confirmado', 'Entregue'];
/** Dias depois do evento em que ele é encerrado sozinho (igual ao Encontro de Noivos). */
const CLOSE_AFTER_DAYS = 7;

const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (date, days) => new Date(new Date(`${date}T12:00:00`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

/** Encerrado à mão ou passados 7 dias do fim do evento: não aceita mais inscrição, pagamento, gasto nem entrada. */
const isLocked = row => toBool(row.is_closed) || todayIso() > addDays(row.end_date || row.date, CLOSE_AFTER_DAYS);
const LOCKED_MESSAGE = 'Este evento já foi encerrado. Reabra o evento (ou ajuste a data) para fazer alterações.';

const eventFields = row => ({
  ...rowToEvent(row),
  kind: row.event_kind || 'interno',
  hasFee: toBool(row.has_fee),
  endDate: row.end_date || '',
  startTime: row.start_time || '',
  endTime: row.end_time || '',
  imageUrl: row.image_url || '',
  notes: row.notes || '',
  registrationOpen: toBool(row.registration_open),
  registrationDeadline: row.registration_deadline || '',
  capacity: row.capacity === null || row.capacity === undefined ? null : Number(row.capacity),
  participantsGoal: row.participants_goal === null || row.participants_goal === undefined ? null : Number(row.participants_goal),
  publicToken: row.public_token || '',
  bridalMeetingId: row.bridal_meeting_id || null,
  closed: toBool(row.is_closed),
  locked: isLocked(row),
});

const registrationFields = row => ({
  id: row.id, eventId: row.event_id, memberId: row.member_id || null, teamId: row.team_id || null, name: row.name,
  phone: row.phone || '', email: row.email || '', guests: Number(row.guests) || 0, status: row.status,
  amountDue: num(row.amount_due), amountPaid: num(row.amount_paid), paymentStatus: row.payment_status,
  source: row.source, notes: row.notes || '', createdBy: row.created_by || null, createdAt: row.created_at
});

const itemFields = row => ({
  id: row.id, eventId: row.event_id, name: row.name, quantity: Number(row.quantity) || 1, unit: row.unit || '',
  teamId: row.team_id || null, assignedTo: row.assigned_to || '', status: row.status
});

const expenseFields = row => ({ id: row.id, description: row.description, amount: num(row.amount), isExtra: toBool(row.is_extra), date: row.expense_date || '' });
const incomeFields = row => ({ id: row.id, description: row.description, amount: num(row.amount), date: row.income_date || '' });

const people = registration => 1 + (Number(registration.guests) || 0);
const countsAsPerson = registration => registration.status !== 'Cancelado';
const groupBy = (rows, key) => rows.reduce((acc, row) => { (acc[row[key]] = acc[row[key]] || []).push(row); return acc; }, {});
const isPaidSale = sale => String(sale.status || '').toLowerCase() === 'pago';

/** Estatísticas por evento a partir das linhas já carregadas. Casais do Encontro de Noivos contam como 2 pessoas e entram na arrecadação. */
const buildStats = (registrations, sales, items, expenses, incomes, couples) => {
  const active = registrations.filter(countsAsPerson);
  const activeCouples = couples.filter(couple => couple.status !== 'Cancelado');
  const fromRegistrations = registrations.reduce((sum, row) => sum + num(row.amount_paid), 0);
  const fromSales = sales.filter(isPaidSale).reduce((sum, sale) => sum + num(sale.amount), 0);
  const fromCouples = activeCouples.filter(couple => ['Pago', 'Parcial'].includes(couple.payment_status)).reduce((sum, couple) => sum + num(couple.payment_amount), 0);
  const fromIncomes = incomes.reduce((sum, row) => sum + num(row.amount), 0);
  const planned = expenses.filter(row => !toBool(row.is_extra)).reduce((sum, row) => sum + num(row.amount), 0);
  const extra = expenses.filter(row => toBool(row.is_extra)).reduce((sum, row) => sum + num(row.amount), 0);

  const teamStats = {};
  const team = id => (teamStats[id] = teamStats[id] || { teamId: id, registered: 0, raised: 0 });
  active.forEach(row => { if (row.team_id) team(row.team_id).registered += people(row); });
  registrations.forEach(row => { if (row.team_id) team(row.team_id).raised += num(row.amount_paid); });
  sales.filter(isPaidSale).forEach(sale => { team(sale.team_id).raised += num(sale.amount); });

  return {
    stats: {
      registered: active.reduce((sum, row) => sum + people(row), 0) + activeCouples.length * 2,
      confirmed: active.filter(row => row.status === 'Confirmado').reduce((sum, row) => sum + people(row), 0) + activeCouples.filter(couple => couple.status === 'Confirmado').length * 2,
      invited: registrations.filter(row => row.status === 'Convidado').length,
      cancelled: registrations.filter(row => row.status === 'Cancelado').length,
      couples: activeCouples.length,
      due: registrations.filter(countsAsPerson).reduce((sum, row) => sum + num(row.amount_due), 0),
      raised: fromRegistrations + fromSales + fromCouples + fromIncomes,
      raisedBreakdown: { registrations: fromRegistrations, sales: fromSales, couples: fromCouples, incomes: fromIncomes },
      salesRaised: fromSales,
      expensesPlanned: planned,
      expensesExtra: extra,
      expensesTotal: planned + extra,
      itemsTotal: items.length,
      itemsDone: items.filter(item => item.status !== 'Pendente').length,
    },
    teamStats: Object.values(teamStats),
  };
};

const COUPLES_SQL = `
  SELECT bc.id, bc.event_id, bc.status, bc.payment_status, bc.payment_amount, p1.name AS noivo_name, p2.name AS noiva_name
  FROM bridal_couples bc
  LEFT JOIN bridal_partners p1 ON p1.couple_id = bc.id AND p1.role = 'noivo'
  LEFT JOIN bridal_partners p2 ON p2.couple_id = bc.id AND p2.role = 'noiva'
  WHERE bc.event_id IS NOT NULL
`;

const loadEvents = async (onlyId) => {
  const eventRows = onlyId
    ? await db.prepare('SELECT * FROM events WHERE id = ?').all(onlyId)
    : await db.prepare('SELECT * FROM events ORDER BY date DESC').all();
  if (!eventRows.length) return [];
  const [expenseRows, quotaRows, registrationRows, saleRows, itemRows, incomeRows, coupleRows] = await Promise.all([
    db.prepare('SELECT * FROM event_expenses').all(),
    db.prepare('SELECT * FROM event_team_quotas').all(),
    db.prepare('SELECT * FROM event_registrations').all(),
    db.prepare('SELECT * FROM event_sales').all(),
    db.prepare('SELECT * FROM event_items').all(),
    db.prepare('SELECT * FROM event_incomes').all(),
    db.prepare(COUPLES_SQL).all().catch(() => []),
  ]);
  const expenses = groupBy(expenseRows, 'event_id'), quotas = groupBy(quotaRows, 'event_id'), registrations = groupBy(registrationRows, 'event_id'),
    sales = groupBy(saleRows, 'event_id'), items = groupBy(itemRows, 'event_id'), incomes = groupBy(incomeRows, 'event_id'), couples = groupBy(coupleRows, 'event_id');
  return eventRows.map(row => {
    const own = { expenses: expenses[row.id] || [], incomes: incomes[row.id] || [], couples: row.bridal_meeting_id ? (couples[row.bridal_meeting_id] || []) : [] };
    return {
      ...eventFields(row),
      expenses: own.expenses.filter(item => !toBool(item.is_extra)).map(expenseFields),
      extraExpenses: own.expenses.filter(item => toBool(item.is_extra)).map(expenseFields),
      incomes: own.incomes.map(incomeFields),
      couples: own.couples.map(couple => ({ id: couple.id, noivoName: couple.noivo_name || '', noivaName: couple.noiva_name || '', status: couple.status, paymentStatus: couple.payment_status, paymentAmount: num(couple.payment_amount) })),
      teamQuotas: (quotas[row.id] || []).map(item => ({ teamId: item.team_id, quotaValue: num(item.quota_value) })),
      ...buildStats(registrations[row.id] || [], sales[row.id] || [], items[row.id] || [], own.expenses, own.incomes, own.couples),
    };
  });
};

const occupiedPeople = async (eventId, exceptRegistrationId) => {
  const rows = await db.prepare('SELECT id, guests, status FROM event_registrations WHERE event_id = ?').all(eventId);
  const base = rows.filter(row => row.id !== exceptRegistrationId && countsAsPerson(row)).reduce((sum, row) => sum + people(row), 0);
  const event = await db.prepare('SELECT bridal_meeting_id FROM events WHERE id = ?').get(eventId);
  if (!event?.bridal_meeting_id) return base;
  const couples = await db.prepare("SELECT COUNT(*) AS total FROM bridal_couples WHERE event_id = ? AND status <> 'Cancelado'").get(event.bridal_meeting_id);
  return base + (Number(couples?.total) || 0) * 2;
};

/** Mensagem de erro quando o evento não aceita novas inscrições; null se aceita. */
const registrationBlocked = async (event, newPeople, { isPublic }) => {
  if (!toBool(event.is_active)) return 'Este evento foi cancelado.';
  if (isLocked(event)) return LOCKED_MESSAGE;
  if (isPublic && !toBool(event.registration_open)) return 'As inscrições deste evento estão fechadas.';
  if (isPublic && event.registration_deadline && todayIso() > event.registration_deadline) return 'O prazo de inscrição deste evento terminou.';
  if (event.capacity) {
    const left = Number(event.capacity) - await occupiedPeople(event.id);
    if (newPeople > left) return left <= 0 ? 'As vagas deste evento acabaram.' : `Restam apenas ${left} ${left === 1 ? 'vaga' : 'vagas'}.`;
  }
  return null;
};

const newRegistrationRow = (event, data, source, createdBy) => {
  const guests = Math.max(0, parseInt(data.guests, 10) || 0);
  const hasFee = toBool(event.has_fee);
  return {
    id: uuid(), eventId: event.id, memberId: clean(data.memberId), teamId: clean(data.teamId), name: String(data.name || '').trim(),
    phone: clean(data.phone), email: clean(data.email), guests,
    status: REGISTRATION_STATUS.includes(data.status) ? data.status : 'Inscrito',
    amountDue: hasFee ? num(event.ticket_value) * (1 + guests) : 0, amountPaid: 0, paymentStatus: hasFee ? 'Pendente' : 'Isento', source, notes: clean(data.notes), createdBy: createdBy || null,
  };
};

const insertRegistration = row => db.prepare(`
  INSERT INTO event_registrations (id, event_id, member_id, team_id, name, phone, email, guests, status, amount_due, amount_paid, payment_status, source, notes, created_by)
  VALUES (@id, @eventId, @memberId, @teamId, @name, @phone, @email, @guests, @status, @amountDue, @amountPaid, @paymentStatus, @source, @notes, @createdBy)
`).run(row);

const recomputeCost = async eventId => {
  const total = (await db.prepare('SELECT amount FROM event_expenses WHERE event_id = ?').all(eventId)).reduce((sum, row) => sum + num(row.amount), 0);
  await db.prepare('UPDATE events SET cost_value = ? WHERE id = ?').run(total, eventId);
};

/* ───────────── Inscrição pública (por link) ───────────── */

router.get('/public/:token', async (req, res) => {
  try {
    const event = await db.prepare('SELECT * FROM events WHERE public_token = ?').get(req.params.token);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });
    const occupied = await occupiedPeople(event.id);
    const closedReason = (event.event_kind || 'interno') !== 'externo' ? 'Este evento é interno e não aceita inscrição pelo link.' : await registrationBlocked(event, 1, { isPublic: true });
    res.json({
      name: event.name, date: event.date, endDate: event.end_date || '', startTime: event.start_time || '', endTime: event.end_time || '',
      // O texto padrão do evento de encontro é uma nota interna (gastos e entradas): não aparece para o casal.
      location: event.location || '', description: event.bridal_meeting_id && /^Encontro de Noivos\. Os casais/.test(event.description || '') ? '' : event.description || '', imageUrl: event.image_url || '', kind: event.event_kind || 'interno',
      hasFee: toBool(event.has_fee), ticketValue: num(event.ticket_value), registrationDeadline: event.registration_deadline || '',
      spotsLeft: event.capacity ? Math.max(0, Number(event.capacity) - occupied) : null, open: !closedReason, closedReason: closedReason || '', past: event.date < todayIso(),
      bridal: !!event.bridal_meeting_id,
    });
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar evento: ' + error.message }); }
});

router.post('/public/:token/register', async (req, res) => {
  try {
    const event = await db.prepare('SELECT * FROM events WHERE public_token = ?').get(req.params.token);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });
    if ((event.event_kind || 'interno') !== 'externo') return res.status(422).json({ error: 'Este evento é interno e não aceita inscrição pelo link.' });
    if (event.bridal_meeting_id) return res.status(422).json({ error: 'Este é um Encontro de Noivos: a inscrição é feita pela ficha do casal.' });
    const data = req.body || {};
    if (String(data.name || '').trim().length < 3) return res.status(400).json({ error: 'Informe seu nome completo.' });
    const phoneDigits = String(data.phone || '').replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) return res.status(400).json({ error: 'Informe um telefone com DDD.' });
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) return res.status(400).json({ error: 'E-mail inválido.' });
    const guests = Math.min(10, Math.max(0, parseInt(data.guests, 10) || 0));
    const duplicate = (await db.prepare('SELECT phone, status FROM event_registrations WHERE event_id = ?').all(event.id))
      .some(row => row.status !== 'Cancelado' && String(row.phone || '').replace(/\D/g, '') === phoneDigits);
    if (duplicate) return res.status(409).json({ error: 'Este telefone já está inscrito neste evento.' });
    const blocked = await registrationBlocked(event, 1 + guests, { isPublic: true });
    if (blocked) return res.status(422).json({ error: blocked });
    const row = newRegistrationRow(event, { name: data.name, phone: phoneDigits, email: data.email, guests, notes: data.notes }, 'link');
    await insertRegistration(row);
    res.status(201).json({ ok: true, name: row.name, amountDue: row.amountDue, hasFee: toBool(event.has_fee) });
  } catch (error) { res.status(500).json({ error: 'Erro ao registrar inscrição: ' + error.message }); }
});

/** Ficha de inscrição do casal (Encontro de Noivos): cria o casal com os dois noivos já ligado ao encontro. */
const PARTNER_FIELDS = ['name', 'dob', 'profession', 'education', 'religion', 'parish', 'phone', 'email', 'street', 'number', 'neighborhood', 'zip', 'complement', 'city', 'state'];
const text = (value, max = 255) => String(value || '').trim().slice(0, max);

const checkPartner = (partner, who) => {
  if (!partner || text(partner.name).length < 3) return `Informe o nome completo ${who}.`;
  if (!validDate(partner.dob) || partner.dob > todayIso()) return `Informe a data de nascimento ${who}.`;
  const digits = String(partner.phone || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) return `Informe o telefone com DDD ${who}.`;
  if (partner.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(partner.email))) return `E-mail inválido ${who}.`;
  if (!text(partner.street) || !text(partner.number) || !text(partner.city) || !text(partner.state)) return `Informe o endereço completo ${who} (rua, número, cidade e estado).`;
  return null;
};

router.post('/public/:token/couple', async (req, res) => {
  try {
    const event = await db.prepare('SELECT * FROM events WHERE public_token = ?').get(req.params.token);
    if (!event || !event.bridal_meeting_id) return res.status(404).json({ error: 'Encontro não encontrado.' });
    const meeting = await db.prepare('SELECT * FROM bridal_meetings WHERE id = ?').get(event.bridal_meeting_id);
    if (!meeting) return res.status(404).json({ error: 'Encontro não encontrado.' });
    const problem = checkPartner(req.body?.noivo, 'do noivo') || checkPartner(req.body?.noiva, 'da noiva');
    if (problem) return res.status(400).json({ error: problem });
    const noivo = req.body.noivo, noiva = req.body.noiva;
    const phones = [noivo.phone, noiva.phone].map(value => String(value).replace(/\D/g, ''));
    if (phones[0] === phones[1]) return res.status(400).json({ error: 'Os telefones do noivo e da noiva precisam ser diferentes.' });
    const existing = await db.prepare('SELECT p.phone FROM bridal_partners p JOIN bridal_couples c ON c.id = p.couple_id WHERE c.event_id = ? AND c.status <> ?').all(meeting.id, 'Cancelado');
    if (existing.some(row => phones.includes(String(row.phone || '').replace(/\D/g, '')))) return res.status(409).json({ error: 'Já existe uma inscrição com este telefone neste encontro.' });
    const blocked = await registrationBlocked(event, 2, { isPublic: true });
    if (blocked) return res.status(422).json({ error: blocked });

    const id = uuid(), token = uuid(), ts = nowIso();
    await db.prepare(`
      INSERT INTO bridal_couples (id, city_id, event_id, status, public_token, filled_externally, payment_status, payment_amount, payment_date, payment_method, payment_observation, created_at, updated_at)
      VALUES (?, ?, ?, 'Aguardando Pagamento', ?, 1, 'Pendente', NULL, '', '', '', ?, ?)
    `).run(id, meeting.city_id || null, meeting.id, token, ts, ts);
    for (const [role, partner] of [['noivo', noivo], ['noiva', noiva]]) {
      const values = Object.fromEntries(PARTNER_FIELDS.map(field => [field, text(field === 'phone' ? String(partner[field]).replace(/\D/g, '') : partner[field])]));
      await db.prepare(`
        INSERT INTO bridal_partners (id, couple_id, role, name, dob, profession, education, religion, parish, phone, email, street, number, neighborhood, zip, complement, city, state)
        VALUES (@id, @coupleId, @role, @name, @dob, @profession, @education, @religion, @parish, @phone, @email, @street, @number, @neighborhood, @zip, @complement, @city, @state)
      `).run({ ...values, id: uuid(), coupleId: id, role });
    }
    res.status(201).json({ ok: true, couplePublicToken: token, pixKey: meeting.pix_key || '', meetingName: meeting.name, noivoName: text(noivo.name), noivaName: text(noiva.name) });
  } catch (error) { res.status(500).json({ error: 'Erro ao registrar a inscrição do casal: ' + error.message }); }
});

/* ───────────── Eventos ───────────── */

router.get('/', async (req, res) => {
  try { res.json(await loadEvents()); }
  catch (error) { res.status(500).json({ error: 'Erro ao buscar eventos: ' + error.message }); }
});

/** Evento ligado a um encontro de noivos (criado na hora se ainda não existir). */
router.get('/by-meeting/:meetingId', async (req, res) => {
  try {
    const id = await eventForNewMeeting(req.params.meetingId);
    if (!id) return res.status(404).json({ error: 'Encontro não encontrado.' });
    const [event] = await loadEvents(id);
    res.json(event);
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar o evento do encontro: ' + error.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [event] = await loadEvents(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });
    const [itemRows, registrationRows] = await Promise.all([
      db.prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY created_at, name').all(req.params.id),
      db.prepare('SELECT * FROM event_registrations WHERE event_id = ? ORDER BY created_at DESC').all(req.params.id),
    ]);
    res.json({ ...event, items: itemRows.map(itemFields), registrations: registrationRows.map(registrationFields) });
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar evento: ' + error.message }); }
});

/** Valida e normaliza o corpo de criação/edição, usando o evento atual para os campos que não vieram. */
const mergeEvent = (current, data) => {
  const pick = (key, fallback) => (data[key] === undefined ? fallback : data[key]);
  const flag = (key, column, fallback) => data[key] === undefined ? (current ? toBool(current[column]) : fallback) : !!data[key];
  const hasFee = flag('hasFee', 'has_fee', true);
  return {
    name: String(pick('name', current?.name) || '').trim(),
    date: pick('date', current?.date),
    endDate: clean(pick('endDate', current?.end_date)),
    startTime: clean(pick('startTime', current?.start_time)),
    endTime: clean(pick('endTime', current?.end_time)),
    location: clean(pick('location', current?.location)),
    description: clean(pick('description', current?.description)),
    responsible: clean(pick('responsible', current?.responsible)),
    notes: clean(pick('notes', current?.notes)),
    imageUrl: clean(pick('imageUrl', current?.image_url)),
    kind: pick('kind', current?.event_kind || 'interno'),
    hasFee,
    ticketValue: hasFee ? num(pick('ticketValue', current?.ticket_value)) : 0,
    ticketQuantity: pick('ticketQuantity', current?.ticket_quantity) || null,
    goalValue: num(pick('goalValue', current?.goal_value)),
    participantsGoal: parseInt(pick('participantsGoal', current?.participants_goal), 10) || null,
    capacity: parseInt(pick('capacity', current?.capacity), 10) || null,
    registrationOpen: flag('registrationOpen', 'registration_open', true),
    registrationDeadline: clean(pick('registrationDeadline', current?.registration_deadline)),
    isActive: flag('isActive', 'is_active', true),
    isClosed: flag('closed', 'is_closed', false),
    showOnDashboard: flag('showOnDashboard', 'show_on_dashboard', true),
    cityId: pick('cityId', current?.city_id) || null,
  };
};

const validateEvent = e => {
  if (e.imageUrl && !/^\/uploads\/events\/[a-f0-9-]+\.(png|jpg|webp)$/.test(e.imageUrl)) return 'Imagem inválida. Envie a imagem pelo formulário do evento.';
  if (e.name.length < 3) return 'Informe o nome do evento.';
  if (!validDate(e.date)) return 'Informe a data do evento.';
  if (e.endDate && (!validDate(e.endDate) || e.endDate < e.date)) return 'A data de término precisa ser igual ou depois da data de início.';
  if (e.startTime && e.endTime && !e.endDate && e.endTime <= e.startTime) return 'O horário de término precisa ser depois do início.';
  if (!KINDS.includes(e.kind)) return 'Tipo de evento inválido.';
  if (e.hasFee && !(e.ticketValue > 0)) return 'Informe o valor da taxa ou marque o evento como sem taxa.';
  if (e.registrationDeadline && !validDate(e.registrationDeadline)) return 'Prazo de inscrição inválido.';
  return null;
};

const saveRelations = async (id, data) => {
  if (Array.isArray(data.expenses)) {
    // O formulário do evento cuida dos gastos previstos; os extras (lançados depois) ficam como estão.
    await db.prepare('DELETE FROM event_expenses WHERE event_id = ? AND is_extra = 0').run(id);
    for (const exp of data.expenses) if (String(exp.description || '').trim()) await db.prepare('INSERT INTO event_expenses (id, event_id, description, amount, is_extra) VALUES (?, ?, ?, ?, 0)').run(uuid(), id, String(exp.description).trim(), num(exp.amount));
  }
  if (Array.isArray(data.teamQuotas)) {
    await db.prepare('DELETE FROM event_team_quotas WHERE event_id = ?').run(id);
    for (const q of data.teamQuotas) if (q.teamId && num(q.quotaValue) > 0) await db.prepare('INSERT INTO event_team_quotas (id, event_id, team_id, quota_value) VALUES (?, ?, ?, ?)').run(uuid(), id, q.teamId, num(q.quotaValue));
  }
  await recomputeCost(id);
};

router.post('/', async (req, res) => {
  try {
    const e = mergeEvent(null, req.body || {});
    const problem = validateEvent(e);
    if (problem) return res.status(400).json({ error: problem });
    const id = uuid();
    await db.prepare(`
      INSERT INTO events (id, name, date, end_date, start_time, end_time, location, description, responsible, notes, image_url, event_kind, has_fee, ticket_value, ticket_quantity,
        goal_value, participants_goal, capacity, registration_open, registration_deadline, is_active, is_closed, show_on_dashboard, city_id, cost_value, public_token)
      VALUES (@id, @name, @date, @endDate, @startTime, @endTime, @location, @description, @responsible, @notes, @imageUrl, @kind, @hasFee, @ticketValue, @ticketQuantity,
        @goalValue, @participantsGoal, @capacity, @registrationOpen, @registrationDeadline, @isActive, @isClosed, @showOnDashboard, @cityId, 0, @token)
    `).run({ ...e, id, hasFee: toInt(e.hasFee), registrationOpen: toInt(e.registrationOpen), isActive: toInt(e.isActive), isClosed: toInt(e.isClosed), showOnDashboard: toInt(e.showOnDashboard), token: uuid() });
    await saveRelations(id, req.body || {});
    const [created] = await loadEvents(id);
    res.status(201).json(created);
  } catch (error) { res.status(500).json({ error: 'Erro ao criar evento: ' + error.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const current = await db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Evento não encontrado.' });
    const e = mergeEvent(current, req.body || {});
    const problem = validateEvent(e);
    if (problem) return res.status(400).json({ error: problem });
    await db.prepare(`
      UPDATE events SET name = @name, date = @date, end_date = @endDate, start_time = @startTime, end_time = @endTime, location = @location, description = @description,
        responsible = @responsible, notes = @notes, image_url = @imageUrl, event_kind = @kind, has_fee = @hasFee, ticket_value = @ticketValue, ticket_quantity = @ticketQuantity, goal_value = @goalValue,
        participants_goal = @participantsGoal, capacity = @capacity, registration_open = @registrationOpen, registration_deadline = @registrationDeadline,
        is_active = @isActive, is_closed = @isClosed, show_on_dashboard = @showOnDashboard, city_id = @cityId
      WHERE id = @id
    `).run({ ...e, id, hasFee: toInt(e.hasFee), registrationOpen: toInt(e.registrationOpen), isActive: toInt(e.isActive), isClosed: toInt(e.isClosed), showOnDashboard: toInt(e.showOnDashboard) });
    await saveRelations(id, req.body || {});
    const [updated] = await loadEvents(id);
    res.json(updated);
  } catch (error) { res.status(500).json({ error: 'Erro ao atualizar evento: ' + error.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const event = await db.prepare('SELECT bridal_meeting_id FROM events WHERE id = ?').get(id);
    if (event?.bridal_meeting_id) return res.status(422).json({ error: 'Este evento pertence a um Encontro de Noivos. Exclua ou edite o encontro lá.' });
    const counts = await Promise.all(['event_registrations', 'event_sales', 'event_incomes', 'event_expenses'].map(table => db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE event_id = ?`).get(id)));
    if (counts.some(row => Number(row?.total) > 0)) return res.status(422).json({ error: 'Este evento já tem inscrições, vendas, gastos ou entradas. Cancele o evento em vez de excluir.' });
    await db.prepare('DELETE FROM events WHERE id = ?').run(id);
    res.status(204).end();
  } catch (error) { res.status(500).json({ error: 'Erro ao excluir evento: ' + error.message }); }
});

/* ───────────── Imagem do evento ───────────── */

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } });
const imageExtension = buffer => {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer.length >= 4 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpg';
  if (buffer.length >= 16 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
};

router.post('/image', (req, res) => {
  upload.single('image')(req, res, async error => {
    if (error) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'A imagem deve ter no máximo 5 MB.' : 'Envie apenas uma imagem em JPG, PNG ou WebP.' });
    if (!req.file) return res.status(400).json({ error: 'Selecione uma imagem.' });
    const extension = imageExtension(req.file.buffer);
    if (!extension) return res.status(400).json({ error: 'Imagem inválida. Use JPG, PNG ou WebP.' });
    try {
      const directory = path.join(__dirname, '../../uploads/events');
      await fs.mkdir(directory, { recursive: true });
      const filename = `${uuid()}.${extension}`;
      await fs.writeFile(path.join(directory, filename), req.file.buffer, { flag: 'wx' });
      res.status(201).json({ imageUrl: `/uploads/events/${filename}` });
    } catch (err) { res.status(500).json({ error: 'Não foi possível guardar a imagem.' }); }
  });
});

/* ───────────── Gastos e entradas do evento ───────────── */

const eventForMoney = async (eventId, res) => {
  const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) { res.status(404).json({ error: 'Evento não encontrado.' }); return null; }
  if (isLocked(event)) { res.status(422).json({ error: LOCKED_MESSAGE }); return null; }
  return event;
};

router.post('/:id/expenses', async (req, res) => {
  try {
    const event = await eventForMoney(req.params.id, res);
    if (!event) return;
    const data = req.body || {};
    const description = String(data.description || '').trim();
    if (description.length < 2) return res.status(400).json({ error: 'Informe a descrição do gasto.' });
    if (!(num(data.amount) > 0)) return res.status(400).json({ error: 'Informe um valor maior que zero.' });
    if (data.date && !validDate(data.date)) return res.status(400).json({ error: 'Data inválida.' });
    const id = uuid();
    await db.prepare('INSERT INTO event_expenses (id, event_id, description, amount, is_extra, expense_date) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, req.params.id, description.slice(0, 255), num(data.amount), toInt(data.isExtra), clean(data.date) || todayIso());
    await recomputeCost(req.params.id);
    res.status(201).json(expenseFields(await db.prepare('SELECT * FROM event_expenses WHERE id = ?').get(id)));
  } catch (error) { res.status(500).json({ error: 'Erro ao registrar gasto: ' + error.message }); }
});

router.delete('/expenses/:expenseId', async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM event_expenses WHERE id = ?').get(req.params.expenseId);
    if (!row) return res.status(204).end();
    if (!(await eventForMoney(row.event_id, res))) return;
    await db.prepare('DELETE FROM event_expenses WHERE id = ?').run(req.params.expenseId);
    await recomputeCost(row.event_id);
    res.status(204).end();
  } catch (error) { res.status(500).json({ error: 'Erro ao excluir gasto: ' + error.message }); }
});

router.post('/:id/incomes', async (req, res) => {
  try {
    const event = await eventForMoney(req.params.id, res);
    if (!event) return;
    const data = req.body || {};
    const description = String(data.description || '').trim();
    if (description.length < 2) return res.status(400).json({ error: 'Informe a descrição da entrada.' });
    if (!(num(data.amount) > 0)) return res.status(400).json({ error: 'Informe um valor maior que zero.' });
    if (data.date && !validDate(data.date)) return res.status(400).json({ error: 'Data inválida.' });
    const id = uuid();
    await db.prepare('INSERT INTO event_incomes (id, event_id, description, amount, income_date, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, req.params.id, description.slice(0, 255), num(data.amount), clean(data.date) || todayIso(), clean(data.createdBy));
    res.status(201).json(incomeFields(await db.prepare('SELECT * FROM event_incomes WHERE id = ?').get(id)));
  } catch (error) { res.status(500).json({ error: 'Erro ao registrar entrada: ' + error.message }); }
});

router.delete('/incomes/:incomeId', async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM event_incomes WHERE id = ?').get(req.params.incomeId);
    if (!row) return res.status(204).end();
    if (!(await eventForMoney(row.event_id, res))) return;
    await db.prepare('DELETE FROM event_incomes WHERE id = ?').run(req.params.incomeId);
    res.status(204).end();
  } catch (error) { res.status(500).json({ error: 'Erro ao excluir entrada: ' + error.message }); }
});

/* ───────────── Itens para levar ───────────── */

router.post('/:id/items', async (req, res) => {
  try {
    const event = await db.prepare('SELECT id FROM events WHERE id = ?').get(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });
    const list = Array.isArray(req.body?.items) ? req.body.items : [req.body || {}];
    const created = [];
    for (const data of list) {
      const name = String(data.name || '').trim();
      if (name.length < 2) return res.status(400).json({ error: 'Informe o nome do item.' });
      const id = uuid();
      await db.prepare('INSERT INTO event_items (id, event_id, name, quantity, unit, team_id, assigned_to, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, req.params.id, name, Math.max(1, parseInt(data.quantity, 10) || 1), clean(data.unit), clean(data.teamId), clean(data.assignedTo), ITEM_STATUS.includes(data.status) ? data.status : 'Pendente');
      created.push(itemFields(await db.prepare('SELECT * FROM event_items WHERE id = ?').get(id)));
    }
    res.status(201).json(created);
  } catch (error) { res.status(500).json({ error: 'Erro ao salvar item: ' + error.message }); }
});

router.put('/items/:itemId', async (req, res) => {
  try {
    const current = await db.prepare('SELECT * FROM event_items WHERE id = ?').get(req.params.itemId);
    if (!current) return res.status(404).json({ error: 'Item não encontrado.' });
    const data = req.body || {};
    const pick = (key, fallback) => (data[key] === undefined ? fallback : data[key]);
    const name = String(pick('name', current.name) || '').trim();
    if (name.length < 2) return res.status(400).json({ error: 'Informe o nome do item.' });
    const status = pick('status', current.status);
    if (!ITEM_STATUS.includes(status)) return res.status(400).json({ error: 'Situação do item inválida.' });
    await db.prepare('UPDATE event_items SET name = ?, quantity = ?, unit = ?, team_id = ?, assigned_to = ?, status = ? WHERE id = ?')
      .run(name, Math.max(1, parseInt(pick('quantity', current.quantity), 10) || 1), clean(pick('unit', current.unit)), clean(pick('teamId', current.team_id)), clean(pick('assignedTo', current.assigned_to)), status, req.params.itemId);
    res.json(itemFields(await db.prepare('SELECT * FROM event_items WHERE id = ?').get(req.params.itemId)));
  } catch (error) { res.status(500).json({ error: 'Erro ao atualizar item: ' + error.message }); }
});

router.delete('/items/:itemId', async (req, res) => {
  try { await db.prepare('DELETE FROM event_items WHERE id = ?').run(req.params.itemId); res.status(204).end(); }
  catch (error) { res.status(500).json({ error: 'Erro ao excluir item: ' + error.message }); }
});

/* ───────────── Inscrições ───────────── */

router.post('/:id/registrations', async (req, res) => {
  try {
    const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });
    const body = req.body || {};
    const list = Array.isArray(body.registrations) ? body.registrations : [body];
    if (!list.length) return res.status(400).json({ error: 'Informe quem vai se inscrever.' });
    const rows = list.map(data => newRegistrationRow(event, data, ['equipe', 'usuario', 'manual', 'convite'].includes(data.source) ? data.source : 'manual', data.createdBy));
    if (rows.some(row => row.name.length < 2)) return res.status(400).json({ error: 'Informe o nome de cada pessoa.' });
    const existing = await db.prepare('SELECT member_id, created_by, source, status FROM event_registrations WHERE event_id = ?').all(req.params.id);
    const dupMember = rows.find(row => row.memberId && existing.some(item => item.member_id === row.memberId && item.status !== 'Cancelado'));
    if (dupMember) return res.status(409).json({ error: `${dupMember.name} já está inscrito neste evento.` });
    const dupUser = rows.find(row => row.source === 'usuario' && row.createdBy && existing.some(item => item.source === 'usuario' && item.created_by === row.createdBy && item.status !== 'Cancelado'));
    if (dupUser) return res.status(409).json({ error: 'Você já está inscrito neste evento.' });
    const blocked = await registrationBlocked(event, rows.reduce((sum, row) => sum + people(row), 0), { isPublic: false });
    if (blocked) return res.status(422).json({ error: blocked });
    for (const row of rows) await insertRegistration(row);
    const saved = await db.prepare('SELECT * FROM event_registrations WHERE event_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.status(201).json(saved.filter(item => rows.some(row => row.id === item.id)).map(registrationFields));
  } catch (error) { res.status(500).json({ error: 'Erro ao registrar inscrição: ' + error.message }); }
});

router.put('/registrations/:rid', async (req, res) => {
  try {
    const current = await db.prepare('SELECT * FROM event_registrations WHERE id = ?').get(req.params.rid);
    if (!current) return res.status(404).json({ error: 'Inscrição não encontrada.' });
    const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(current.event_id);
    if (isLocked(event)) return res.status(422).json({ error: LOCKED_MESSAGE });
    const data = req.body || {};
    const pick = (key, fallback) => (data[key] === undefined ? fallback : data[key]);
    const status = pick('status', current.status);
    if (!REGISTRATION_STATUS.includes(status)) return res.status(400).json({ error: 'Situação da inscrição inválida.' });
    const guests = Math.max(0, parseInt(pick('guests', current.guests), 10) || 0);
    const amountPaid = num(pick('amountPaid', current.amount_paid));
    const amountDue = data.guests !== undefined && toBool(event.has_fee) ? num(event.ticket_value) * (1 + guests) : num(pick('amountDue', current.amount_due));
    if (amountPaid < 0 || amountPaid > amountDue + 0.001) return res.status(400).json({ error: 'O valor pago não pode ser maior que o valor devido.' });
    const reactivating = status !== 'Cancelado' && current.status === 'Cancelado';
    if (reactivating || guests > Number(current.guests)) {
      const blocked = await registrationBlocked(event, reactivating ? 1 + guests : guests - Number(current.guests), { isPublic: false });
      if (blocked) return res.status(422).json({ error: blocked });
    }
    const exempt = !toBool(event.has_fee) || pick('paymentStatus', current.payment_status) === 'Isento';
    const paymentStatus = exempt ? 'Isento' : amountPaid <= 0 ? 'Pendente' : amountPaid + 0.001 >= amountDue ? 'Pago' : 'Parcial';
    await db.prepare('UPDATE event_registrations SET name = ?, phone = ?, email = ?, guests = ?, status = ?, amount_due = ?, amount_paid = ?, payment_status = ?, notes = ?, team_id = ? WHERE id = ?')
      .run(String(pick('name', current.name) || '').trim() || current.name, clean(pick('phone', current.phone)), clean(pick('email', current.email)), guests, status, amountDue, exempt ? 0 : amountPaid, paymentStatus, clean(pick('notes', current.notes)), clean(pick('teamId', current.team_id)), req.params.rid);
    res.json(registrationFields(await db.prepare('SELECT * FROM event_registrations WHERE id = ?').get(req.params.rid)));
  } catch (error) { res.status(500).json({ error: 'Erro ao atualizar inscrição: ' + error.message }); }
});

router.delete('/registrations/:rid', async (req, res) => {
  try { await db.prepare('DELETE FROM event_registrations WHERE id = ?').run(req.params.rid); res.status(204).end(); }
  catch (error) { res.status(500).json({ error: 'Erro ao excluir inscrição: ' + error.message }); }
});

module.exports = router;
