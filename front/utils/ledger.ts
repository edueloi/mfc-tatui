import type { FinancialEntity } from '../types';
import { entitySlug, findBySlug } from './entitySlug';

export interface LedgerEntry {
  readOnly?: boolean;
  paymentId?: string;
  memberId?: string;
  referenceMonth?: string;
  id: string;
  teamId: string | null;
  entityId: string | null;
  type: 'IN' | 'OUT';
  description: string;
  amount: number;
  date: string;
  category: string | null;
  createdBy: string | null;
  status?: 'SETTLED' | 'PENDING' | 'CANCELLED';
  dueDate?: string;
  valueKind?: 'FIXED' | 'VARIABLE';
  expectedAmount?: number;
  counterparty?: string;
  paymentMethod?: string;
  notes?: string;
  costCenter?: string;
  costCenterId?: string | null;
  sourceKey?: string | null;
  analytic?: string;
  financialAccount?: string;
}

export const LEDGER_BASE = '/livro-caixa';
export interface CostCenter { id: string; name: string; description: string; eventId?: string | null; entryCount: number; }
export const LEDGER_COST_CENTERS = ['MFC', 'Sede', 'Livraria', 'Encontro de Noivos', 'Bazar', 'Baile 60+1', 'Evento Somos', 'Aplicação Financeira'];
export const LEDGER_FINANCIAL_ACCOUNTS = ['BB c/c', 'Poupança', 'Caixa MFC', 'Caixa ingresso', 'Ton'];

/** Contas sugeridas; o campo aceita também uma conta digitada. */
export const LEDGER_ACCOUNTS: Record<LedgerEntry['type'], string[]> = {
  IN: ['Receitas de Vendas - Dinheiro', 'Receitas de Vendas - PIX', 'Receitas de Vendas - Cartão', 'Mensalidades', 'Doações', 'Outros'],
  OUT: ['Ajuda de Custos a Colaboradores', 'Material Acervo Literário', 'Telefone / Internet', 'INSS / DARF', 'Salário / M.O', 'Tarifa Maquininha', 'Outros'],
};

export const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const shortMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type BookLike = Pick<FinancialEntity, 'id' | 'name' | 'year'>;
const bookBases = (book: BookLike) => [book.name, `${book.name} ${book.year}`];
export const bookSlug = (book: BookLike, books: BookLike[]) => entitySlug(book, books, bookBases);
export const findBook = <T extends BookLike>(books: T[], param?: string) => findBySlug<T>(books, param, bookBases);
export const bookPath = (book: BookLike, books: BookLike[]) => `${LEDGER_BASE}/${bookSlug(book, books)}`;

const monthOf = (date: string) => Number(date.slice(5, 7)) - 1;

export const isSettled = (entry: Pick<LedgerEntry, 'status'>) => !entry.status || entry.status === 'SETTLED';
export const isOverdue = (entry: LedgerEntry, today: string) => entry.status === 'PENDING' && (entry.dueDate || entry.date) < today;
export const entryStatusLabel = (entry: LedgerEntry, today: string) => entry.status === 'CANCELLED' ? 'Cancelado' : isSettled(entry) ? (entry.type === 'IN' ? 'Recebido' : 'Pago') : isOverdue(entry, today) ? 'Em atraso' : (entry.type === 'IN' ? 'A receber' : 'A pagar');

export function summarize(entries: Pick<LedgerEntry, 'type' | 'amount' | 'status'>[], initialBalance = 0) {
  const income = entries.filter(entry => isSettled(entry) && entry.type === 'IN').reduce((sum, entry) => sum + entry.amount, 0);
  const expenses = entries.filter(entry => isSettled(entry) && entry.type === 'OUT').reduce((sum, entry) => sum + entry.amount, 0);
  return { income, expenses, balance: Number(initialBalance || 0) + income - expenses };
}

export function monthlyTotals(entries: Pick<LedgerEntry, 'type' | 'amount' | 'date' | 'status'>[]) {
  const income = Array<number>(12).fill(0);
  const expenses = Array<number>(12).fill(0);
  entries.forEach(entry => {
    if (!isSettled(entry)) return;
    const month = monthOf(entry.date);
    if (month < 0 || month > 11) return;
    (entry.type === 'IN' ? income : expenses)[month] += entry.amount;
  });
  return { income, expenses };
}

export interface SheetRow { category: string; months: number[]; total: number; }

/** Balancete: uma linha por conta e uma coluna por mês, só com o que foi lançado de verdade. */
export function balanceSheet(entries: LedgerEntry[]) {
  const build = (type: LedgerEntry['type']): SheetRow[] => {
    const rows = new Map<string, SheetRow>();
    entries.filter(entry => isSettled(entry) && entry.type === type).forEach(entry => {
      const category = entry.category || 'Sem conta';
      const row = rows.get(category) || { category, months: Array<number>(12).fill(0), total: 0 };
      const month = monthOf(entry.date);
      if (month >= 0 && month <= 11) { row.months[month] += entry.amount; row.total += entry.amount; }
      rows.set(category, row);
    });
    return [...rows.values()].sort((a, b) => a.category.localeCompare(b.category, 'pt-BR'));
  };
  return { income: build('IN'), expenses: build('OUT') };
}

export const lastDayOfMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

export function pendingTotals(entries: LedgerEntry[], today: string) {
  const pending = entries.filter(entry => entry.status === 'PENDING');
  const receivable = pending.filter(entry => entry.type === 'IN').reduce((sum, entry) => sum + entry.amount, 0);
  const payable = pending.filter(entry => entry.type === 'OUT').reduce((sum, entry) => sum + entry.amount, 0);
  const overdue = pending.filter(entry => isOverdue(entry, today));
  return { receivable, payable, overdueCount: overdue.length, overdueAmount: overdue.reduce((sum, entry) => sum + entry.amount, 0) };
}

/** Escape de células para Excel, incluindo textos que poderiam virar fórmulas. */
export const csvCell = (value: string | number) => `"${(typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? "'" + value : String(value)).replace(/"/g, '""')}"`;
