import { BaseTeam, Member, Payment } from '../types';
import { LedgerEntry, shortMonths } from './ledger';
import { buildBillingUnits } from './billingUnits';
import { familyPaymentHistory } from './familyPaymentHistory';
import { isPaidPayment, matchesReference } from './paymentAccounting';
import { dateLabel } from './dates';

export interface TeamReportData { teams: BaseTeam[]; members: Member[]; payments: Payment[]; monthlyAmount: number; }
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const money = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
const tones = ['#dbeafe', '#ede9fe', '#cffafe', '#d1fae5', '#ecfccb', '#fef3c7', '#ffedd5', '#fee2e2', '#fae8ff', '#fce7f3', '#e0e7ff', '#ccfbf1'];

export function teamLedgerReportHtml(year: number, entries: LedgerEntry[], data: TeamReportData) {
  const receipts = entries.filter(entry => entry.paymentId && entry.type === 'IN' && entry.status !== 'PENDING' && entry.status !== 'CANCELLED');
  const teams = [...data.teams];
  for (const entry of receipts) if (!teams.some(team => team.id === entry.teamId)) teams.push({ id: entry.teamId, name: entry.analytic || 'Equipe anterior' } as BaseTeam);
  teams.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const headings = `<tr><th style="width:19%">Família / casal</th>${shortMonths.map(month => `<th class="amount">${month}</th>`).join('')}<th class="amount" style="width:9%">Total</th></tr>`;
  const teamsRows = teams.map(team => {
    const own = receipts.filter(entry => entry.teamId === team.id);
    const cash = shortMonths.map((_, i) => sum(own.filter(entry => Number(entry.date.slice(5, 7)) === i + 1).map(entry => entry.amount)));
    return `<tr><td>${escape(team.name)}</td>${cash.map(value => `<td class="amount">${money(value)}</td>`).join('')}<td class="amount"><strong>${money(sum(cash))}</strong></td></tr>`;
  }).join('');
  const overview = `<section class="section"><h2>Balancete das equipes · ${year}</h2><p>Entradas pela data do recebimento, em reais. Mensalidades antigas recebidas em outubro compõem outubro.</p><table class="family-report"><thead>${headings.replace('Família / casal', 'Equipe base')}</thead><tbody>${teamsRows}</tbody></table></section>`;
  const pages = teams.map(team => {
    const own = receipts.filter(entry => entry.teamId === team.id);
    const referencePayments = data.payments.filter(payment => payment.teamId === team.id && isPaidPayment(payment));
    // Preserva recebimentos históricos de pessoas que hoje estão inativas ou em outra equipe.
    const ids = new Set([...own.map(entry => entry.memberId), ...referencePayments.filter(payment => Number(payment.referenceMonth.split('/')[1]) === year).map(payment => payment.memberId)]);
    const people = data.members.filter(member => member.teamId === team.id || ids.has(member.id)).map(member => ids.has(member.id) ? { ...member, familyName: member.teamId === team.id ? member.familyName : undefined, status: 'Ativo', paysMonthly: true, isPaymentInactive: false } as Member : member);
    for (const id of ids) if (id && !people.some(member => member.id === id)) people.push({ id, name: own.find(entry => entry.memberId === id)?.counterparty || referencePayments.find(payment => payment.memberId === id)?.memberName || 'MFCista', status: 'Ativo', relationshipType: 'Titular' } as Member);
    const families = buildBillingUnits(people, data.monthlyAmount).filter(unit => unit.payingMembers.length);
    const models = families.map(unit => {
      const memberIds = unit.payingMembers.map(member => member.id);
      const name = unit.payingMembers.map(member => member.name.trim().split(/\s+/)[0]).join(' e ');
      const payments = referencePayments.filter(payment => memberIds.includes(payment.memberId));
      const months = shortMonths.map((_, i) => {
        const values = payments.filter(payment => matchesReference(payment, i + 1, year));
        const periods = [...new Set(values.map(payment => payment.date.slice(0, 7)))].sort();
        const partial = values.length && !memberIds.every(id => values.some(payment => payment.memberId === id));
        const html = periods.map(period => `<span class="receipt-color" style="background:${tones[Number(period.slice(5, 7)) - 1]}">${money(sum(values.filter(payment => payment.date.startsWith(period)).map(payment => payment.amount)))}${partial ? ' ◐' : ''}</span>`).join('');
        return { amount: sum(values.map(payment => payment.amount)), html: html || '<span class="unpaid">—</span>' };
      });
      const cash = shortMonths.map((_, i) => sum(own.filter(entry => memberIds.includes(entry.memberId || '') && Number(entry.date.slice(5, 7)) === i + 1).map(entry => entry.amount)));
      const paymentIds = new Set(own.map(entry => entry.paymentId));
      const history = familyPaymentHistory(payments.filter(payment => paymentIds.has(payment.id)), team.id, memberIds);
      return { name, months, cash, history };
    });
    const totals = (cash: boolean) => shortMonths.map((_, i) => sum(models.map(model => cash ? model.cash[i] : model.months[i].amount)));
    const footer = (cash: boolean) => `<tfoot><tr><td>Total</td>${totals(cash).map(value => `<td class="amount">${money(value)}</td>`).join('')}<td class="amount">${money(sum(totals(cash)))}</td></tr></tfoot>`;
    const detail = models.flatMap(model => model.history.map(payment => ({ ...payment, name: model.name }))).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'pt-BR'));
    return `<section class="section page-break"><header><div><div class="eyebrow">MFC · Mensalidades das equipes base</div><h1>${escape(team.name)}</h1><div>Uma linha por família / casal · Valores em R$</div></div><div class="meta"><strong>${year}</strong>${models.length} famílias<br>Recebido: R$ ${money(sum(own.map(entry => entry.amount)))}</div></header>
      <h2>Mensalidades quitadas</h2><p>Colunas indicam a referência quitada. A cor indica o mês do recebimento; outubro é rosa. ◐ = quitação parcial; — = sem pagamento neste recorte.</p>
      <div class="receipt-legend">${shortMonths.map((month, i) => `<span style="background:${tones[i]}">${month}</span>`).join('')}</div>
      <table class="family-report"><thead>${headings}</thead><tbody>${models.map(model => `<tr><td><strong>${escape(model.name)}</strong></td>${model.months.map(month => `<td class="amount">${month.html}</td>`).join('')}<td class="amount">${money(sum(model.months.map(month => month.amount)))}</td></tr>`).join('') || '<tr><td colspan="14">Sem famílias pagantes neste período.</td></tr>'}</tbody>${footer(false)}</table>
      <div class="section"><h2>Entradas no caixa por casal</h2><p>Pela data real do recebimento. O total pode diferir das mensalidades quitadas do ano.</p><table class="family-report"><thead>${headings}</thead><tbody>${models.map(model => `<tr><td>${escape(model.name)}</td>${model.cash.map(value => `<td class="amount">${money(value)}</td>`).join('')}<td class="amount">${money(sum(model.cash))}</td></tr>`).join('')}</tbody>${footer(true)}</table></div>
      <div class="section"><h2>Histórico de recebimentos · ${escape(team.name)}</h2><table><thead><tr><th>Família / casal</th><th>Mensalidade quitada</th><th>Recebido em</th><th class="amount">Valor (R$)</th></tr></thead><tbody>${detail.map(payment => `<tr><td>${escape(payment.name)}</td><td>${escape(payment.referenceMonth)}</td><td>${escape(dateLabel(payment.date))}</td><td class="amount">${money(payment.amount)}</td></tr>`).join('') || '<tr><td colspan="4">Nenhum recebimento neste recorte.</td></tr>'}</tbody></table></div></section>`;
  }).join('');
  return { overview, pages };
}
