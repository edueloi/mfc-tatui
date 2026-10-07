import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BookOpen, Plus, ArrowLeft, ArrowRight, Download, DollarSign, TrendingUp, TrendingDown, Wallet, Pencil, Trash2, Loader2, ListChecks, Table2, BarChart3,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { api } from '../api';
import { FinancialEntity } from '../types';
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard, PanelCard, Tabs, Button, IconButton, Badge, Select, EmptyState, ConfirmModal, GridTable, usePagination,
  FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch, FilterLineSegmented,
} from '../components/ui';
import { LedgerBookModal } from '../components/LedgerBookModal';
import { LedgerEntryModal } from '../components/LedgerEntryModal';
import { usePermission } from '../src/hooks/usePermission';
import { useUrlTab } from '../src/hooks/useUrlTab';
import { dateLabel } from '../utils/dates';
import { normalizeDirectoryText } from '../utils/memberDirectory';
import { LEDGER_BASE, LedgerEntry, balanceSheet, bookPath, findBook, monthNames, monthlyTotals, shortMonths, summarize } from '../utils/ledger';

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
        {book
          ? <BookDetail book={book} entries={entries.filter(entry => entry.entityId === book.id)} userId={userId}
              onBack={() => navigate(LEDGER_BASE)} onEdit={() => openBookForm(book)} onDelete={() => setDeleteBook(book)}
              onCreated={created => setEntries(prev => [...created, ...prev])} onRemoved={id => setEntries(prev => prev.filter(entry => entry.id !== id))} />
          : <BooksList books={books} entries={entries} onNew={() => openBookForm(null)} onOpen={target => navigate(bookPath(target, books))} onEdit={openBookForm} onDelete={setDeleteBook} />}
      </div>

      <LedgerBookModal isOpen={showBookModal} book={editingBook} entryCount={editingBook ? entries.filter(entry => entry.entityId === editingBook.id).length : 0} userId={userId}
        onClose={() => setShowBookModal(false)} onSaved={handleBookSaved} />
      <ConfirmModal isOpen={!!deleteBook} onClose={() => setDeleteBook(null)} onConfirm={removeBook} loading={deletingBook} title="Excluir livro caixa?"
        message={`"${deleteBook?.name}" será excluído. Livros com lançamentos não podem ser excluídos: apague os lançamentos antes.`} confirmLabel="Excluir livro" variant="danger" />
    </PageWrapper>
  );
};

/* ───────────────────────────── Lista de livros ───────────────────────────── */

const BooksList: React.FC<{ books: FinancialEntity[]; entries: LedgerEntry[]; onNew: () => void; onOpen: (book: FinancialEntity) => void; onEdit: (book: FinancialEntity) => void; onDelete: (book: FinancialEntity) => void }> = ({ books, entries, onNew, onOpen, onEdit, onDelete }) => {
  const canCreate = usePermission('livro-caixa', 'create');
  const canEdit = usePermission('livro-caixa', 'edit');
  const canDelete = usePermission('livro-caixa', 'delete');
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('all');
  const query = normalizeDirectoryText(search);

  const rows = useMemo(() => books.map(book => { const own = entries.filter(entry => entry.entityId === book.id); return { book, count: own.length, ...summarize(own, book.initialBalance) }; }), [books, entries]);
  const filtered = rows.filter(row => (!query || normalizeDirectoryText(`${row.book.name} ${row.book.year}`).includes(query)) && (year === 'all' || String(row.book.year) === year)).sort((a, b) => b.book.year - a.book.year || a.book.name.localeCompare(b.book.name, 'pt-BR'));
  const yearOptions = [{ value: 'all', label: 'Todos os anos' }, ...Array.from(new Set(books.map(book => book.year))).sort((a, b) => b - a).map(value => ({ value: String(value), label: String(value) }))];
  const totalBalance = rows.reduce((sum, row) => sum + row.balance, 0);
  const totalEntries = rows.reduce((sum, row) => sum + row.count, 0);

  return <>
    <SectionTitle title="Livro Caixa" icon={BookOpen} description="Entradas e saídas de cada exercício."
      action={canCreate ? <Button size="sm" iconLeft={<Plus size={14} />} onClick={onNew}>Novo livro</Button> : undefined} />
    <StatGrid cols={3}>
      <StatCard title="Livros" value={books.length} icon={BookOpen} color="info" />
      <StatCard title="Saldo atual" value={money(totalBalance)} icon={Wallet} color={totalBalance >= 0 ? 'success' : 'danger'} description="Soma de todos os livros" />
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
      ? <ContentCard><EmptyState icon={BookOpen} title="Nenhum livro encontrado" description={search || year !== 'all' ? 'Ajuste a busca ou o ano.' : 'Crie o livro caixa do exercício para começar a lançar.'} action={!search && year === 'all' && canCreate ? <Button size="sm" onClick={onNew}>Novo livro</Button> : undefined} /></ContentCard>
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
            {canDelete && <IconButton variant="ghost" size="xs" aria-label={`Excluir ${book.name}`} className="h-8 w-8" onClick={() => onDelete(book)}><Trash2 size={14} className="text-red-500" /></IconButton>}
          </div>
        </ContentCard>)}</div>}
  </>;
};

/* ───────────────────────────── Livro aberto ───────────────────────────── */

const bookTabs = [{ id: 'lancamentos', label: 'Lançamentos', icon: ListChecks }, { id: 'balancete', label: 'Balancete', icon: Table2 }, { id: 'grafico', label: 'Gráfico', icon: BarChart3 }] as const;
const bookTabIds = bookTabs.map(tab => tab.id);

const BookDetail: React.FC<{ book: FinancialEntity; entries: LedgerEntry[]; userId?: string; onBack: () => void; onEdit: () => void; onDelete: () => void; onCreated: (entries: LedgerEntry[]) => void; onRemoved: (id: string) => void }> = ({ book, entries, userId, onBack, onEdit, onDelete, onCreated, onRemoved }) => {
  const canCreate = usePermission('livro-caixa', 'create');
  const canEdit = usePermission('livro-caixa', 'edit');
  const canDelete = usePermission('livro-caixa', 'delete');
  const [tab, setTab] = useUrlTab(bookTabIds, 'lancamentos');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [showEntry, setShowEntry] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<LedgerEntry | null>(null);
  const [removing, setRemoving] = useState(false);

  const totals = useMemo(() => summarize(entries, book.initialBalance), [entries, book.initialBalance]);
  const monthly = useMemo(() => monthlyTotals(entries), [entries]);
  const sheet = useMemo(() => balanceSheet(entries), [entries]);

  const query = normalizeDirectoryText(search);
  const filtered = useMemo(() => [...entries]
    .filter(entry => (typeFilter === 'all' || entry.type === typeFilter) && (monthFilter === 'all' || Number(entry.date.slice(5, 7)) === Number(monthFilter)) && (!query || normalizeDirectoryText(`${entry.description} ${entry.category || ''}`).includes(query)))
    .sort((a, b) => b.date.localeCompare(a.date)), [entries, typeFilter, monthFilter, query]);
  const { page, pageSize, paginatedData, setPage, setPageSize } = usePagination(filtered, 15);
  const hasFilter = !!query || typeFilter !== 'all' || monthFilter !== 'all';

  const remove = async () => {
    if (!removeTarget || removing) return;
    setRemoving(true);
    try { await api.deleteLedger(removeTarget.id); onRemoved(removeTarget.id); toast.success('Lançamento excluído.'); setRemoveTarget(null); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o lançamento.'); }
    finally { setRemoving(false); }
  };

  const exportCsv = () => {
    const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
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

  let running = Number(book.initialBalance) || 0;
  const chart = shortMonths.map((label, index) => ({ label, Entradas: monthly.income[index], Saídas: monthly.expenses[index] }));
  const columns = [
    { header: 'Data', render: (entry: LedgerEntry) => <span className="text-xs whitespace-nowrap text-slate-700">{dateLabel(entry.date)}</span> },
    { header: 'Descrição', render: (entry: LedgerEntry) => <div className="max-w-md min-w-0"><p className="text-xs text-slate-800 break-words">{entry.description || entry.category || 'Sem descrição'}</p>{entry.description && entry.category && <p className="mt-0.5 text-[11px] text-slate-500">{entry.category}</p>}</div> },
    { header: 'Tipo', render: (entry: LedgerEntry) => <Badge size="sm" dot color={entry.type === 'IN' ? 'success' : 'danger'}>{entry.type === 'IN' ? 'Entrada' : 'Saída'}</Badge> },
    { header: 'Valor', render: (entry: LedgerEntry) => <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${entry.type === 'IN' ? 'text-emerald-700' : 'text-red-600'}`}>{entry.type === 'IN' ? '+' : '−'} {money(entry.amount)}</span> },
    { header: '', render: (entry: LedgerEntry) => canDelete ? <IconButton variant="ghost" size="xs" aria-label={`Excluir lançamento de ${money(entry.amount)}`} onClick={event => { event.stopPropagation(); setRemoveTarget(entry); }}><Trash2 size={14} className="text-red-500" /></IconButton> : null },
  ];

  return <>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={onBack}>Voltar para o Livro Caixa</Button>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" iconLeft={<Download size={14} />} onClick={exportCsv}>Exportar CSV</Button>
        {canEdit && <Button variant="outline" size="sm" iconLeft={<Pencil size={14} />} onClick={onEdit}>Editar livro</Button>}
        {canDelete && <Button variant="outline" size="sm" iconLeft={<Trash2 size={14} />} onClick={onDelete}>Excluir livro</Button>}
        {canCreate && <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => setShowEntry(true)}>Novo lançamento</Button>}
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

    <Tabs<typeof bookTabs[number]['id']> items={bookTabs} value={tab} onChange={setTab} label="Seções do livro caixa">
      {tab === 'lancamentos' && <div className="space-y-3">
        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem grow><FilterLineSearch aria-label="Buscar lançamento" value={search} onChange={setSearch} placeholder="Descrição ou conta…" /></FilterLineItem>
            <FilterLineItem><FilterLineSegmented value={typeFilter} onChange={value => setTypeFilter(String(value))} options={[{ value: 'all', label: 'Todos' }, { value: 'IN', label: 'Entradas' }, { value: 'OUT', label: 'Saídas' }]} /></FilterLineItem>
            <FilterLineItem><Select aria-label="Mês" value={monthFilter} onChange={event => setMonthFilter(event.target.value)} options={[{ value: 'all', label: 'Todos os meses' }, ...monthNames.map((label, index) => ({ value: String(index + 1), label }))]} /></FilterLineItem>
          </FilterLineSection>
          <FilterLineSection align="right">
            <span className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'lançamento' : 'lançamentos'}</span>
            {hasFilter && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setTypeFilter('all'); setMonthFilter('all'); }}>Limpar filtros</Button>}
          </FilterLineSection>
        </FilterLine>
        <ContentCard padding="none">
          <GridTable<LedgerEntry> data={paginatedData} columns={columns} keyExtractor={entry => entry.id} noDesktopCard
            emptyMessage={<EmptyState icon={ListChecks} title={entries.length ? 'Nenhum lançamento encontrado' : 'Nenhum lançamento neste livro'} description={entries.length ? 'Ajuste a busca ou os filtros.' : 'Registre a primeira entrada ou saída do exercício.'}
              action={!entries.length && canCreate ? <Button size="sm" onClick={() => setShowEntry(true)}>Novo lançamento</Button> : undefined} />}
            pagination={{ total: filtered.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }} />
        </ContentCard>
      </div>}

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

    <LedgerEntryModal isOpen={showEntry} book={book} userId={userId} onClose={() => setShowEntry(false)} onSaved={onCreated} />
    <ConfirmModal isOpen={!!removeTarget} onClose={() => setRemoveTarget(null)} onConfirm={remove} loading={removing} title="Excluir lançamento?"
      message={removeTarget ? `${removeTarget.type === 'IN' ? 'Entrada' : 'Saída'} de ${money(removeTarget.amount)} em ${dateLabel(removeTarget.date)} será excluída. Esta ação não pode ser desfeita.` : ''} confirmLabel="Excluir lançamento" variant="danger" />
  </>;
};

export default GeneralLedger;
