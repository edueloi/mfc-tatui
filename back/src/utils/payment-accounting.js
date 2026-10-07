const isPaid = payment => String(payment.status || '').toLowerCase() === 'pago';

const matchesReference = (payment, month, year) => {
  const [m, y] = String(payment.reference_month || '').split('/').map(Number);
  return m === Number(month) && y === Number(year);
};

const receivedInPeriod = (payment, month, year) => {
  const [y, m] = String(payment.date || '').slice(0, 10).split('-').map(Number);
  return isPaid(payment) && m === Number(month) && y === Number(year);
};

const validReceiptDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

module.exports = { isPaid, matchesReference, receivedInPeriod, validReceiptDate };
