import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BookOpen, Plus, ArrowLeft, ArrowRight, Download, DollarSign, TrendingUp, TrendingDown, Wallet, Pencil, Trash2, Loader2, ListChecks, Table2, BarChart3, Settings2, Printer, Share2, Copy, Clock,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { api } from '../api';
import { FinancialEntity } from '../types';
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard, PanelCard, Tabs, Button, IconButton, Badge, Select, EmptyState, ConfirmModal, GridTable, usePagination,
  FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch, FilterLineSegmented, Modal, ModalFooter,
} from '../components/ui';
import { LedgerBookModal } from '../components/LedgerBookModal';
import { LedgerEntryModal } from '../components/LedgerEntryModal';
import { LedgerPreferencesModal } from '../components/LedgerPreferencesModal';
import { LedgerCostCentersModal } from '../components/LedgerCostCentersModal';
import { LedgerTeams } from '../components/LedgerTeams';
import { useLedgerPreferences, LedgerPreferences } from '../src/hooks/useLedgerPreferences';
import { printLedger } from '../utils/ledgerExport';
import { localDateToday } from '../utils/paymentAccounting';
import { usePermission } from '../src/hooks/usePermission';
import { useUrlTab } from '../src/hooks/useUrlTab';
import { dateLabel } from '../utils/dates';
import { normalizeDirectoryText } from '../utils/memberDirectory';
import { LEDGER_BASE, LedgerEntry, balanceSheet, bookPath, findBook, monthNames, monthlyTotals, shortMonths, summarize, pendingTotals, isSettled, isOverdue, entryStatusLabel, csvCell } from '../utils/ledger';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const number = (value: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const currentUserId = () => { try { return JSON.parse(localStorage.getItem('mfc.currentUser') || 'null')?.id as string | undefined; } catch { return undefined; } };

const GeneralLedger: React.FC = () => {
  const navigate = useNavigate();
  const { bookSlug } = useParams<{ bookSlug?: string }>();
  const [books, setBooks] = useState<FinancialEntity[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState<FinancialEntity | null>(null);
  const [deleteBook, setDeleteBook] = useState<FinancialEntity | null>(null);
  const [deletingBook, setDeletingBook] = useState(false);
  const userId = currentUserId();
  const { preferences, savePreferences } = useLedgerPreferences(userId);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showCenters, setShowCenters] = useState(false);
  const [overviewTab, setOverviewTab] = useState('livros');
  const canCreateBook = usePermission('livro-caixa', 'create');

  useEffect(() => {
    let cancelled = false;
    const load = () => Promise.all([api.getLedgerEntities(), api.getLedger()])
      .then(([bookItems, entryItems]) => { if (!cancelled) { setBooks(bookItems); setEntries(entryItems); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    load();
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.removeEventListener('focus', load); };
  }, [retry]);

  const book = useMemo(() => findBook(books, bookSlug), [books, bookSlug]);

  // Link por id (ou nome antigo) passa a mostrar o nome do livro na URL, sem perder a aba.
  useEffect(() => {
    if (!book || !bookSlug) return;
    const path = bookPath(book, books);
    if (path !== `${LEDGER_BASE}/${bookSlug}`) navigate({ pathname: path, search: window.location.search }, { replace: true });
  }, [book, books, bookSlug, navigate]);

  const openBookForm = (target: FinancialEntity | null) => { setEditingBook(target); setShowBookModal(true); };
  const handleBookSaved = (saved: FinancialEntity, mode: 'created' | 'updated') => setBooks(prev => mode === 'created' ? [saved, ...prev] : prev.map(item => item.id === saved.id ? saved : item));

  const removeBook = async () => {
    if (!deleteBook || deletingBook) return;
    setDeletingBook(true);
    try {
      await api.deleteLedgerEntity(deleteBook.id);
      setBooks(prev => prev.filter(item => item.id !== deleteBook.id));
      toast.success('Livro excluído.');
      setDeleteBook(null);
      if (book?.id === deleteBook.id) navigate(LEDGER_BASE, { replace: true });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o livro.'); }
    finally { setDeletingBook(false); }
  };

  if (loading) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando livro caixa…</div></PageWrapper>;

  if (error) return <PageWrapper><ContentCard><EmptyState icon={BookOpen} title="Não foi possível carregar o livro caixa" description="Confira a conexão e tente novamente."
    action={<Button onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Tentar novamente</Button>} /></ContentCard></PageWrapper>;

  if (bookSlug && !book) return <PageWrapper><ContentCard><EmptyState icon={BookOpen} title="Livro não encontrado" description="O livro pode ter sido removido ou o endereço está incorreto."
    action={<Button variant="outline" onClick={() => navigate(LEDGER_BASE)}>Voltar para o Livro Caixa</Button>} /></ContentCard></PageWrapper>;

  return (
    <PageWrapper>
      <div className="space-y-4">
        {!book && <SectionTitle title="Livro Caixa" icon={BookOpen} description="Movimentações e mensalidades das equipes, organizadas por exercício." action={<div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" iconLeft={<Table2 size={14} />} onClick={() => setShowCenters(true)}>Centros de custo</Button><Button variant="outline" size="sm" iconLeft={<Settings2 size={14} />} onClick={() => setShowPreferences(true)}>Preferências</Button>{canCreateBook && <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => openBookForm(null)}>Novo livro</Button>}</div>} />}
        {book
          ? <BookDetail key={book.id} book={book} entries={entries.filter(entry => entry.entityId === book.id)} userId={userId} preferences={preferences} onPreferences={() => setShowPreferences(true)}
              onBack={() => navigate(LEDGER_BASE)} onEdit={() => openBookForm(book)} onDelete={() => setDeleteBook(book)} onPaymentsChanged={() => setRetry(value => value + 1)} onCenters={() => setShowCenters(true)}
              onCreated={created => setEntries(prev => [...created, ...prev.filter(entry => !created.some(item => item.id === entry.id))])} onRemoved={id => setEntries(prev => prev.filter(entry => entry.id !== id))} />
          : <Tabs value={overviewTab} onChange={setOverviewTab} label="Livro Caixa e equipes" items={[{ id: 'livros', label: 'Livros por ano', icon: BookOpen }, { id: 'equipes', label: 'Equipes base', icon: Wallet }]}>
              {overviewTab === 'livros' ? <BooksList preferences={preferences} onPreferences={() => setShowPreferences(true)} books={books} entries={entries} onNew={() => openBookForm(null)} onOpen={target => navigate(bookPath(target, books))} onEdit={openBookForm} onDelete={setDeleteBook} />
                : <LedgerTeams userId={userId} onChanged={() => setRetry(value => value + 1)} />}
            </Tabs>}
      </div>

      <LedgerCostCentersModal isOpen={showCenters} onClose={() => setShowCenters(false)} onChanged={() => setRetry(n => n + 1)} />
      <LedgerPreferencesModal isOpen={showPreferences} onClose={() => setShowPreferences(false)} value={preferences} onSave={savePreferences} years={[...new Set(books.map(item => item.year))].sort((a, b) => b - a)} />
      <LedgerBookModal isOpen={showBookModal} book={editingBook} entryCount={editingBook ? entries.filter(entry => entry.entityId === editingBook.id).length : 0} userId={userId}
        onClose={() => setShowBookModal(false)} onSaved={handleBookSaved} />
      <ConfirmModal isOpen={!!deleteBook} onClose={() => setDeleteBook(null)} onConfirm={removeBook} loading={deletingBook} title="Excluir livro caixa?"
        message={`"${deleteBook?.name}" será excluído. Livros com lançamentos não podem ser excluídos: apague os lançamentos antes.`} confirmLabel="Excluir livro" variant="danger" />
    </PageWrapper>
  );
};

/* ───────────────────────────── Lista de livros ───────────────────────────── */

const BooksList: React.FC<{ preferences: LedgerPreferences; onPreferences: () => void; books: FinancialEntity[]; entries: LedgerEntry[]; onNew: () => void; onOpen: (book: FinancialEntity) => void; onEdit: (book: FinancialEntity) => void; onDelete: (book: FinancialEntity) => void }> = ({ preferences, onPreferences, books, entries, onNew, onOpen, onEdit, onDelete }) => {
  const canCreate = usePermission('livro-caixa', 'create');
  const canEdit = usePermission('livro-caixa', 'edit');
  const canDelete = usePermission('livro-caixa', 'delete');
  const [search, setSearch] = useState('');
  const resolveYear = () => preferences.year === 'current' ? String(new Date().getFullYear()) : preferences.year;
  const [year, setYear] = useState(resolveYear);
  useEffect(() => setYear(resolveYear()), [preferences.year]);
  const query = normalizeDirectoryText(search);

  const rows = useMemo(() => books.map(book => { const own = entries.filter(entry => entry.entityId === book.id); return { book, count: own.length, ...summarize(own, book.initialBalance) }; }), [books, entries]);
  const filtered = rows.filter(row => (!query || normalizeDirectoryText(`${row.book.name} ${row.book.year}`).includes(query)) && (year === 'all' || String(row.book.year) === year)).sort((a, b) => b.book.year - a.book.year || a.book.name.localeCompare(b.book.name, 'pt-BR'));
  const yearOptions = [{ value: 'all', label: 'Todos os anos' }, ...Array.from(new Set([new Date().getFullYear(), ...books.map(book => book.year)])).sort((a, b) => b - a).map(value => ({ value: String(value), label: String(value) }))];
  const totalBalance = filtered.reduce((sum, row) => sum + row.balance, 0);
  const totalEntries = filtered.reduce((sum, row) => sum + row.count, 0);

  return <div className="space-y-4">
    <StatGrid cols={3}>
      <StatCard title="Livros" value={filtered.length} icon={BookOpen} color="info" />
      <StatCard title="Saldo atual" value={money(totalBalance)} icon={Wallet} color={totalBalance >= 0 ? 'success' : 'danger'} description="Livros do filtro · somente valores realizados" />
      <StatCard title="Lançamentos" value={totalEntries} icon={ListChecks} color="purple" />
    </StatGrid>
    <FilterLine>
      <FilterLineSection grow>
        <FilterLineItem grow><FilterLineSearch aria-label="Buscar livro" value={search} onChange={setSearch} placeholder="Título ou ano…" /></FilterLineItem>
        <FilterLineItem><Select aria-label="Filtrar por ano" value={year} onChange={event => setYear(event.target.value)} options={yearOptions} /></FilterLineItem>
      </FilterLineSection>
      <FilterLineSection align="right"><span className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'livro' : 'livros'}</span></FilterLineSection>
    </FilterLine>

    {filtered.length === 0
      ? <ContentCard><EmptyState icon={BookOpen} title="Nenhum livro encontrado" description="Crie um livro ou selecione outro ano para consultar o histórico." action={<div className="flex gap-2">{canCreate && <Button size="sm" onClick={onNew}>Novo livro</Button>}<Button size="sm" variant="outline" onClick={() => { setYear('all'); setSearch(''); }}>Ver todos os anos</Button></div>} /></ContentCard>
      : <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map(({ book, count, balance, income, expenses }) =>
        <ContentCard key={book.id} padding="none" className="group flex h-full flex-col overflow-hidden transition-all hover:border-blue-200">
          <div className="flex flex-1 flex-col gap-3 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-600"><BookOpen size={14} /></div>
              <Badge size="sm" color="info">{book.year}</Badge>
            </div>
            <button type="button" className="text-left focus-visible:outline-blue-500" onClick={() => onOpen(book)}>
              <h3 className="text-sm font-semibold leading-tight text-slate-900 break-words transition-colors group-hover:text-blue-600">{book.name}</h3>
              <p className="mt-1 text-xs text-slate-500 break-words">{book.observations || 'Sem observações'}</p>
            </button>
            <dl className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-xs">
              <div><dt className="text-[11px] text-slate-500">Entradas</dt><dd className="mt-0.5 font-semibold tabular-nums text-emerald-700">{money(income)}</dd></div>
              <div><dt className="text-[11px] text-slate-500">Saídas</dt><dd className="mt-0.5 font-semibold tabular-nums text-red-600">{money(expenses)}</dd></div>
              <div><dt className="text-[11px] text-slate-500">Saldo</dt><dd className={`mt-0.5 font-semibold tabular-nums ${balance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{money(balance)}</dd></div>
            </dl>
            <p className="text-[11px] text-slate-500">{count} {count === 1 ? 'lançamento' : 'lançamentos'} · saldo inicial {money(Number(book.initialBalance) || 0)}</p>
          </div>
          <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/50 p-3">
            <Button size="xs" className="flex-1" iconRight={<ArrowRight size={12} />} onClick={() => onOpen(book)}>Abrir livro</Button>
            {canEdit && <IconButton variant="ghost" size="xs" aria-label={`Editar ${book.name}`} className="h-8 w-8" onClick={() => onEdit(book)}><Pencil size={14} /></IconButton>}
            {canDelete && !book.id.startsWith('mfc-team-payments-') && <IconButton variant="ghost" size="xs" aria-label={`Excluir ${book.name}`} className="h-8 w-8" onClick={() => onDelete(book)}><Trash2 size={14} className="text-red-500" /></IconButton>}
          </div>
        </ContentCard>)}</div>}
  </div>;
};

/* ───────────────────────────── Livro aberto ───────────────────────────── */

const bookTabs = [{ id: 'lancamentos', label: 'Lançamentos', icon: ListChecks }, { id: 'pagar', label: 'A pagar', icon: TrendingDown }, { id: 'receber', label: 'A receber', icon: TrendingUp }, { id: 'balancete', label: 'Balancete', icon: Table2 }, { id: 'grafico', label: 'Gráfico', icon: BarChart3 }, { id: 'equipes', label: 'Equipes base', icon: Wallet }] as const;
const bookTabIds = bookTabs.map(tab => tab.id);

const BookDetail: React.FC<{ onCenters: () => void; onPaymentsChanged: () => void; preferences: LedgerPreferences; onPreferences: () => void; book: FinancialEntity; entries: LedgerEntry[]; userId?: string; onBack: () => void; onEdit: () => void; onDelete: () => void; onCreated: (entries: LedgerEntry[]) => void; onRemoved: (id: string) => void }> = ({ preferences, onPreferences, book, entries, userId, onBack, onEdit, onDelete, onCreated, onRemoved, onPaymentsChanged, onCenters }) => {
  const canCreate = usePermission('livro-caixa', 'create');
  const canEdit = usePermission('livro-caixa', 'edit');
  const canDelete = usePermission('livro-caixa', 'delete');
  const [tab, setTab] = useUrlTab(bookTabIds, book.id.startsWith('mfc-team-payments-') ? 'equipes' : preferences.tab);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(preferences.month);
  const [statusFilter, setStatusFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [centerFilter, setCenterFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'filtered'>('all');
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [settleEntry, setSettleEntry] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const today = localDateToday();
  const [showEntry, setShowEntry] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<LedgerEntry | null>(null);
  const [removing, setRemoving] = useState(false);

  const totals = useMemo(() => summarize(entries, book.initialBalance), [entries, book.initialBalance]);
  const monthly = useMemo(() => monthlyTotals(entries), [entries]);
  const sheet = useMemo(() => balanceSheet(entries), [entries]);
  const pending = useMemo(() => pendingTotals(entries, today), [entries, today]);
  const summary = `${book.name} — ${book.year}\nSaldo inicial: ${money(Number(book.initialBalance) || 0)}\nEntradas recebidas: ${money(totals.income)}\nSaídas pagas: ${money(totals.expenses)}\nSaldo atual: ${money(totals.balance)}\nA receber: ${money(pending.receivable)}\nA pagar: ${money(pending.payable)}\nSaldo projetado: ${money(totals.balance + pending.receivable - pending.payable)}\nContas em atraso: ${pending.overdueCount}\nResumo em ${dateLabel(today)}.`;
  const openEntry = (entry: LedgerEntry | null, settle = false) => { setEditingEntry(entry); setSettleEntry(settle); setShowEntry(true); };
  const accountTab = tab === 'pagar' || tab === 'receber';

  const query = normalizeDirectoryText(search);
  const filtered = useMemo(() => [...entries]
    .filter(entry => (!accountTab || (entry.status === 'PENDING' && entry.type === (tab === 'pagar' ? 'OUT' : 'IN')))
      && (accountTab || typeFilter === 'all' || entry.type === typeFilter)
      && (monthFilter === 'all' || Number((accountTab ? entry.dueDate || entry.date : entry.date).slice(5, 7)) === Number(monthFilter))
      && (statusFilter === 'all' || (statusFilter === 'overdue' ? isOverdue(entry, today) : (entry.status || 'SETTLED') === statusFilter))
      && (kindFilter === 'all' || (entry.valueKind || 'VARIABLE') === kindFilter)
      && (!centerFilter || entry.costCenter === centerFilter) && (!accountFilter || entry.financialAccount === accountFilter)
      && (!query || normalizeDirectoryText(`${entry.description} ${entry.category || ''} ${entry.counterparty || ''} ${entry.notes || ''} ${entry.costCenter || ''} ${entry.analytic || ''} ${entry.financialAccount || ''}`).includes(query)))
    .sort((a, b) => accountTab ? (a.dueDate || a.date).localeCompare(b.dueDate || b.date) : b.date.localeCompare(a.date)), [entries, typeFilter, monthFilter, query, accountTab, tab, statusFilter, kindFilter, today, centerFilter, accountFilter]);
  const { page, pageSize, paginatedData, setPage, setPageSize } = usePagination(filtered, preferences.pageSize);
  useEffect(() => { setMonthFilter(preferences.month); setPageSize(preferences.pageSize); }, [preferences.month, preferences.pageSize]);
  const hasFilter = !!query || typeFilter !== 'all' || monthFilter !== 'all' || statusFilter !== 'all' || kindFilter !== 'all' || !!centerFilter || !!accountFilter;
  const changeTab = (next: typeof bookTabs[number]['id']) => { setTab(next); setTypeFilter('all'); setStatusFilter('all'); setPage(1); };

  const remove = async () => {
    if (!removeTarget || removing) return;
    setRemoving(true);
    try { await api.deleteLedger(removeTarget.id); onRemoved(removeTarget.id); toast.success('Lançamento excluído.'); setRemoveTarget(null); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o lançamento.'); }
    finally { setRemoving(false); }
  };

  const exportCsv = () => {
    const cell = csvCell;
    const rows: (string | number)[][] = [['Conta', ...monthNames, 'Total'], ['ENTRADAS']];
    sheet.income.forEach(row => rows.push([row.category, ...row.months.map(number), number(row.total)]));
    rows.push(['Total de entradas', ...monthly.income.map(number), number(totals.income)], ['SAÍDAS']);
    sheet.expenses.forEach(row => rows.push([row.category, ...row.months.map(number), number(row.total)]));
    rows.push(['Total de saídas', ...monthly.expenses.map(number), number(totals.expenses)], ['Saldo inicial', ...Array(12).fill(''), number(Number(book.initialBalance) || 0)], ['Saldo final', ...Array(12).fill(''), number(totals.balance)]);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['﻿' + rows.map(row => row.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    link.download = `livro-caixa-${book.year}-${book.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
  };

  const [exporting, setExporting] = useState(false);
  const exportWorkbook = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const filtered = exportScope === 'filtered';
      const { blob, filename } = await api.exportLedgerWorkbook(book.id, exportScope, filtered ? { tab, type: typeFilter, month: monthFilter, status: statusFilter, kind: kindFilter, search, costCenter: centerFilter, financialAccount: accountFilter } : {});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob); link.download = filename;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      toast.success(filtered ? 'Planilha gerada com os filtros da tela.' : 'Planilha completa do livro gerada.');
      setShowExport(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível gerar a planilha.'); }
    finally { setExporting(false); }
  };

  let running = Number(book.initialBalance) || 0;
  const chart = shortMonths.map((label, index) => ({ label, Entradas: monthly.income[index], Saídas: monthly.expenses[index] }));
  const columns = [
    { header: 'Data', render: (entry: LedgerEntry) => <span className="text-xs whitespace-nowrap text-slate-700">{dateLabel(entry.date)}</span> },
    { header: 'Descrição', render: (entry: LedgerEntry) => <div className="max-w-md min-w-0"><p className="text-xs text-slate-800 break-words">{entry.description || entry.category || 'Sem descrição'}</p>{entry.description && entry.category && <p className="mt-0.5 text-[11px] text-slate-500">{entry.category}</p>}</div> },
    { header: 'Tipo', render: (entry: LedgerEntry) => <Badge size="sm" dot color={entry.type === 'IN' ? 'success' : 'danger'}>{entry.type === 'IN' ? 'Entrada' : 'Saída'}</Badge> },
    { header: 'Centro / conta', render: (entry: LedgerEntry) => <div className="text-xs text-slate-600">{entry.costCenter || 'Sem centro'}<p className="text-[11px] text-slate-500">{entry.financialAccount || 'Sem conta financeira'}{entry.analytic ? ` · ${entry.analytic}` : ''}</p></div> },
    { header: 'Situação / vencimento', render: (entry: LedgerEntry) => <div className="space-y-1"><Badge size="sm" color={isOverdue(entry, today) ? 'danger' : isSettled(entry) ? 'success' : 'default'}>{entryStatusLabel(entry, today)}</Badge><p className="text-[11px] text-slate-500">{dateLabel(entry.dueDate || entry.date)}</p></div> },
    { header: 'Classificação', render: (entry: LedgerEntry) => <div className="text-xs text-slate-600">{entry.valueKind === 'FIXED' ? 'Fixo' : 'Variável'}<p className="text-[11px] text-slate-500">{entry.counterparty}</p></div> },
    { header: 'Valor', render: (entry: LedgerEntry) => <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${entry.type === 'IN' ? 'text-emerald-700' : 'text-red-600'}`}>{entry.type === 'IN' ? '+' : '−'} {money(entry.amount)}</span> },
    { header: 'Variação', render: (entry: LedgerEntry) => <span className="text-xs tabular-nums">{isSettled(entry) ? money(entry.amount - (entry.expectedAmount ?? entry.amount)) : '—'}</span> },
    { header: 'Ações', render: (entry: LedgerEntry) => <div className="flex items-center gap-1"><IconButton variant="ghost" size="xs" aria-label={canEdit && !entry.readOnly ? 'Editar lançamento' : 'Ver lançamento'} onClick={event => { event.stopPropagation(); openEntry(entry); }}><Pencil size={14} /></IconButton>{canEdit && entry.status === 'PENDING' && <Button variant="outline" size="xs" onClick={event => { event.stopPropagation(); openEntry(entry, true); }}>{entry.type === 'IN' ? 'Receber' : 'Pagar'}</Button>}{canDelete && !entry.readOnly && <IconButton variant="ghost" size="xs" aria-label={`Excluir lançamento de ${money(entry.amount)}`} onClick={event => { event.stopPropagation(); setRemoveTarget(entry); }}><Trash2 size={14} className="text-red-500" /></IconButton>}</div> },
  ];

  return <>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={onBack}>Voltar para o Livro Caixa</Button>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" iconLeft={<Table2 size={14} />} onClick={onCenters}>Centros de custo</Button>
        <Button variant="outline" size="sm" iconLeft={<Settings2 size={14} />} onClick={onPreferences}>Preferências</Button>
        <Button variant="outline" size="sm" iconLeft={<Share2 size={14} />} onClick={() => setShowShare(true)}>Comunicar resumo</Button>
        <Button variant="outline" size="sm" iconLeft={<Download size={14} />} disabled={exporting} onClick={() => setShowExport(true)}>Exportar Excel / PDF</Button>
        {canEdit && <Button variant="outline" size="sm" iconLeft={<Pencil size={14} />} onClick={onEdit}>Editar livro</Button>}
        {canDelete && !book.id.startsWith('mfc-team-payments-') && <Button variant="outline" size="sm" iconLeft={<Trash2 size={14} />} onClick={onDelete}>Excluir livro</Button>}
        {canCreate && <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => openEntry(null)}>{accountTab ? 'Nova conta' : 'Novo lançamento'}</Button>}
      </div>
    </div>

    <ContentCard padding="md">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600"><BookOpen size={24} /></div>
        <div className="min-w-0"><h1 className="text-base sm:text-lg font-semibold text-slate-900 break-words">{book.name}</h1>
          <p className="mt-1 text-xs text-slate-500 break-words">Exercício {book.year}{book.observations ? ` · ${book.observations}` : ''}</p></div>
      </div>
    </ContentCard>

    <StatGrid cols={4}>
      <StatCard title="Saldo inicial" value={money(Number(book.initialBalance) || 0)} icon={DollarSign} color="info" />
      <StatCard title="Entradas" value={money(totals.income)} icon={TrendingUp} color="success" />
      <StatCard title="Saídas" value={money(totals.expenses)} icon={TrendingDown} color="danger" />
      <StatCard title="Saldo atual" value={money(totals.balance)} icon={Wallet} color={totals.balance >= 0 ? 'purple' : 'danger'} />
    </StatGrid>

    <StatGrid cols={4}>
      <StatCard title="A receber" value={money(pending.receivable)} icon={TrendingUp} color="success" description="Contas pendentes" />
      <StatCard title="A pagar" value={money(pending.payable)} icon={TrendingDown} color="danger" description="Contas pendentes" />
      <StatCard title="Em atraso" value={pending.overdueCount} icon={Clock} color="warning" description={money(pending.overdueAmount) + ' em contas vencidas'} />
      <StatCard title="Saldo projetado" value={money(totals.balance + pending.receivable - pending.payable)} icon={Wallet} color="info" description="Saldo atual + a receber − a pagar" />
    </StatGrid>
    <Tabs<typeof bookTabs[number]['id']> items={bookTabs} value={tab} onChange={changeTab} label="Seções do livro caixa">
      {(tab === 'lancamentos' || accountTab) && <div className="space-y-3">
        <p className="text-xs text-slate-500">Clique em uma linha para {canEdit ? 'ver e editar' : 'consultar'} o lançamento. Variação = realizado − previsto. Os downloads respeitam os filtros; os indicadores mostram o exercício completo.</p>
        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem grow><FilterLineSearch aria-label="Buscar lançamento" value={search} onChange={setSearch} placeholder="Descrição ou conta…" /></FilterLineItem>
            {!accountTab && <FilterLineItem><FilterLineSegmented value={typeFilter} onChange={value => setTypeFilter(String(value))} options={[{ value: 'all', label: 'Todos' }, { value: 'IN', label: 'Entradas' }, { value: 'OUT', label: 'Saídas' }]} /></FilterLineItem>}
            <FilterLineItem><Select aria-label="Situação" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={accountTab ? [{ value: 'all', label: 'Todas as pendências' }, { value: 'overdue', label: 'Em atraso' }] : [{ value: 'all', label: 'Todas as situações' }, { value: 'PENDING', label: 'Pendentes' }, { value: 'SETTLED', label: 'Pagos / recebidos' }, { value: 'overdue', label: 'Em atraso' }, { value: 'CANCELLED', label: 'Cancelados' }]} /></FilterLineItem>
            <FilterLineItem><Select aria-label="Classificação" value={kindFilter} onChange={e => setKindFilter(e.target.value)} options={[{ value: 'all', label: 'Fixos e variáveis' }, { value: 'FIXED', label: 'Fixos' }, { value: 'VARIABLE', label: 'Variáveis' }]} /></FilterLineItem>
            <FilterLineItem><Select aria-label="Centro de custo" value={centerFilter} onChange={e => setCenterFilter(e.target.value)} options={[{ value: '', label: 'Todos os centros' }, ...[...new Set(entries.map(e => e.costCenter).filter(Boolean))].sort().map(value => ({ value, label: value }))]} /></FilterLineItem>
            <FilterLineItem><Select aria-label="Conta financeira" value={accountFilter} onChange={e => setAccountFilter(e.target.value)} options={[{ value: '', label: 'Todas as contas' }, ...[...new Set(entries.map(e => e.financialAccount).filter(Boolean))].sort().map(value => ({ value, label: value }))]} /></FilterLineItem>
            <FilterLineItem><Select aria-label="Mês" value={monthFilter} onChange={event => setMonthFilter(event.target.value)} options={[{ value: 'all', label: 'Todos os meses' }, ...monthNames.map((label, index) => ({ value: String(index + 1), label }))]} /></FilterLineItem>
          </FilterLineSection>
          <FilterLineSection align="right">
            <span className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'lançamento' : 'lançamentos'}</span>
            {hasFilter && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setTypeFilter('all'); setMonthFilter('all'); setKindFilter('all'); setStatusFilter('all'); setCenterFilter(''); setAccountFilter(''); }}>Limpar filtros</Button>}
          </FilterLineSection>
        </FilterLine>
        <ContentCard padding="none">
          <GridTable<LedgerEntry> data={paginatedData} columns={columns} keyExtractor={entry => entry.id} noDesktopCard onRowClick={entry => openEntry(entry)}
            emptyMessage={<EmptyState icon={ListChecks} title={entries.length ? 'Nenhum lançamento encontrado' : 'Nenhum lançamento neste livro'} description={entries.length ? 'Ajuste a busca ou os filtros.' : 'Registre a primeira entrada ou saída do exercício.'}
              action={canCreate ? <Button size="sm" onClick={() => openEntry(null)}>Novo lançamento</Button> : undefined} />}
            pagination={{ total: filtered.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }} />
        </ContentCard>
      </div>}

{tab === 'equipes' && <LedgerTeams year={book.year} userId={userId} onChanged={onPaymentsChanged} />}
      {tab === 'balancete' && <ContentCard padding="none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left text-xs">
            <thead><tr className="bg-slate-50">
              <th scope="col" className="sticky left-0 z-10 min-w-[220px] border-b border-slate-100 bg-slate-50 px-3 py-2.5 text-[11px] font-semibold text-slate-500">Conta</th>
              {shortMonths.map(label => <th key={label} scope="col" className="border-b border-slate-100 px-3 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label}</th>)}
              <th scope="col" className="border-b border-slate-100 px-3 py-2.5 text-right text-[11px] font-semibold text-slate-700">Total</th>
            </tr></thead>
            <tbody>
              {[{ title: 'Entradas', rows: sheet.income, months: monthly.income, total: totals.income, tone: 'text-emerald-700' }, { title: 'Saídas', rows: sheet.expenses, months: monthly.expenses, total: totals.expenses, tone: 'text-red-600' }].map(section => <React.Fragment key={section.title}>
                <tr><th scope="colspan" colSpan={14} className="sticky left-0 border-b border-slate-100 bg-slate-100/70 px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-600">{section.title}</th></tr>
                {section.rows.length === 0 && <tr><td colSpan={14} className="border-b border-slate-50 px-3 py-3 text-slate-400">Nenhum lançamento.</td></tr>}
                {section.rows.map(row => <tr key={row.category} className="hover:bg-slate-50/60">
                  <th scope="row" className="sticky left-0 z-10 border-b border-slate-50 bg-white px-3 py-2 text-left font-normal text-slate-800">{row.category}</th>
                  {row.months.map((value, index) => <td key={index} className={`border-b border-slate-50 px-3 py-2 text-right tabular-nums ${value ? section.tone : 'text-slate-300'}`}>{value ? number(value) : '—'}</td>)}
                  <td className={`border-b border-slate-50 px-3 py-2 text-right font-semibold tabular-nums ${section.tone}`}>{number(row.total)}</td>
                </tr>)}
                <tr className="bg-slate-50/60">
                  <th scope="row" className="sticky left-0 z-10 border-b border-slate-100 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-800">Total de {section.title.toLowerCase()}</th>
                  {section.months.map((value, index) => <td key={index} className="border-b border-slate-100 px-3 py-2 text-right font-semibold tabular-nums text-slate-800">{value ? number(value) : '—'}</td>)}
                  <td className="border-b border-slate-100 px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{number(section.total)}</td>
                </tr>
              </React.Fragment>)}
              <tr>
                <th scope="row" className="sticky left-0 z-10 bg-blue-50 px-3 py-2.5 text-left font-semibold text-blue-900">Saldo acumulado</th>
                {monthly.income.map((income, index) => { running += income - monthly.expenses[index]; return <td key={index} className={`bg-blue-50 px-3 py-2.5 text-right font-semibold tabular-nums ${running >= 0 ? 'text-blue-900' : 'text-red-600'}`}>{number(running)}</td>; })}
                <td className={`bg-blue-50 px-3 py-2.5 text-right font-semibold tabular-nums ${totals.balance >= 0 ? 'text-blue-900' : 'text-red-600'}`}>{number(totals.balance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 p-3 text-xs text-slate-500">Saldo inicial de {money(Number(book.initialBalance) || 0)} somado mês a mês. Role para o lado para ver todos os meses.</p>
      </ContentCard>}

      {tab === 'grafico' && <PanelCard title="Entradas e saídas por mês" description={`Exercício ${book.year}.`}>
        {entries.length ? <div className="h-72 min-w-0">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}><BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: number) => money(value)} /><Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Entradas" fill="#10b981" radius={[3, 3, 0, 0]} barSize={14} /><Bar dataKey="Saídas" fill="#ef4444" radius={[3, 3, 0, 0]} barSize={14} />
          </BarChart></ResponsiveContainer>
        </div> : <EmptyState icon={BarChart3} title="Sem lançamentos" description="O gráfico aparece depois do primeiro lançamento." />}
      </PanelCard>}
    </Tabs>

    <Modal isOpen={showExport} onClose={() => { if (!exporting) setShowExport(false); }} title="Exportar Livro Caixa" size="lg" footer={<ModalFooter>
      <Button variant="outline" size="sm" disabled={exporting} iconLeft={<Printer size={14} />} onClick={async () => { setExporting(true); try { await printLedger(book, exportScope === 'all' ? entries : filtered, summary, exportScope); } catch (error) { toast.error((error as Error).message); } finally { setExporting(false); } }}>Imprimir / salvar PDF</Button>
      <Button size="sm" loading={exporting} iconLeft={<Download size={14} />} onClick={exportWorkbook}>Baixar Excel (.xlsx)</Button>
    </ModalFooter>}><div className="space-y-4"><Select label="Conteúdo do relatório" value={exportScope} onChange={e => setExportScope(e.target.value as 'all' | 'filtered')} options={[{ value: 'all', label: `Livro completo — ${entries.length} lançamentos` }, { value: 'filtered', label: `Somente os filtros da tela — ${filtered.length} lançamentos` }]} /><p className="text-xs text-slate-600">Excel com painel e gráficos editáveis, diário, balancetes, contas financeiras, pendências e uma aba para cada centro de custo utilizado. Tabelas filtráveis, moedas formatadas e cabeçalhos congelados.</p><p className="text-xs text-slate-500">Os filtros do painel atualizam os gráficos. O PDF abre uma prévia com resumo, gráfico e tabelas. Alterações nos arquivos não modificam o sistema.</p></div></Modal>
    <LedgerEntryModal isOpen={showEntry} book={book} entry={editingEntry} settle={settleEntry} readOnly={!!editingEntry?.readOnly || (!!editingEntry && !canEdit)} defaultType={tab === 'pagar' ? 'OUT' : 'IN'} defaultPending={accountTab} userId={userId} onClose={() => setShowEntry(false)} onSaved={onCreated} />
    <Modal isOpen={showShare} onClose={() => setShowShare(false)} title="Comunicar resumo do exercício" size="md" footer={<ModalFooter>
      <Button variant="outline" size="sm" iconLeft={<Copy size={14} />} onClick={async () => { try { await navigator.clipboard.writeText(summary); toast.success('Resumo copiado.'); } catch { toast.error('Não foi possível copiar. Selecione o resumo e copie manualmente.'); } }}>Copiar</Button>
      <Button size="sm" iconLeft={<Share2 size={14} />} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank', 'noopener,noreferrer')}>Abrir no WhatsApp</Button>
    </ModalFooter>}><p className="mb-3 text-xs text-slate-500">Confira os valores antes de compartilhar. Você escolhe o destinatário e confirma o envio no WhatsApp.</p><pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-700">{summary}</pre></Modal>
    <ConfirmModal isOpen={!!removeTarget} onClose={() => setRemoveTarget(null)} onConfirm={remove} loading={removing} title="Excluir lançamento?"
      message={removeTarget ? `${removeTarget.type === 'IN' ? 'Entrada' : 'Saída'} de ${money(removeTarget.amount)} em ${dateLabel(removeTarget.date)} será excluída. Esta ação não pode ser desfeita.` : ''} confirmLabel="Excluir lançamento" variant="danger" />
  </>;
};

export default GeneralLedger;
