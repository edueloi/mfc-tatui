import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, CalendarDays, CheckCircle2, ClipboardList, Download, HandCoins, Heart, Loader2, MapPin, Pencil, Send, ShoppingCart, Trash2, UserPlus, UserRound, Users, Wallet, XCircle,
  Ban, RotateCcw, ListChecks, Target, Info, BarChart3, Lock, SlidersHorizontal, Plus, TrendingDown, TrendingUp, ServerCrash,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import { api, photoSrc } from '../api';
import { BaseTeam, BridalMeeting, Event, EventExpense, EventIncome, EventItem, EventRegistration, EventSale, Member } from '../types';
import {
  PageWrapper, ContentCard, PanelCard, StatGrid, StatCard, Tabs, Button, IconButton, Badge, DetailField, EmptyState, ConfirmModal, GridTable, Select, usePagination,
  FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch,
} from '../components/ui';
import { EventInviteModal } from '../components/EventInviteModal';
import { EventItemsPanel } from '../components/EventItemsPanel';
import { EventMoneyModal } from '../components/EventMoneyModal';
import { EventPaymentModal } from '../components/EventPaymentModal';
import { EventQuickEditModal } from '../components/EventQuickEditModal';
import { EventRegistrationModal } from '../components/EventRegistrationModal';
import { EventSaleModal } from '../components/EventSaleModal';
import { useUrlTab } from '../src/hooks/useUrlTab';
import { getCurrentUser } from '../src/lib/currentUser';
import { dateLabel } from '../utils/dates';
import { normalizeDirectoryText } from '../utils/memberDirectory';
import { maskPhone } from '../utils/masks';
import { meetingPath, findMeeting } from '../utils/bridalPaths';
import { CLOSE_AFTER_DAYS, EVENTS_BASE, canSellTickets, eventPath, eventStatus, findEvent, money, people, percent, scopedTeamId } from '../utils/events';

const tabs = [
  { id: 'resumo', label: 'Resumo', icon: Info },
  { id: 'inscritos', label: 'Inscritos', icon: Users },
  { id: 'itens', label: 'Itens', icon: ClipboardList },
  { id: 'equipes', label: 'Equipes', icon: ListChecks },
  { id: 'vendas', label: 'Vendas', icon: ShoppingCart },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'graficos', label: 'Gráficos', icon: BarChart3 },
] as const;
const tabIds = tabs.map(tab => tab.id);

const STATUS_COLOR = { Convidado: 'purple', Inscrito: 'info', Confirmado: 'success', Cancelado: 'default' } as const;
const PAYMENT_COLOR = { Pendente: 'warning', Parcial: 'purple', Pago: 'success', Isento: 'default' } as const;
const SOURCE_LABEL: Record<string, string> = { equipe: 'Equipe', usuario: 'Pelo sistema', manual: 'Manual', convite: 'Convite', link: 'Link público' };
const CHART_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

class OutdatedServerError extends Error {}

const Progress: React.FC<{ label: string; value: string; percentValue: number | null; tone?: string; empty?: string }> = ({ label, value, percentValue, tone = 'bg-blue-600', empty }) => (
  <div>
    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs"><span className="text-slate-600">{label}</span><span className="font-semibold tabular-nums text-slate-900">{value}</span></div>
    {percentValue === null ? <p className="text-[11px] text-slate-500">{empty || 'Sem meta definida.'}</p>
      : <div role="progressbar" aria-label={label} aria-valuenow={percentValue} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${percentValue}%` }} /></div>}
    {percentValue !== null && <p className="mt-1 text-[11px] text-slate-500">{percentValue}% da meta</p>}
  </div>
);

const ChartCard: React.FC<{ title: string; description?: string; empty?: boolean; emptyText?: string; children: React.ReactNode }> = ({ title, description, empty, emptyText, children }) => (
  <PanelCard title={title} description={description}>
    {empty ? <EmptyState icon={BarChart3} title="Sem dados ainda" description={emptyText} /> : <div className="h-64 min-w-0">{children}</div>}
  </PanelCard>
);

const EventDetail: React.FC = () => {
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const navigate = useNavigate();
  const me = getCurrentUser();
  const scope = scopedTeamId(me);
  const staff = scope === null;
  const [tab, setTab] = useUrlTab(tabIds, 'resumo');

  const [list, setList] = useState<Event[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [sales, setSales] = useState<EventSale[]>([]);
  const [meetings, setMeetings] = useState<BridalMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'none' | 'failed' | 'outdated'>('none');
  const [retry, setRetry] = useState(0);
  const [showRegister, setShowRegister] = useState(false);
  const [registerTeam, setRegisterTeam] = useState<string | undefined>();
  const [showInvite, setShowInvite] = useState(false);
  const [showSale, setShowSale] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [money_, setMoneyKind] = useState<'income' | 'expense' | null>(null);
  const [payFor, setPayFor] = useState<EventRegistration | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ kind: 'cancel-event' | 'reopen-event' | 'close-event' | 'delete-event' | 'cancel-reg' | 'delete-reg' | 'delete-income' | 'delete-expense' | 'delete-sale'; registration?: EventRegistration; income?: EventIncome; expense?: EventExpense; sale?: EventSale } | null>(null);
  const [working, setWorking] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [events, teamItems, memberItems, saleItems, meetingItems] = await Promise.all([api.getEvents(), api.getTeams(), api.getMembers().catch(() => []), api.getEventSales().catch(() => []), api.getBridalMeetings().catch(() => [])]);
        if (cancelled) return;
        // Servidor antigo (ainda não reiniciado) devolve eventos sem os dados novos.
        if (events.length && !events[0].stats) throw new OutdatedServerError();
        setList(events); setTeams(teamItems); setMembers(memberItems); setSales(saleItems); setMeetings(meetingItems);
        const target = findEvent(events, eventSlug);
        setEvent(target ? await api.getEvent(target.id) : null);
        setError('none');
      } catch (err) { if (!cancelled) setError(err instanceof OutdatedServerError ? 'outdated' : 'failed'); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [eventSlug, retry]);

  // Link por id (ou nome antigo) passa a mostrar o nome do evento na URL, sem perder a aba.
  useEffect(() => {
    const target = findEvent(list, eventSlug);
    if (!target) return;
    const path = eventPath(target, list);
    if (path !== `${EVENTS_BASE}/${eventSlug}`) navigate({ pathname: path, search: window.location.search }, { replace: true });
  }, [list, eventSlug, navigate]);

  const reload = () => setRetry(value => value + 1);
  const status = event ? eventStatus(event) : null;
  const locked = !!status?.locked;
  const registrations = event?.registrations || [];
  const items = event?.items || [];
  const fee = !!event && event.hasFee !== false && Number(event.ticketValue) > 0;
  const mine = registrations.find(item => item.source === 'usuario' && item.createdBy === me?.id && item.status !== 'Cancelado');
  const linkedMeeting = event?.bridalMeetingId ? meetings.find(item => item.id === event.bridalMeetingId) : undefined;
  const canManage = (registration: EventRegistration) => !locked && (staff || registration.teamId === scope || (!!me && registration.createdBy === me.id));
  const teamName = (id: string | null) => teams.find(team => team.id === id)?.name || '';
  const patch = (data: Partial<Event>) => setEvent(prev => prev ? { ...prev, ...data } : prev);

  const query = normalizeDirectoryText(search);
  const filtered = useMemo(() => registrations.filter(item =>
    (statusFilter === 'all' || item.status === statusFilter) && (teamFilter === 'all' || (teamFilter === 'none' ? !item.teamId : item.teamId === teamFilter))
    && (!query || normalizeDirectoryText(`${item.name} ${item.phone} ${item.email}`).includes(query))), [registrations, statusFilter, teamFilter, query]);
  const { page, pageSize, paginatedData, setPage, setPageSize } = usePagination(filtered, 15);

  const eventSales = useMemo(() => event ? sales.filter(sale => sale.eventId === event.id) : [], [sales, event]);
  const memberName = useMemo(() => new Map(members.map(member => [member.id, member.name])), [members]);
  const sellers = useMemo(() => {
    const map = new Map<string, { memberId: string; name: string; teamId: string; tickets: number; paid: number; pending: number }>();
    eventSales.forEach(sale => {
      const row = map.get(sale.memberId) || { memberId: sale.memberId, name: memberName.get(sale.memberId) || 'Vendedor', teamId: sale.teamId, tickets: 0, paid: 0, pending: 0 };
      row.tickets += 1;
      if (String(sale.status).toLowerCase() === 'pago') row.paid += sale.amount; else row.pending += sale.amount;
      map.set(sale.memberId, row);
    });
    return [...map.values()].sort((a, b) => b.paid - a.paid || b.tickets - a.tickets);
  }, [eventSales, memberName]);
  const sellersPage = usePagination(sellers, 10);
  const salesSorted = useMemo(() => [...eventSales].sort((a, b) => b.date.localeCompare(a.date)), [eventSales]);
  const salesPage = usePagination(salesSorted, 10);

  const updateRegistration = async (registration: EventRegistration, data: Partial<EventRegistration>, message: string) => {
    if (busyId) return;
    setBusyId(registration.id);
    try { await api.updateEventRegistration(registration.id, data); toast.success(message); reload(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar a inscrição.'); }
    finally { setBusyId(null); }
  };

  const joinMyself = async () => {
    if (!event || !me || working) return;
    setWorking(true);
    try { await api.createEventRegistrations(event.id, [{ name: me.name, teamId: me.teamId || null, source: 'usuario', createdBy: me.id }]); toast.success('Inscrição feita. Te esperamos lá!'); reload(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível fazer sua inscrição.'); }
    finally { setWorking(false); }
  };

  const runConfirmed = async () => {
    if (!event || !confirmAction || working) return;
    setWorking(true);
    try {
      const { kind } = confirmAction;
      if (kind === 'cancel-event') { await api.updateEvent(event.id, { isActive: false }); toast.success('Evento cancelado.'); }
      else if (kind === 'reopen-event') { await api.updateEvent(event.id, { isActive: true, closed: false }); toast.success('Evento reaberto.'); }
      else if (kind === 'close-event') { await api.updateEvent(event.id, { closed: true }); toast.success('Evento encerrado. Ficou só para consulta.'); }
      else if (kind === 'delete-event') { await api.deleteEvent(event.id); toast.success('Evento excluído.'); navigate(EVENTS_BASE, { replace: true }); return; }
      else if (kind === 'cancel-reg' && confirmAction.registration) { await api.updateEventRegistration(confirmAction.registration.id, { status: 'Cancelado' }); toast.success('Inscrição cancelada.'); }
      else if (kind === 'delete-reg' && confirmAction.registration) { await api.deleteEventRegistration(confirmAction.registration.id); toast.success('Inscrição excluída.'); }
      else if (kind === 'delete-income' && confirmAction.income) { await api.deleteEventIncome(confirmAction.income.id); toast.success('Entrada excluída.'); }
      else if (kind === 'delete-sale' && confirmAction.sale) { await api.deleteEventSale(confirmAction.sale.id); toast.success('Venda excluída.'); }
      else if (kind === 'delete-expense' && confirmAction.expense) { await api.deleteEventExpense(confirmAction.expense.id); toast.success('Gasto excluído.'); }
      setConfirmAction(null);
      reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível concluir a ação.'); }
    finally { setWorking(false); }
  };

  const exportCsv = () => {
    if (!event) return;
    const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [['Nome', 'Telefone', 'E-mail', 'Equipe', 'Pessoas', 'Situação', 'Devido', 'Pago', 'Pagamento', 'Origem', 'Observações'],
      ...registrations.map(item => [item.name, item.phone, item.email, teamName(item.teamId), people(item), item.status, item.amountDue.toFixed(2), item.amountPaid.toFixed(2), item.paymentStatus, SOURCE_LABEL[item.source] || item.source, item.notes])];
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['﻿' + rows.map(row => row.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    link.download = `inscritos-${event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
  };

  if (loading) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando evento…</div></PageWrapper>;
  if (error === 'outdated') return <PageWrapper><ContentCard><EmptyState icon={ServerCrash} title="O servidor ainda está na versão antiga" description="Os eventos novos precisam do backend atualizado. Reinicie o servidor (backend) e atualize esta página."
    action={<div className="flex flex-wrap justify-center gap-2"><Button variant="outline" onClick={() => navigate(EVENTS_BASE)}>Voltar para Eventos</Button><Button onClick={() => { setLoading(true); reload(); }}>Tentar novamente</Button></div>} /></ContentCard></PageWrapper>;
  if (error === 'failed' || !event || !status) return <PageWrapper><ContentCard><EmptyState icon={CalendarDays} title={error === 'failed' ? 'Não foi possível carregar o evento' : 'Evento não encontrado'} description={error === 'failed' ? 'Confira a conexão e tente novamente.' : 'O evento pode ter sido removido ou o endereço está incorreto.'}
    action={<div className="flex flex-wrap justify-center gap-2"><Button variant="outline" onClick={() => navigate(EVENTS_BASE)}>Voltar para Eventos</Button>{error === 'failed' && <Button onClick={() => { setLoading(true); reload(); }}>Tentar novamente</Button>}</div>} /></ContentCard></PageWrapper>;

  const stats = event.stats!;
  const peopleGoal = event.participantsGoal || null;
  const extraExpenses = event.extraExpenses || [];
  const incomes = event.incomes || [];
  const couples = event.couples || [];
  const result = stats.raised - stats.expensesTotal;
  const toReceive = Math.max(0, stats.due - registrations.filter(item => item.status !== 'Cancelado').reduce((sum, item) => sum + item.amountPaid, 0));
  const teamRows = teams.map(team => { const stat = event.teamStats?.find(item => item.teamId === team.id); const quota = event.teamQuotas.find(item => item.teamId === team.id)?.quotaValue || 0; return { team, registered: stat?.registered || 0, raised: stat?.raised || 0, quota }; })
    .filter(row => row.registered || row.raised || row.quota || staff || row.team.id === scope);
  const showSales = fee || eventSales.length > 0;
  const visibleTabs = tabs.filter(item => item.id !== 'vendas' || showSales);
  const meetingLink = linkedMeeting ? meetingPath(linkedMeeting, meetings) : null;
  void findMeeting;

  // Dados dos gráficos
  const teamChart = teamRows.filter(row => row.registered || row.raised).map(row => ({ name: row.team.name, Inscritos: row.registered, Arrecadado: row.raised }));
  const origin = [{ name: 'Inscrições', value: stats.raisedBreakdown.registrations }, { name: 'Vendas', value: stats.raisedBreakdown.sales }, { name: 'Casais do encontro', value: stats.raisedBreakdown.couples }, { name: 'Outras entradas', value: stats.raisedBreakdown.incomes }].filter(item => item.value > 0);
  const paymentPie = (['Pago', 'Parcial', 'Pendente', 'Isento'] as const).map(name => ({ name, value: registrations.filter(item => item.status !== 'Cancelado' && item.paymentStatus === name).length })).filter(item => item.value > 0);
  const timeline = (() => {
    const byDay = new Map<string, number>();
    registrations.filter(item => item.status !== 'Cancelado' && item.createdAt).forEach(item => { const day = String(item.createdAt).slice(0, 10); byDay.set(day, (byDay.get(day) || 0) + people(item)); });
    let total = 0;
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day: dateLabel(day).slice(0, 5), Inscritos: (total += count) }));
  })();
  const moneyBars = [{ name: 'Entradas', Valor: stats.raised }, { name: 'Gastos previstos', Valor: stats.expensesPlanned }, { name: 'Gastos a mais', Valor: stats.expensesExtra }, { name: 'Resultado', Valor: result }];
  const sellerChart = sellers.slice(0, 8).map(row => ({ name: row.name.split(' ')[0], Pago: row.paid, Pendente: row.pending }));
  const tooltipMoney = (value: number) => money(value);

  return (
    <PageWrapper>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={() => navigate(EVENTS_BASE)}>Voltar para Eventos</Button>
          <div className="flex flex-wrap gap-2">
            {meetingLink && <Button variant="outline" size="sm" iconLeft={<Heart size={14} />} onClick={() => navigate(meetingLink)}>Abrir Encontro de Noivos</Button>}
            {status.canRegister && event.isActive && !locked && <Button variant="outline" size="sm" iconLeft={<Send size={14} />} onClick={() => setShowInvite(true)}>Convidar</Button>}
            {status.canRegister && event.isActive && !mine && me && <Button variant="outline" size="sm" iconLeft={<UserRound size={14} />} loading={working} onClick={joinMyself}>Quero participar</Button>}
            {status.canRegister && event.isActive && <Button size="sm" iconLeft={<UserPlus size={14} />} onClick={() => { setRegisterTeam(undefined); setShowRegister(true); }}>Inscrever</Button>}
            {staff && <Button variant="outline" size="sm" iconLeft={<SlidersHorizontal size={14} />} onClick={() => setShowQuick(true)}>Ajustes rápidos</Button>}
            {staff && <Button variant="outline" size="sm" iconLeft={<Pencil size={14} />} onClick={() => navigate(`${eventPath(event, list)}/editar`)}>Editar</Button>}
            {staff && event.isActive && !event.closed && status.phase !== 'encerrado' && <Button variant="outline" size="sm" iconLeft={<Lock size={14} />} onClick={() => setConfirmAction({ kind: 'close-event' })}>Encerrar</Button>}
            {staff && (!event.isActive || event.closed) && <Button variant="outline" size="sm" iconLeft={<RotateCcw size={14} />} onClick={() => setConfirmAction({ kind: 'reopen-event' })}>Reabrir</Button>}
            {staff && event.isActive && status.phase !== 'encerrado' && <Button variant="outline" size="sm" iconLeft={<Ban size={14} />} onClick={() => setConfirmAction({ kind: 'cancel-event' })}>Cancelar evento</Button>}
            {staff && !event.bridalMeetingId && <IconButton variant="outline" size="sm" aria-label="Excluir evento" title="Excluir evento" onClick={() => setConfirmAction({ kind: 'delete-event' })}><Trash2 size={14} className="text-red-500" /></IconButton>}
          </div>
        </div>

        {status.phase === 'realizado' && <ContentCard padding="md" className="border-amber-200 bg-amber-50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-start gap-2 text-sm text-amber-900"><Lock size={16} className="mt-0.5 shrink-0" />Evento realizado. Acerte inscrições, pagamentos, entradas e gastos até {dateLabel(status.closesOn.toISOString())} ({status.daysToClose === 0 ? 'hoje é o último dia' : `${status.daysToClose} ${status.daysToClose === 1 ? 'dia' : 'dias'}`}): depois disso ele é encerrado sozinho.</p>
            {staff && <Button size="xs" variant="outline" onClick={() => setConfirmAction({ kind: 'close-event' })}>Encerrar agora</Button>}
          </div>
        </ContentCard>}
        {status.phase === 'encerrado' && <ContentCard padding="md" className="bg-slate-50">
          <p className="flex items-start gap-2 text-sm text-slate-700"><Lock size={16} className="mt-0.5 shrink-0" />Evento encerrado{event.closed ? '' : ` automaticamente (${CLOSE_AFTER_DAYS} dias depois da data)`}. Está só para consulta: não aceita inscrição, pagamento, gasto nem entrada.{staff && event.closed && ' Use “Reabrir” para voltar a lançar.'}</p>
        </ContentCard>}

        <ContentCard padding="none" className="overflow-hidden">
          {event.imageUrl && <div className="h-36 w-full bg-slate-100 sm:h-44"><img src={photoSrc(event.imageUrl)} alt={`Imagem do evento ${event.name}`} className="h-full w-full object-cover" /></div>}
          <div className="p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge size="sm" color={event.kind === 'externo' ? 'purple' : 'info'}>{event.kind === 'externo' ? 'Evento externo' : 'Evento interno'}</Badge>
              <Badge size="sm" color={fee ? 'warning' : 'success'}>{fee ? `Taxa ${money(Number(event.ticketValue))} por pessoa` : 'Sem taxa'}</Badge>
              <Badge size="sm" dot color={status.phase === 'cancelado' ? 'danger' : status.phase === 'encerrado' || status.phase === 'realizado' ? 'default' : status.phase === 'hoje' ? 'success' : 'info'}>{status.label}</Badge>
              {event.bridalMeetingId && <Badge size="sm" color="danger" icon={<Heart size={10} />}>Encontro de Noivos</Badge>}
              {mine && <Badge size="sm" color="success" icon={<CheckCircle2 size={10} />}>Você está inscrito</Badge>}
            </div>
            <h1 className="mt-2 text-base sm:text-lg font-semibold text-slate-900 break-words">{event.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={12} />{dateLabel(event.date)}{event.endDate && event.endDate !== event.date ? ` a ${dateLabel(event.endDate)}` : ''}{event.startTime ? ` · ${event.startTime}${event.endTime ? ` às ${event.endTime}` : ''}` : ''}</span>
              {event.location && <span className="inline-flex items-center gap-1.5 break-words"><MapPin size={12} />{event.location}</span>}
              {event.responsible && <span className="inline-flex items-center gap-1.5"><UserRound size={12} />{event.responsible}</span>}
            </p>
          </div>
        </ContentCard>

        <StatGrid cols={4}>
          <StatCard title="Inscritos" value={stats.registered} icon={Users} color="info" description={stats.couples ? `${stats.couples} ${stats.couples === 1 ? 'casal' : 'casais'} do encontro${registrations.length ? ' + inscrições' : ''}` : peopleGoal ? `Meta ${peopleGoal}` : event.capacity ? `${event.capacity} vagas` : 'Pessoas, com acompanhantes'} />
          <StatCard title="Entradas" value={money(stats.raised)} icon={TrendingUp} color="success" description={Number(event.goalValue) > 0 ? `Meta ${money(Number(event.goalValue))}` : 'Tudo que entrou no evento'} />
          <StatCard title="Gastos" value={money(stats.expensesTotal)} icon={TrendingDown} color="danger" description={stats.expensesExtra ? `${money(stats.expensesExtra)} a mais` : 'Previstos e a mais'} />
          <StatCard title="Resultado" value={money(result)} icon={Wallet} color={result >= 0 ? 'purple' : 'danger'} description="Entradas menos gastos" />
        </StatGrid>

        <Tabs<typeof tabIds[number]> items={visibleTabs} value={tab} onChange={setTab} label="Seções do evento">
          {tab === 'resumo' && <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <PanelCard title="Sobre o evento" className="lg:col-span-2">
              {event.description ? <p className="mb-4 whitespace-pre-line text-[13px] leading-relaxed text-slate-700">{event.description}</p> : <p className="mb-4 text-xs text-slate-500">Sem descrição. {staff && 'Adicione em Editar.'}</p>}
              <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                <DetailField label="Tipo" value={event.kind === 'externo' ? 'Externo (aberto a convidados)' : 'Interno (só membros)'} />
                <DetailField label="Quando" value={`${dateLabel(event.date)}${event.endDate && event.endDate !== event.date ? ` a ${dateLabel(event.endDate)}` : ''}${event.startTime ? ` · ${event.startTime}${event.endTime ? ` às ${event.endTime}` : ''}` : ''}`} />
                <DetailField label="Local" value={event.location} />
                <DetailField label="Responsável" value={event.responsible} />
                <DetailField label="Taxa" value={fee ? `${money(Number(event.ticketValue))} por pessoa` : 'Sem taxa'} />
                <DetailField label="Inscrições pelo link" value={event.kind !== 'externo' ? 'Não se aplica (evento interno)' : status.publicOpen ? `Abertas${event.registrationDeadline ? ` até ${dateLabel(event.registrationDeadline)}` : ''}` : 'Fechadas'} />
                <DetailField label="Vagas" value={event.capacity ? `${event.capacity} (restam ${status.spotsLeft})` : 'Sem limite'} />
                <DetailField label="Encerra sozinho em" value={dateLabel(status.closesOn.toISOString())} />
              </dl>
            </PanelCard>
            <div className="space-y-3">
              <PanelCard title="Metas">
                <div className="space-y-4">
                  <Progress label="Participantes" value={`${stats.registered}${peopleGoal ? ` / ${peopleGoal}` : ''}`} percentValue={percent(stats.registered, peopleGoal)} tone="bg-emerald-500" />
                  <Progress label="Arrecadação" value={`${money(stats.raised)}${Number(event.goalValue) > 0 ? ` / ${money(Number(event.goalValue))}` : ''}`} percentValue={percent(stats.raised, event.goalValue)} />
                  {stats.itemsTotal > 0 && <Progress label="Itens confirmados" value={`${stats.itemsDone} / ${stats.itemsTotal}`} percentValue={percent(stats.itemsDone, stats.itemsTotal)} tone="bg-amber-500" />}
                </div>
              </PanelCard>
              {staff && event.notes && <PanelCard title="Observações internas"><p className="whitespace-pre-line text-xs leading-relaxed text-slate-700">{event.notes}</p></PanelCard>}
              {meetingLink && <PanelCard title="Encontro de Noivos"><p className="mb-3 text-xs leading-relaxed text-slate-600">Este evento acompanha o encontro: nome, data e local são os mesmos. Os casais e os pagamentos deles ficam na ficha do encontro.</p><Button variant="outline" size="sm" iconLeft={<Heart size={14} />} onClick={() => navigate(meetingLink)}>Abrir o encontro</Button></PanelCard>}
            </div>
          </div>}

          {tab === 'inscritos' && <div className="space-y-3">
            {meetingLink && <PanelCard title="Casais do Encontro de Noivos" icon={Heart}
              description={`${couples.length} ${couples.length === 1 ? 'casal' : 'casais'} no encontro, contados como ${couples.length * 2} pessoas.`}
              action={<Button size="xs" variant="outline" onClick={() => navigate(meetingLink)}>Abrir o encontro</Button>}>
              <GridTable<typeof couples[number]> data={couples} keyExtractor={couple => couple.id} noDesktopCard onRowClick={couple => navigate(`/encontro-noivos/${couple.id}`)}
                columns={[
                  { header: 'Casal', render: couple => <div className="min-w-0"><p className="text-xs font-medium text-slate-800 break-words">{couple.noivoName || 'Noivo'} &amp; {couple.noivaName || 'Noiva'}</p><p className="mt-0.5 text-[11px] text-slate-500">2 pessoas</p></div> },
                  { header: 'Situação', render: couple => <Badge size="sm" dot color={couple.status === 'Confirmado' ? 'success' : couple.status === 'Cancelado' ? 'danger' : couple.status === 'Aguardando Pagamento' ? 'warning' : 'default'}>{couple.status}</Badge> },
                  { header: 'Pagamento', render: couple => <div><Badge size="sm" color={couple.paymentStatus === 'Pago' ? 'success' : couple.paymentStatus === 'Parcial' ? 'purple' : couple.paymentStatus === 'Isento' ? 'info' : 'warning'}>{couple.paymentStatus}</Badge>{couple.paymentAmount > 0 && <p className="mt-1 text-[11px] tabular-nums text-slate-500">{money(couple.paymentAmount)}</p>}</div> },
                  { header: 'Ficha', render: couple => <Button size="xs" variant="ghost" onClick={clickEvent => { clickEvent.stopPropagation(); navigate(`/encontro-noivos/${couple.id}`); }}>Abrir ficha</Button> },
                ]}
                emptyMessage={<EmptyState icon={Heart} title="Nenhum casal no encontro ainda" description="Os casais cadastrados no Encontro de Noivos aparecem aqui automaticamente." />} />
            </PanelCard>}
            {(!meetingLink || registrations.length > 0) && <>
            {meetingLink && <p className="pt-1 text-xs font-semibold text-slate-800">Outras inscrições</p>}
            <FilterLine>
              <FilterLineSection grow>
                <FilterLineItem grow><FilterLineSearch aria-label="Buscar inscrito" value={search} onChange={setSearch} placeholder="Nome, telefone ou e-mail…" /></FilterLineItem>
                <FilterLineItem><Select aria-label="Situação" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[{ value: 'all', label: 'Todas as situações' }, ...['Inscrito', 'Confirmado', 'Convidado', 'Cancelado'].map(value => ({ value, label: value }))]} /></FilterLineItem>
                <FilterLineItem><Select aria-label="Equipe" value={teamFilter} onChange={e => setTeamFilter(e.target.value)} options={[{ value: 'all', label: 'Todas as equipes' }, { value: 'none', label: 'Sem equipe' }, ...teams.map(team => ({ value: team.id, label: team.name }))]} /></FilterLineItem>
              </FilterLineSection>
              <FilterLineSection align="right">
                <span className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'inscrição' : 'inscrições'}</span>
                {staff && registrations.length > 0 && <Button variant="outline" size="sm" iconLeft={<Download size={14} />} onClick={exportCsv}>Exportar CSV</Button>}
              </FilterLineSection>
            </FilterLine>
            <ContentCard padding="none">
              <GridTable<EventRegistration> data={paginatedData} keyExtractor={item => item.id} noDesktopCard
                columns={[
                  { header: 'Pessoa', render: item => <div className="min-w-0"><p className="text-xs font-medium text-slate-800 break-words">{item.name}{item.guests > 0 && <span className="font-normal text-slate-500"> + {item.guests}</span>}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{[item.phone ? maskPhone(item.phone) : '', SOURCE_LABEL[item.source]].filter(Boolean).join(' · ')}</p></div> },
                  { header: 'Equipe', render: item => <span className="text-xs text-slate-700">{teamName(item.teamId) || '—'}</span> },
                  { header: 'Situação', render: item => <Badge size="sm" dot color={STATUS_COLOR[item.status]}>{item.status}</Badge> },
                  ...(fee ? [{ header: 'Pagamento', render: (item: EventRegistration) => <div><Badge size="sm" color={PAYMENT_COLOR[item.paymentStatus]}>{item.paymentStatus}</Badge>{item.paymentStatus !== 'Isento' && <p className="mt-1 text-[11px] tabular-nums text-slate-500">{money(item.amountPaid)} de {money(item.amountDue)}</p>}</div> }] : []),
                  { header: 'Ações', render: item => locked ? <span className="text-[11px] text-slate-400">Encerrado</span> : !canManage(item) ? <span className="text-[11px] text-slate-400">Outra equipe</span> : <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                    {fee && item.status !== 'Cancelado' && item.paymentStatus !== 'Pago' && item.paymentStatus !== 'Isento' && <Button size="xs" variant="outline" iconLeft={<HandCoins size={12} />} onClick={() => setPayFor(item)}>Receber</Button>}
                    {(item.status === 'Inscrito' || item.status === 'Convidado') && <Button size="xs" variant="ghost" disabled={!!busyId} onClick={() => updateRegistration(item, { status: 'Confirmado' }, 'Inscrição confirmada.')}>Confirmar</Button>}
                    {item.status === 'Cancelado' && <Button size="xs" variant="ghost" disabled={!!busyId} onClick={() => updateRegistration(item, { status: 'Inscrito' }, 'Inscrição reativada.')}>Reativar</Button>}
                    {item.status !== 'Cancelado' && <IconButton variant="ghost" size="xs" aria-label={`Cancelar inscrição de ${item.name}`} title="Cancelar inscrição" onClick={() => setConfirmAction({ kind: 'cancel-reg', registration: item })}><XCircle size={14} className="text-amber-600" /></IconButton>}
                    {staff && <IconButton variant="ghost" size="xs" aria-label={`Excluir inscrição de ${item.name}`} title="Excluir" onClick={() => setConfirmAction({ kind: 'delete-reg', registration: item })}><Trash2 size={14} className="text-red-500" /></IconButton>}
                  </div> },
                ]}
                emptyMessage={<EmptyState icon={Users} title={registrations.length ? 'Nenhuma inscrição encontrada' : 'Ninguém inscrito ainda'} description={registrations.length ? 'Ajuste a busca ou os filtros.' : 'Inscreva membros da equipe, registre convidados ou envie o convite.'}
                  action={!registrations.length && status.canRegister && event.isActive ? <div className="flex flex-wrap justify-center gap-2"><Button size="sm" iconLeft={<UserPlus size={14} />} onClick={() => { setRegisterTeam(undefined); setShowRegister(true); }}>Inscrever</Button><Button variant="outline" size="sm" iconLeft={<Send size={14} />} onClick={() => setShowInvite(true)}>Convidar</Button></div> : undefined} />}
                pagination={{ total: filtered.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }} />
            </ContentCard>
            </>}
          </div>}

          {tab === 'itens' && <EventItemsPanel event={event} items={items} teams={teams} me={me ? { name: me.name, teamId: me.teamId } : null} canEdit={!locked && (staff || !!scope)} onChange={next => patch({ items: next, stats: { ...stats, itemsTotal: next.length, itemsDone: next.filter((item: EventItem) => item.status !== 'Pendente').length } })} />}

          {tab === 'equipes' && <ContentCard padding="none">
            <GridTable<typeof teamRows[number]> data={teamRows} keyExtractor={row => row.team.id} noDesktopCard
              columns={[
                { header: 'Equipe', render: row => <span className="text-xs font-medium text-slate-800 break-words">{row.team.name}</span> },
                { header: 'Inscritos', render: row => <span className="text-xs tabular-nums text-slate-700">{row.registered}</span> },
                ...(fee ? [
                  { header: 'Arrecadado', render: (row: typeof teamRows[number]) => <span className="text-xs tabular-nums text-slate-700">{money(row.raised)}</span> },
                  { header: 'Meta da equipe', render: (row: typeof teamRows[number]) => row.quota ? <div className="min-w-[120px]"><div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>{money(row.quota)}</span><span>{percent(row.raised, row.quota)}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${percent(row.raised, row.quota) ?? 0}%` }} /></div></div> : <span className="text-xs text-slate-400">Sem meta</span> },
                ] : []),
                { header: 'Ações', render: row => (staff || row.team.id === scope) && status.canRegister && event.isActive ? <Button size="xs" variant="outline" iconLeft={<UserPlus size={12} />} onClick={() => { setRegisterTeam(row.team.id); setShowRegister(true); }}>Inscrever equipe</Button> : null },
              ]}
              emptyMessage={<EmptyState icon={Users} title="Nenhuma equipe" description="Cadastre equipes para acompanhar as metas." />} />
          </ContentCard>}

          {tab === 'vendas' && <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">{eventSales.length} {eventSales.length === 1 ? 'ingresso vendido' : 'ingressos vendidos'} · {money(stats.salesRaised)} recebidos{canSellTickets(event) ? '' : ' (vendas encerradas)'}</p>
              {canSellTickets(event) && status.canRegister && <Button size="sm" iconLeft={<ShoppingCart size={14} />} onClick={() => setShowSale(true)}>Registrar venda</Button>}
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <PanelCard title="Quem vendeu" description="Ranking por valor recebido.">
                <GridTable<typeof sellers[number]> data={sellersPage.paginatedData} keyExtractor={row => row.memberId} noDesktopCard
                  columns={[
                    { header: 'Vendedor', render: row => <div><p className="text-xs font-medium text-slate-800 break-words">{row.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{teamName(row.teamId)}</p></div> },
                    { header: 'Ingressos', render: row => <span className="text-xs tabular-nums">{row.tickets}</span> },
                    { header: 'Recebido', render: row => <span className="text-xs font-semibold tabular-nums text-emerald-700">{money(row.paid)}</span> },
                    { header: 'A receber', render: row => <span className="text-xs tabular-nums text-amber-700">{row.pending ? money(row.pending) : '—'}</span> },
                  ]}
                  emptyMessage={<EmptyState icon={ShoppingCart} title="Nenhuma venda ainda" description="As vendas registradas pelas equipes aparecem aqui." />}
                  pagination={sellers.length > 10 ? { total: sellers.length, page: sellersPage.page, pageSize: sellersPage.pageSize, onPageChange: sellersPage.setPage, onPageSizeChange: sellersPage.setPageSize } : undefined} />
              </PanelCard>
              <PanelCard title="Todas as vendas" description="Mais recentes primeiro.">
                <GridTable<EventSale> data={salesPage.paginatedData} keyExtractor={row => row.id} noDesktopCard
                  columns={[
                    { header: 'Data', render: row => <span className="text-xs whitespace-nowrap">{dateLabel(row.date)}</span> },
                    { header: 'Comprador', render: row => <div><p className="text-xs text-slate-800 break-words">{row.buyerName}</p><p className="mt-0.5 text-[11px] text-slate-500">Vendido por {memberName.get(row.memberId) || 'vendedor'} · {teamName(row.teamId)}</p></div> },
                    { header: 'Valor', render: row => <div className="text-right"><p className="text-xs font-semibold tabular-nums">{money(row.amount)}</p><Badge size="sm" color={String(row.status).toLowerCase() === 'pago' ? 'success' : 'warning'}>{row.status}</Badge></div> },
                    { header: '', render: row => staff && !locked ? <IconButton variant="ghost" size="xs" aria-label={`Excluir venda para ${row.buyerName}`} title="Excluir venda" onClick={() => setConfirmAction({ kind: 'delete-sale', sale: row })}><Trash2 size={14} className="text-red-500" /></IconButton> : null },
                  ]}
                  emptyMessage={<EmptyState icon={ShoppingCart} title="Nenhuma venda registrada" />}
                  pagination={salesSorted.length > 10 ? { total: salesSorted.length, page: salesPage.page, pageSize: salesPage.pageSize, onPageChange: salesPage.setPage, onPageSizeChange: salesPage.setPageSize } : undefined} />
              </PanelCard>
            </div>
          </div>}

          {tab === 'financeiro' && <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">{locked ? 'Evento encerrado: somente consulta.' : 'Registre o que entrou e o que foi gasto, inclusive gastos a mais que o previsto.'}</p>
              {!locked && (staff || !!scope) && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" iconLeft={<Plus size={14} />} onClick={() => setMoneyKind('income')}>Registrar entrada</Button><Button size="sm" iconLeft={<Plus size={14} />} onClick={() => setMoneyKind('expense')}>Registrar gasto</Button></div>}
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <PanelCard title="Entradas" description={`Total ${money(stats.raised)}`}>
                <dl className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><dt className="text-slate-600">Inscrições pagas</dt><dd className="tabular-nums font-medium">{money(stats.raisedBreakdown.registrations)}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-600">Vendas de ingresso</dt><dd className="tabular-nums font-medium">{money(stats.raisedBreakdown.sales)}</dd></div>
                  {event.bridalMeetingId && <div className="flex justify-between"><dt className="text-slate-600">Casais do Encontro de Noivos</dt><dd className="tabular-nums font-medium">{money(stats.raisedBreakdown.couples)}</dd></div>}
                  <div className="flex justify-between"><dt className="text-slate-600">Outras entradas</dt><dd className="tabular-nums font-medium">{money(stats.raisedBreakdown.incomes)}</dd></div>
                </dl>
                {couples.length > 0 && <div className="mt-3 border-t border-slate-100 pt-3"><p className="mb-1 text-xs font-semibold text-slate-800">Casais e pagamentos</p>
                  <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto">{couples.map(couple => <li key={couple.id} className="flex items-center justify-between gap-3 py-1.5 text-xs"><span className="min-w-0 break-words text-slate-800">{couple.noivoName || 'Noivo'} &amp; {couple.noivaName || 'Noiva'}</span>
                    <span className="flex shrink-0 items-center gap-2"><Badge size="sm" color={couple.paymentStatus === 'Pago' ? 'success' : couple.paymentStatus === 'Parcial' ? 'purple' : couple.paymentStatus === 'Isento' ? 'info' : 'warning'}>{couple.paymentStatus}</Badge><span className="tabular-nums text-slate-700">{couple.paymentAmount ? money(couple.paymentAmount) : '—'}</span></span></li>)}</ul></div>}
                <div className="mt-3 border-t border-slate-100 pt-3"><p className="mb-1 text-xs font-semibold text-slate-800">Outras entradas lançadas</p>
                  {incomes.length ? <ul className="divide-y divide-slate-100">{incomes.map(item => <li key={item.id} className="flex items-center justify-between gap-3 py-1.5 text-xs"><span className="min-w-0"><span className="block break-words text-slate-800">{item.description}</span><span className="text-slate-500">{dateLabel(item.date)}</span></span>
                    <span className="flex shrink-0 items-center gap-1"><span className="tabular-nums font-medium text-emerald-700">{money(item.amount)}</span>{!locked && staff && <IconButton variant="ghost" size="xs" aria-label={`Excluir entrada ${item.description}`} onClick={() => setConfirmAction({ kind: 'delete-income', income: item })}><Trash2 size={13} className="text-red-500" /></IconButton>}</span></li>)}</ul>
                    : <p className="text-xs text-slate-500">Nenhuma entrada avulsa (doações, patrocínio…).</p>}</div>
              </PanelCard>
              <PanelCard title="Gastos" description={`Total ${money(stats.expensesTotal)}`}>
                <p className="mb-1 text-xs font-semibold text-slate-800">Previstos <span className="font-normal text-slate-500">· {money(stats.expensesPlanned)}</span></p>
                {event.expenses.length ? <ul className="divide-y divide-slate-100">{event.expenses.map(item => <li key={item.id} className="flex justify-between gap-3 py-1.5 text-xs"><span className="text-slate-800 break-words">{item.description}</span><span className="tabular-nums text-slate-700">{money(Number(item.amount))}</span></li>)}</ul>
                  : <p className="text-xs text-slate-500">Nenhum gasto previsto. {staff && 'Cadastre em Editar, aba Gastos.'}</p>}
                <p className="mb-1 mt-3 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-800">A mais <span className="font-normal text-slate-500">· {money(stats.expensesExtra)}</span></p>
                {extraExpenses.length ? <ul className="divide-y divide-slate-100">{extraExpenses.map(item => <li key={item.id} className="flex items-center justify-between gap-3 py-1.5 text-xs"><span className="min-w-0"><span className="block break-words text-slate-800">{item.description}</span><span className="text-slate-500">{dateLabel(item.date || '')}</span></span>
                  <span className="flex shrink-0 items-center gap-1"><span className="tabular-nums font-medium text-red-600">{money(Number(item.amount))}</span>{!locked && staff && <IconButton variant="ghost" size="xs" aria-label={`Excluir gasto ${item.description}`} onClick={() => setConfirmAction({ kind: 'delete-expense', expense: item })}><Trash2 size={13} className="text-red-500" /></IconButton>}</span></li>)}</ul>
                  : <p className="text-xs text-slate-500">Nenhum gasto a mais até agora.</p>}
                <div className={`mt-3 rounded-lg p-3 text-xs ${result >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>Resultado: <strong>{money(result)}</strong> ({money(stats.raised)} de entradas − {money(stats.expensesTotal)} de gastos)</div>
              </PanelCard>
            </div>
          </div>}

          {tab === 'graficos' && <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ChartCard title="Inscritos por equipe" empty={teamChart.length === 0} emptyText="Inscreva membros das equipes para ver o comparativo.">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}><BarChart data={teamChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <Tooltip /><Bar dataKey="Inscritos" fill="#2563eb" radius={[3, 3, 0, 0]} barSize={26} />
              </BarChart></ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Evolução das inscrições" description="Pessoas inscritas, somadas dia a dia." empty={timeline.length < 1} emptyText="Aparece depois das primeiras inscrições.">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}><AreaChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <Tooltip /><Area type="monotone" dataKey="Inscritos" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
              </AreaChart></ResponsiveContainer>
            </ChartCard>
            <ChartCard title="De onde veio o dinheiro" description="Entradas por origem." empty={origin.length === 0} emptyText="Registre pagamentos, vendas ou entradas.">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}><PieChart>
                <Pie data={origin} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>{origin.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie>
                <Tooltip formatter={tooltipMoney} /><Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart></ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Entradas, gastos e resultado" empty={stats.raised === 0 && stats.expensesTotal === 0} emptyText="Aparece quando houver entradas ou gastos.">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}><BarChart data={moneyBars}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={tooltipMoney} /><Bar dataKey="Valor" radius={[3, 3, 0, 0]} barSize={32}>{moneyBars.map((item, index) => <Cell key={item.name} fill={index === 0 ? '#10b981' : index === 3 ? (result >= 0 ? '#2563eb' : '#ef4444') : '#f59e0b'} />)}</Bar>
              </BarChart></ResponsiveContainer>
            </ChartCard>
            {fee && <ChartCard title="Situação dos pagamentos" description="Inscrições ativas." empty={paymentPie.length === 0} emptyText="Aparece depois das primeiras inscrições.">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}><PieChart>
                <Pie data={paymentPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>{paymentPie.map(item => <Cell key={item.name} fill={{ Pago: '#10b981', Parcial: '#8b5cf6', Pendente: '#f59e0b', Isento: '#94a3b8' }[item.name]} />)}</Pie>
                <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart></ResponsiveContainer>
            </ChartCard>}
            {showSales && <ChartCard title="Vendas por vendedor" description="Recebido e a receber." empty={sellerChart.length === 0} emptyText="Aparece depois da primeira venda.">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}><BarChart data={sellerChart} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={70} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={tooltipMoney} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="Pago" stackId="a" fill="#10b981" /><Bar dataKey="Pendente" stackId="a" fill="#f59e0b" />
              </BarChart></ResponsiveContainer>
            </ChartCard>}
          </div>}
        </Tabs>
      </div>

      <EventRegistrationModal isOpen={showRegister} event={event} teams={teams} members={members} registrations={registrations} scopeTeamId={scope} initialTeamId={registerTeam} userId={me?.id} spotsLeft={status.spotsLeft} onClose={() => setShowRegister(false)} onSaved={reload} />
      <EventInviteModal isOpen={showInvite} event={event} events={list} teams={teams} members={members} scopeTeamId={scope} onClose={() => setShowInvite(false)} />
      <EventPaymentModal isOpen={!!payFor} registration={payFor} onClose={() => setPayFor(null)} onSaved={reload} />
      {canSellTickets(event) && showSale && <EventSaleModal isOpen event={event} teams={teams} members={members} scopeTeamId={scope} onClose={() => setShowSale(false)} onSaved={reload} />}
      {money_ && <EventMoneyModal isOpen event={event} kind={money_} userId={me?.id} onClose={() => setMoneyKind(null)} onSaved={reload} />}
      {staff && <EventQuickEditModal isOpen={showQuick} event={event} onClose={() => setShowQuick(false)} onSaved={reload} />}

      <ConfirmModal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)} onConfirm={runConfirmed} loading={working}
        variant={confirmAction?.kind === 'reopen-event' || confirmAction?.kind === 'close-event' ? 'primary' : 'danger'}
        title={{ 'cancel-event': 'Cancelar o evento?', 'reopen-event': 'Reabrir o evento?', 'close-event': 'Encerrar o evento?', 'delete-event': 'Excluir o evento?', 'cancel-reg': 'Cancelar a inscrição?', 'delete-reg': 'Excluir a inscrição?', 'delete-income': 'Excluir a entrada?', 'delete-expense': 'Excluir o gasto?', 'delete-sale': 'Excluir a venda?' }[confirmAction?.kind || 'cancel-event']}
        message={{ 'cancel-event': 'O evento deixa de aceitar inscrições e aparece como cancelado. As inscrições e os pagamentos já registrados são mantidos.', 'reopen-event': 'O evento volta a aceitar inscrições, pagamentos, entradas e gastos.',
          'close-event': 'O evento fica só para consulta: não aceita mais inscrição, pagamento, entrada nem gasto. Você pode reabrir depois.',
          'delete-event': 'O evento e a lista de itens serão excluídos. Só é possível se não houver inscrições, vendas, entradas nem gastos; caso contrário, use “Cancelar evento”.',
          'cancel-reg': `${confirmAction?.registration?.name} deixa de contar nas vagas. O valor já pago continua registrado.`, 'delete-reg': `A inscrição de ${confirmAction?.registration?.name} será apagada, com o valor pago. Esta ação não pode ser desfeita.`,
          'delete-income': `A entrada “${confirmAction?.income?.description}” de ${money(confirmAction?.income?.amount || 0)} será apagada.`, 'delete-expense': `O gasto “${confirmAction?.expense?.description}” de ${money(Number(confirmAction?.expense?.amount) || 0)} será apagado.`, 'delete-sale': `A venda para ${confirmAction?.sale?.buyerName} (${money(confirmAction?.sale?.amount || 0)}) será apagada. Use quando foi lançada por engano.` }[confirmAction?.kind || 'cancel-event']}
        confirmLabel={{ 'cancel-event': 'Cancelar evento', 'reopen-event': 'Reabrir', 'close-event': 'Encerrar evento', 'delete-event': 'Excluir evento', 'cancel-reg': 'Cancelar inscrição', 'delete-reg': 'Excluir inscrição', 'delete-income': 'Excluir entrada', 'delete-expense': 'Excluir gasto', 'delete-sale': 'Excluir venda' }[confirmAction?.kind || 'cancel-event']} />
    </PageWrapper>
  );
};

export default EventDetail;
