import { Payment } from '../types';
import { isPaidPayment } from './paymentAccounting';

/** Junta as parcelas do casal sem confundir competência com data de entrada. */
export function familyPaymentHistory(payments: Payment[], teamId: string, memberIds: string[]) {
  const groups = new Map<string, { id: string; referenceMonth: string; date: string; amount: number }>();
  for (const payment of payments) {
    if (payment.teamId !== teamId || !isPaidPayment(payment) || !memberIds.includes(payment.memberId)) continue;
    const [month, year] = payment.referenceMonth.split('/').map(Number);
    const referenceMonth = `${month}/${year}`;
    const date = payment.date.slice(0, 10);
    const id = `${referenceMonth}:${date}`;
    const group = groups.get(id) || { id, referenceMonth, date, amount: 0 };
    group.amount = (Math.round(group.amount * 100) + Math.round(payment.amount * 100)) / 100;
    groups.set(id, group);
  }
  const referenceOrder = (reference: string) => { const [month, year] = reference.split('/').map(Number); return year * 12 + month; };
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date) || referenceOrder(b.referenceMonth) - referenceOrder(a.referenceMonth));
}
