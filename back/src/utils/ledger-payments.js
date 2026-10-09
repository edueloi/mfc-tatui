const { isPaid, validReceiptDate } = require('./payment-accounting');

// Uma projeção do recebimento original: não cria cópias nem altera as referências.
function paymentLedgerEntries(payments, mappings, existing = []) {
  const destinations = new Map(mappings.map(row => [Number(row.year), row.entity_id]));
  const seen = new Set(existing.map(row => row.sourceKey).filter(Boolean));
  return payments.flatMap(payment => {
    const date = String(payment.date || '').slice(0, 10);
    const entityId = destinations.get(Number(date.slice(0, 4)));
    const sourceKey = `payment:${payment.id}`;
    if (!entityId || !isPaid(payment) || !validReceiptDate(date) || !(Number(payment.amount) > 0) || seen.has(sourceKey)) return [];
    seen.add(sourceKey);
    return [{
      id: sourceKey, sourceKey, entityId, teamId: payment.team_id, type: 'IN', status: 'SETTLED',
      description: `Mensalidade ${payment.reference_month} · ${payment.member_name || 'MFCista'} · ${payment.team_name || 'Equipe'}`,
      amount: Number(payment.amount), expectedAmount: Number(payment.amount), date, dueDate: date,
      category: 'Mensalidades', costCenter: 'MFC', costCenterId: null,
      analytic: payment.team_name || 'Equipes base', counterparty: payment.member_name || '',
      financialAccount: '', valueKind: 'FIXED', createdBy: payment.launched_by || null,
      paymentMethod: payment.payment_method || '', notes: `Origem: Tesouraria das Equipes. Referência quitada: ${payment.reference_month}. ${payment.observation || ''}`.trim(),
      readOnly: true, paymentId: payment.id, memberId: payment.member_id, referenceMonth: payment.reference_month,
    }];
  });
}

function createPaymentIntegration(db) {
  let ready;
  const ensure = () => ready || (ready = db.prepare(`CREATE TABLE IF NOT EXISTS ledger_payment_books (
    year INT PRIMARY KEY, entity_id VARCHAR(36) NOT NULL UNIQUE,
    FOREIGN KEY (entity_id) REFERENCES financial_entities(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).run().catch(error => { ready = undefined; throw error; }));
  const ensureBooks = async () => {
    await ensure();
    const years = await db.prepare("SELECT DISTINCT LEFT(date, 4) AS year FROM payments WHERE LOWER(status) = 'pago' AND amount > 0").all();
    const currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(new Date()));
    const validYears = [...new Set([currentYear, ...years.map(row => Number(row.year))])].filter(year => Number.isInteger(year) && year >= 1900 && year <= 9999).sort((a, b) => a - b);
    await db.transaction(async connection => {
      for (const year of validYears) {
        const id = `mfc-team-payments-${year}`;
        await connection.execute(`INSERT IGNORE INTO financial_entities (id, name, year, observations, initial_balance)
          VALUES (?, ?, ?, ?, 0)`, [id, `Mensalidades das Equipes — ${year}`, year, 'Livro integrado à Tesouraria. Entradas pela data do recebimento; referências preservadas.']);
        await connection.execute('INSERT IGNORE INTO ledger_payment_books (year, entity_id) VALUES (?, ?)', [year, id]);
      }
    });
  };
  const mappings = async () => { await ensureBooks(); return db.prepare('SELECT year, entity_id FROM ledger_payment_books ORDER BY year DESC').all(); };
  const entries = async existing => {
    const links = await mappings();
    if (!links.length) return [];
    const payments = await db.prepare(`SELECT p.*, m.name AS member_name, t.name AS team_name
      FROM payments p LEFT JOIN members m ON m.id = p.member_id LEFT JOIN teams t ON t.id = p.team_id
      WHERE LOWER(p.status) = 'pago' ORDER BY p.date DESC`).all();
    return paymentLedgerEntries(payments, links, existing);
  };
  return { ensure, ensureBooks, mappings, entries };
}
module.exports = { paymentLedgerEntries, createPaymentIntegration };
