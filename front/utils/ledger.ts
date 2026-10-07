import type { FinancialEntity } from '../types';
import { entitySlug, findBySlug } from './entitySlug';

export interface LedgerEntry {
  id: string;
  teamId: string | null;
  entityId: string | null;
  type: 'IN' | 'OUT';
  description: string;
  amount: number;
  date: string;
  category: string | null;
  createdBy: string | null;
}

export const LEDGER_BASE = '/livro-caixa';

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

export function summarize(entries: Pick<LedgerEntry, 'type' | 'amount'>[], initialBalance = 0) {
  const income = entries.filter(entry => entry.type === 'IN').reduce((sum, entry) => sum + entry.amount, 0);
  const expenses = entries.filter(entry => entry.type === 'OUT').reduce((sum, entry) => sum + entry.amount, 0);
  return { income, expenses, balance: Number(initialBalance || 0) + income - expenses };
}

export function monthlyTotals(entries: Pick<LedgerEntry, 'type' | 'amount' | 'date'>[]) {
  const income = Array<number>(12).fill(0);
  const expenses = Array<number>(12).fill(0);
  entries.forEach(entry => {
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
    entries.filter(entry => entry.type === type).forEach(entry => {
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
