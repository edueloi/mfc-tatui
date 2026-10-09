const { canBeChargedMonthly } = require('./payment-rules');
const { isPaid } = require('./payment-accounting');
const money = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brDate = date => String(date).slice(0, 10).split('-').reverse().join('/');
const relation = member => String(member.relationship_type || 'Titular').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function teamMemberReport({ teamId, year, members, payments, entries, monthlyAmount }) {
  const paid = payments.filter(payment => payment.team_id === teamId && isPaid(payment));
  const cash = entries.filter(entry => entry.teamId === teamId && entry.paymentId && entry.type === 'IN');
  const teamMembers = members.filter(member => member.team_id === teamId && member.status === 'Ativo' && canBeChargedMonthly(member));
  const relevant = paid.filter(payment => Number(String(payment.reference_month).split('/')[1]) === Number(year));
  const ids = new Set([...teamMembers.map(member => member.id), ...cash.map(entry => entry.memberId), ...relevant.map(payment => payment.member_id)]);
  const people = [...ids].filter(Boolean).map(id => {
    const member = members.find(item => item.id === id);
    const receipts = paid.filter(payment => payment.member_id === id);
    const own = cash.filter(entry => entry.memberId === id);
    const name = member?.name || receipts[0]?.member_name || own[0]?.counterparty || 'MFCista';
    const charged = member?.team_id === teamId && member.status === 'Ativo' && canBeChargedMonthly(member);
    const couple = charged && member.family_name && teamMembers.some(other => other.id !== id && other.family_name === member.family_name && canBeChargedMonthly(other) && relation(other) !== relation(member));
    const expected = charged ? Number(monthlyAmount) / (couple ? 2 : 1) : 0;
    const months = Array.from({ length: 12 }, (_, i) => {
      const list = receipts.filter(payment => { const [m, y] = payment.reference_month.split('/').map(Number); return m === i + 1 && y === Number(year); });
      const amount = list.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const late = list.some(payment => payment.date.slice(0, 7) > `${year}-${String(i + 1).padStart(2, '0')}`);
      return { amount, expected, paid: list.length > 0, dates: list.map(payment => payment.date), label: list.length ? `${money(amount)} · ${late ? 'Pago em atraso' : 'Pago'}\n${[...new Set(list.map(payment => brDate(payment.date)))].join(', ')}` : charged ? `${money(expected)} · Em aberto` : 'Sem cobrança' };
    });
    return { id, name, family: member?.team_id === teamId ? member.family_name : '', relation: member ? relation(member) : '', months, referenceTotal: months.reduce((sum, month) => sum + month.amount, 0), cash: Array.from({ length: 12 }, (_, i) => own.filter(entry => Number(entry.date.slice(5, 7)) === i + 1).reduce((sum, entry) => sum + entry.amount, 0)) };
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const groups = new Map();
  people.forEach(person => { const key = person.family ? `family:${person.family}` : person.id; groups.set(key, [...(groups.get(key) || []), person]); });
  return [...groups].map(([id, people]) => {
    people.sort((a, b) => (a.relation === 'titular' ? -1 : 0) - (b.relation === 'titular' ? -1 : 0));
    const months = Array.from({ length: 12 }, (_, i) => {
      const cells = people.map(person => person.months[i]);
      const amount = cells.reduce((sum, cell) => sum + cell.amount, 0);
      const dates = [...new Set(cells.flatMap(cell => cell.dates))].sort();
      return { amount, label: money(dates.length ? amount : cells.reduce((sum, cell) => sum + cell.expected, 0)), receiptMonth: dates.length ? Number(dates[dates.length - 1].slice(5, 7)) - 1 : -1, note: people.map(person => `${person.name}: ${person.months[i].label}`).join('\n'), partial: dates.length > 0 && cells.some(cell => !cell.paid) };
    });
    return { id, memberIds: people.map(person => person.id), name: people.map(person => person.name.trim().split(/\s+/)[0]).join(' e '), months, referenceTotal: people.reduce((sum, person) => sum + person.referenceTotal, 0), cash: Array.from({ length: 12 }, (_, i) => people.reduce((sum, person) => sum + person.cash[i], 0)) };
  });
}
module.exports = { teamMemberReport };
