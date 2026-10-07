import type { Payment } from '../types';

export const isPaidPayment = (payment: Payment) => payment.status?.toLowerCase() === 'pago';

export const matchesReference = (payment: Payment, month: number, year: number) => {
  const [referenceMonth, referenceYear] = payment.referenceMonth.split('/').map(Number);
  return referenceMonth === month && referenceYear === year;
};

export const receivedInPeriod = (payment: Payment, year: number, month?: number) => {
  const [receivedYear, receivedMonth] = payment.date.slice(0, 10).split('-').map(Number);
  return isPaidPayment(payment) && receivedYear === year && (month === undefined || receivedMonth === month);
};

export const paidLate = (payment: Payment) => {
  const [month, year] = payment.referenceMonth.split('/').map(Number);
  const referencePeriod = `${year}-${String(month).padStart(2, '0')}`;
  return isPaidPayment(payment) && payment.date.slice(0, 7) > referencePeriod;
};

export const formatPaymentDate = (date: string) => {
  const [year, month, day] = date.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '—';
};

export const localDateToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const monthlySettlement = (memberIds: string[], payments: Payment[], month: number, year: number) => {
  const receipts = payments.filter(p => memberIds.includes(p.memberId) && isPaidPayment(p) && matchesReference(p, month, year));
  const paidIds = new Set(receipts.map(p => p.memberId));
  const status = memberIds.length === 0 ? 'none'
    : !memberIds.every(id => paidIds.has(id)) ? (paidIds.size > 0 ? 'partial' : 'pending')
    : receipts.some(paidLate) ? 'late' : 'paid';
  const label = { none: 'Sem cobrança', pending: 'Pendente', partial: 'Parcial', late: 'Pago em atraso', paid: 'Pago' }[status];
  const dates = [...new Set(receipts.map(p => formatPaymentDate(p.date)))].join(', ');
  return { status, label, description: dates ? `${label} · Recebido em ${dates}` : label };
};
