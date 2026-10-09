import { FinancialEntity } from '../types';
import { LedgerEntry, csvCell, entryStatusLabel, isSettled } from './ledger';
import { dateLabel } from './dates';
import { localDateToday } from './paymentAccounting';
import { ledgerReportHtml } from './ledgerReportHtml';
import { api } from '../api';
import type { TeamReportData } from './teamLedgerReportHtml';

const money = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
const headings = ['Data', 'Vencimento', 'Descrição', 'Conta', 'Pessoa / fornecedor', 'Tipo', 'Situação', 'Classificação', 'Previsto', 'Valor', 'Variação realizada', 'Pagamento', 'Observações'];
const row = (e: LedgerEntry) => [dateLabel(e.date), dateLabel(e.dueDate || e.date), e.description, e.category || '', e.counterparty || '', e.type === 'IN' ? 'Entrada' : 'Saída', entryStatusLabel(e, localDateToday()), e.valueKind === 'FIXED' ? 'Fixo' : 'Variável', money(e.expectedAmount ?? e.amount), money(e.amount), isSettled(e) ? money(e.amount - (e.expectedAmount ?? e.amount)) : '', e.paymentMethod || '', e.notes || ''];
export function downloadLedger(book: FinancialEntity, entries: LedgerEntry[]) {
  const csv = [[book.name, String(book.year)], headings, ...entries.map(row)].map(values => values.map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a'); link.href = url; link.download = `livro-caixa-${book.year}-lancamentos.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function printLedger(book: FinancialEntity, entries: LedgerEntry[], _summary: string, scope: 'all' | 'filtered' = 'filtered', report: 'ledger' | 'teams' = 'ledger') {
  const win = window.open('', '_blank');
  if (!win) throw new Error('Permita a abertura da janela de impressão.');
  win.opener = null;
  win.document.write('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Preparando relatório</title><body><p role="status">Preparando relatório das equipes…</p></body></html>');
  let teamData: TeamReportData | undefined;
  try {
    if (report === 'teams') {
      entries = entries.filter(entry => entry.paymentId);
      book = { ...book, name: 'Equipes Base', initialBalance: 0 };
      const [teams, members, payments, config] = await Promise.all([api.getTeams(), api.getMembers(), api.getPayments(), api.getFinancialConfig()]);
      const ids = new Set(entries.map(entry => entry.paymentId));
      teamData = { teams, members, payments: scope === 'all' ? payments : payments.filter(payment => ids.has(payment.id)), monthlyAmount: Number(config?.monthlyPaymentAmount) || 0 };
    }
    if (win.closed) return;
    win.document.open();
    win.document.write(ledgerReportHtml(book, entries, scope, teamData));
    const slug = book.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').replace(new RegExp(`-${book.year}$`), '') || 'livro';
    win.document.title = `livro-caixa-${report === 'teams' ? 'equipes-base' : slug}-${book.year}`;
  } catch (error) { win.close(); throw error; }
  win.document.close();
  win.document.getElementById('print')!.onclick = () => win.print();
}
