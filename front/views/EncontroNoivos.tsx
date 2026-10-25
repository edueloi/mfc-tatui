import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Heart, Plus, CheckCircle2, Clock, Link as LinkIcon, Copy, PhoneCall, Calendar, ArrowLeft, ArrowRight, MapPin, Wallet, Users, LayoutGrid, Pencil, Trash2, Loader2, Lock, LockOpen, Send } from 'lucide-react';
import { api } from '../api';
import { BridalCouple, BridalMeeting, Event } from '../types';
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard, Button, IconButton, FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch,
  FilterLineSegmented, GridTable, EmptyState, Badge, Modal, ConfirmModal, Tabs, Pagination, usePagination,
} from '../components/ui';
import type { Column } from '../components/ui';
import { BridalCoupleForm, BridalCoupleFormData } from '../components/BridalCoupleForm';
import { BridalMeetingModal } from '../components/BridalMeetingModal';
import { BridalMeetingInviteModal } from '../components/BridalMeetingInviteModal';
import { usePermission } from '../src/hooks/usePermission';
import { dateLabel } from '../utils/dates';
import { publicOrigin } from '../utils/siteUrls';
import { meetingStatus, CLOSE_AFTER_DAYS } from '../utils/meetingStatus';
import { normalizeDirectoryText } from '../utils/memberDirectory';
import { BRIDAL_BASE, SEM_ENCONTRO, couplePath, findMeeting, meetingPath } from '../utils/bridalPaths';
import { eventPath } from '../utils/events';

const tabs = [
  { id: 'encontros', label: 'Encontros', icon: Calendar },
  { id: 'todos', label: 'Todos os casais', icon: LayoutGrid },
] as const;

const statusColor = (status: BridalCouple['status']) => status === 'Confirmado' ? 'success' : status === 'Cancelado' ? 'danger' : status === 'Aguardando Pagamento' ? 'warning' : 'default';
const paymentColor = (status: BridalCouple['paymentStatus']) => status === 'Pago' ? 'success' : status === 'Parcial' ? 'purple' : status === 'Isento' ? 'info' : 'warning';
const coupleName = (couple: BridalCouple) => `${couple.noivoName || 'Noivo'} & ${couple.noivaName || 'Noiva'}`;

const EncontroNoivos: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { meetingSlug } = useParams<{ meetingSlug?: string }>();
  const canCreate = usePermission('encontro-noivos', 'create');
  const canDelete = usePermission('encontro-noivos', 'delete');

  const [couples, setCouples] = useState<BridalCouple[]>([]);
  const [meetings, setMeetings] = useState<BridalMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [showCoupleModal, setShowCoupleModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BridalCouple | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [nucleatingId, setNucleatingId] = useState<string | null>(null);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<BridalMeeting | null>(null);
  const [deleteMeetingTarget, setDeleteMeetingTarget] = useState<BridalMeeting | null>(null);
  const [deletingMeeting, setDeletingMeeting] = useState(false);
  const [meetingFilter, setMeetingFilter] = useState('open');
  const [closeTarget, setCloseTarget] = useState<BridalMeeting | null>(null);
  const [closing, setClosing] = useState(false);
  const [openingEvent, setOpeningEvent] = useState<string | null>(null);
  const [inviteMeeting, setInviteMeeting] = useState<BridalMeeting | null>(null);
  const [inviteEvent, setInviteEvent] = useState<Event | null>(null);

  const viewMode: 'encontros' | 'todos' = pathname.replace(/\/+$/, '') === `${BRIDAL_BASE}/casais` ? 'todos' : 'encontros';
  const orphanView = meetingSlug === SEM_ENCONTRO;
  const selectedMeeting = useMemo(() => orphanView ? null : findMeeting(meetings, meetingSlug), [meetings, meetingSlug, orphanView]);

  useEffect(() => {
    let cancelled = false;
    const load = () => Promise.all([api.getBridalCouples(), api.getBridalMeetings()])
      .then(([couplesData, meetingsData]) => { if (!cancelled) { setCouples(couplesData); setMeetings(meetingsData); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    load();
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.removeEventListener('focus', load); };
  }, [retry]);

  // Link por id (ou nome antigo) passa a mostrar o nome do encontro na URL.
  useEffect(() => {
    if (!selectedMeeting) return;
    const path = meetingPath(selectedMeeting, meetings);
    if (path !== `${BRIDAL_BASE}/encontro/${meetingSlug}`) navigate(path, { replace: true });
  }, [selectedMeeting, meetings, meetingSlug, navigate]);

  useEffect(() => { setSearch(''); setStatusFilter('Todos'); }, [meetingSlug, viewMode]);

  const orphanCount = useMemo(() => couples.filter(couple => !couple.eventId).length, [couples]);
  const meetingLookup = useMemo(() => new Map(meetings.map(meeting => [meeting.id, meeting])), [meetings]);

  const scopedCouples = useMemo(() => {
    if (viewMode === 'todos') return couples;
    if (orphanView) return couples.filter(couple => !couple.eventId);
    return selectedMeeting ? couples.filter(couple => couple.eventId === selectedMeeting.id) : [];
  }, [couples, viewMode, orphanView, selectedMeeting]);

  const query = normalizeDirectoryText(search);
  const filtered = useMemo(() => scopedCouples.filter(couple =>
    (!query || normalizeDirectoryText(`${couple.noivoName || ''} ${couple.noivaName || ''}`).includes(query)) && (statusFilter === 'Todos' || couple.status === statusFilter)
  ), [scopedCouples, query, statusFilter]);
  const { page, setPage, pageSize, setPageSize, paginatedData } = usePagination(filtered, 15);

  const stats = useMemo(() => ({
    total: scopedCouples.length,
    confirmados: scopedCouples.filter(couple => couple.status === 'Confirmado').length,
    pendentesPagamento: scopedCouples.filter(couple => couple.paymentStatus === 'Pendente').length,
    externos: scopedCouples.filter(couple => couple.filledExternally).length,
  }), [scopedCouples]);

  const handleCreateCouple = async (data: BridalCoupleFormData) => {
    setSaving(true);
    try {
      const created: BridalCouple = await api.createBridalCouple(data);
      const withNames = { ...created, noivoName: created.noivoName ?? data.noivo.name, noivaName: created.noivaName ?? data.noiva.name };
      setCouples(prev => [withNames, ...prev]);
      setShowCoupleModal(false);
      toast.success('Ficha criada.');
      navigate(couplePath(withNames, [withNames, ...couples]));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar a ficha.');
    } finally { setSaving(false); }
  };

  const handleDeleteCouple = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.deleteBridalCouple(deleteTarget.id);
      setCouples(prev => prev.filter(couple => couple.id !== deleteTarget.id));
      setMeetings(prev => prev.map(meeting => meeting.id === deleteTarget.eventId ? { ...meeting, couplesCount: Math.max(0, (meeting.couplesCount || 1) - 1) } : meeting));
      toast.success('Ficha excluída.');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir a ficha.');
    } finally { setDeleting(false); }
  };

  const handleDeleteMeeting = async () => {
    if (!deleteMeetingTarget || deletingMeeting) return;
    setDeletingMeeting(true);
    try {
      await api.deleteBridalMeeting(deleteMeetingTarget.id);
      setMeetings(prev => prev.filter(meeting => meeting.id !== deleteMeetingTarget.id));
      setCouples(prev => prev.map(couple => couple.eventId === deleteMeetingTarget.id ? { ...couple, eventId: null } : couple));
      toast.success('Encontro excluído.');
      setDeleteMeetingTarget(null);
      if (selectedMeeting?.id === deleteMeetingTarget.id) navigate(BRIDAL_BASE, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o encontro.');
    } finally { setDeletingMeeting(false); }
  };

  const copyPublicLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${publicOrigin()}/noivos/form/${token}`);
      toast.success('Link copiado.');
    } catch { toast.error('Não foi possível copiar. Copie o endereço manualmente.'); }
  };

  const handleSendToNucleation = async (couple: BridalCouple) => {
    if (nucleatingId) return;
    setNucleatingId(couple.id);
    try {
      const full = await api.getBridalCouple(couple.id);
      const noivo = full.partners?.find((partner: any) => partner.role === 'noivo');
      const noiva = full.partners?.find((partner: any) => partner.role === 'noiva');
      await api.createNucleationContact({ coupleId: couple.id, name: `${noivo?.name || ''} & ${noiva?.name || ''}`, phone1: noivo?.phone || '', phone2: noiva?.phone || '' });
      toast.success('Casal enviado para Nucleação.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar para Nucleação.');
    } finally { setNucleatingId(null); }
  };

  const setMeetingActive = async (meeting: BridalMeeting, isActive: boolean) => {
    if (closing) return;
    setClosing(true);
    try {
      const { name, date, startTime, endTime, location, pixKey } = meeting;
      const saved: BridalMeeting = await api.updateBridalMeeting(meeting.id, { name, date, startTime, endTime, location, pixKey, isActive });
      setMeetings(prev => prev.map(item => item.id === meeting.id ? { ...saved, couplesCount: item.couplesCount } : item));
      toast.success(isActive ? 'Encontro reaberto.' : 'Encontro encerrado.');
      setCloseTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível alterar o encontro.');
    } finally { setClosing(false); }
  };

  /** Abre o convite público em que o casal preenche a ficha completa deste encontro. */
  const openCoupleInvite = async (meeting: BridalMeeting) => {
    if (openingEvent) return;
    setOpeningEvent(meeting.id);
    try {
      const event: Event = await api.getEventByMeeting(meeting.id);
      setInviteEvent(event);
      setInviteMeeting(meeting);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível abrir o convite.');
    } finally { setOpeningEvent(null); }
  };

  /** Abre o evento ligado ao encontro (é criado na hora se ainda não existir) direto na aba Financeiro. */
  const openMeetingEvent = async (meeting: BridalMeeting, tab = 'financeiro') => {
    if (openingEvent) return;
    setOpeningEvent(meeting.id);
    try {
      const [event, all] = await Promise.all([api.getEventByMeeting(meeting.id), api.getEvents()]);
      navigate(`${eventPath(event, all)}?aba=${tab}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível abrir o evento do encontro.');
    } finally { setOpeningEvent(null); }
  };

  const openMeetingForm = (meeting: BridalMeeting | null) => { setEditingMeeting(meeting); setShowMeetingModal(true); };
  const handleMeetingSaved = (saved: BridalMeeting, mode: 'created' | 'updated') =>
    setMeetings(prev => mode === 'created' ? [saved, ...prev] : prev.map(meeting => meeting.id === saved.id ? { ...saved, couplesCount: meeting.couplesCount } : meeting));

  const columns: Column<BridalCouple>[] = [
    { header: 'Casal', render: couple => <div className="min-w-0"><p className="text-xs font-medium text-slate-800 break-words">{coupleName(couple)}</p><p className="mt-0.5 text-[11px] text-slate-500">{couple.filledExternally ? 'Preenchido pelo casal' : 'Cadastro interno'}</p></div> },
    ...(viewMode === 'todos' ? [{ header: 'Encontro', render: (couple: BridalCouple) => { const meeting = couple.eventId ? meetingLookup.get(couple.eventId) : null; return meeting ? <span className="text-xs text-slate-700 break-words">{meeting.name}</span> : <span className="text-xs text-slate-400">Sem encontro</span>; } } as Column<BridalCouple>] : []),
    { header: 'Status', render: couple => <Badge size="sm" dot color={statusColor(couple.status)}>{couple.status}</Badge> },
    { header: 'Pagamento', render: couple => <Badge size="sm" color={paymentColor(couple.paymentStatus)}>{couple.paymentStatus}</Badge> },
    { header: 'Ações', render: couple => <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
      <Button variant="ghost" size="xs" iconLeft={<Copy size={12} />} onClick={event => { event.stopPropagation(); copyPublicLink(couple.publicToken); }}>Link</Button>
      {canCreate && couple.status === 'Confirmado' && <Button variant="outline" size="xs" loading={nucleatingId === couple.id} disabled={!!nucleatingId} iconLeft={<PhoneCall size={12} />} onClick={event => { event.stopPropagation(); handleSendToNucleation(couple); }}>Nucleação</Button>}
      {canDelete && <IconButton variant="ghost" size="xs" aria-label={`Excluir ficha de ${coupleName(couple)}`} onClick={event => { event.stopPropagation(); setDeleteTarget(couple); }}><Trash2 size={14} className="text-red-500" /></IconButton>}
    </div> },
  ];

  const renderCoupleCard = (couple: BridalCouple) => {
    const meeting = couple.eventId ? meetingLookup.get(couple.eventId) : null;
    return <article key={couple.id} onClick={() => navigate(couplePath(couple, couples))}
      className="flex min-w-0 cursor-pointer flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-blue-300 active:bg-slate-50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">{coupleName(couple)}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
            <span>{couple.filledExternally ? 'Preenchido pelo casal' : 'Cadastro interno'}</span>
            {viewMode === 'todos' && <span className="inline-flex items-center gap-1 text-blue-700"><Calendar size={10} />{meeting ? meeting.name : 'Sem encontro'}</span>}
          </p>
        </div>
        <Badge size="sm" dot color={statusColor(couple.status)} className="shrink-0">{couple.status}</Badge>
      </div>
      <div><Badge size="sm" color={paymentColor(couple.paymentStatus)}>Pagamento: {couple.paymentStatus}</Badge></div>
      <div className="mt-auto space-y-2 border-t border-slate-100 pt-3">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" iconRight={<ArrowRight size={12} />} onClick={event => { event.stopPropagation(); navigate(couplePath(couple, couples)); }}>Abrir</Button>
          {canCreate && couple.status === 'Confirmado' && <Button variant="outline" size="sm" loading={nucleatingId === couple.id} disabled={!!nucleatingId} iconLeft={<PhoneCall size={13} />} onClick={event => { event.stopPropagation(); handleSendToNucleation(couple); }}>Nucleação</Button>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="xs" iconLeft={<Copy size={13} />} onClick={event => { event.stopPropagation(); copyPublicLink(couple.publicToken); }}>Copiar link</Button>
          {canDelete && <Button variant="ghost" size="xs" className="text-red-600 hover:bg-red-50" iconLeft={<Trash2 size={13} />} aria-label={`Excluir ficha de ${coupleName(couple)}`} onClick={event => { event.stopPropagation(); setDeleteTarget(couple); }}>Excluir</Button>}
        </div>
      </div>
    </article>;
  };

  if (loading) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando encontros…</div></PageWrapper>;

  if (error && !couples.length && !meetings.length) return <PageWrapper><ContentCard><EmptyState icon={Heart} title="Não foi possível carregar o Encontro de Noivos" description="Confira a conexão e tente novamente."
    action={<Button onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Tentar novamente</Button>} /></ContentCard></PageWrapper>;

  if (meetingSlug && !orphanView && !selectedMeeting) return <PageWrapper><ContentCard><EmptyState icon={Calendar} title="Encontro não encontrado" description="O encontro pode ter sido removido ou o endereço está incorreto."
    action={<Button variant="outline" onClick={() => navigate(BRIDAL_BASE)}>Voltar para Encontros</Button>} /></ContentCard></PageWrapper>;

  const inMeeting = viewMode === 'encontros' && (orphanView || !!selectedMeeting);
  const hasFilter = !!query || statusFilter !== 'Todos';

  const statusOf = new Map(meetings.map(meeting => [meeting.id, meetingStatus(meeting)]));
  const openMeetings = meetings.filter(meeting => !statusOf.get(meeting.id)!.closed);
  const closedMeetings = meetings.filter(meeting => statusOf.get(meeting.id)!.closed);
  const shownMeetings = meetingFilter === 'closed' ? closedMeetings : meetingFilter === 'all' ? meetings : openMeetings;

  const meetingsGrid = (
    <div className="space-y-3">
      <FilterLine>
        <FilterLineSection grow>
          <FilterLineSegmented className="[&>button]:whitespace-nowrap [&>button]:px-1.5 [&>button]:text-[11.5px] sm:[&>button]:px-2.5 sm:[&>button]:text-xs" value={meetingFilter} onChange={value => setMeetingFilter(String(value))} options={[{ value: 'open', label: `Em aberto (${openMeetings.length})` }, { value: 'closed', label: `Encerrados (${closedMeetings.length})` }, { value: 'all', label: 'Todos' }]} />
        </FilterLineSection>
      </FilterLine>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shownMeetings.map(meeting => { const status = statusOf.get(meeting.id)!; return (
          <ContentCard key={meeting.id} padding="none" className="group flex h-full flex-col overflow-hidden transition-all hover:border-blue-200">
            <div className="flex flex-1 flex-col gap-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <span title={status.closesOn && !status.closed ? `Fecha sozinho em ${dateLabel(status.closesOn.toISOString())}` : status.reason === 'auto' ? `Encerrado automaticamente ${CLOSE_AFTER_DAYS} dias depois da data` : undefined}><Badge size="sm" dot color={status.closed ? 'default' : status.daysLeft !== null ? 'warning' : 'success'}>{status.closed ? 'Encerrado' : status.daysLeft !== null ? `Já aconteceu · fecha em ${status.daysLeft} ${status.daysLeft === 1 ? 'dia' : 'dias'}` : 'Em andamento'}</Badge></span>
                <Badge size="sm" color="info" icon={<Users size={10} />}>{meeting.couplesCount || 0} {meeting.couplesCount === 1 ? 'casal' : 'casais'}</Badge>
              </div>
              <button type="button" className="text-left focus-visible:outline-blue-500" onClick={() => navigate(meetingPath(meeting, meetings))}>
                <h3 className="text-sm font-semibold leading-tight text-slate-900 break-words transition-colors group-hover:text-blue-600">{meeting.name}</h3>
                <ul className="mt-2 space-y-1 text-xs text-slate-500">
                  <li className="flex items-center gap-1.5"><Calendar size={12} className="shrink-0 text-slate-400" />{dateLabel(meeting.date) || 'Data não informada'}</li>
                  {(meeting.startTime || meeting.endTime) && <li className="flex items-center gap-1.5"><Clock size={12} className="shrink-0 text-slate-400" />{[meeting.startTime, meeting.endTime].filter(Boolean).join(' às ')}</li>}
                  {meeting.location && <li className="flex items-center gap-1.5 break-words"><MapPin size={12} className="shrink-0 text-slate-400" />{meeting.location}</li>}
                  {meeting.pixKey && <li className="flex items-center gap-1.5 break-all"><Wallet size={12} className="shrink-0 text-slate-400" />{meeting.pixKey}</li>}
                </ul>
              </button>
            </div>
            <div className="space-y-2 border-t border-slate-100 bg-slate-50/50 p-3">
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" iconRight={<ArrowRight size={12} />} onClick={() => navigate(meetingPath(meeting, meetings))}>Abrir encontro</Button>
                {!status.closed && <Button variant="outline" size="sm" iconLeft={<Send size={12} />} disabled={!!openingEvent} onClick={() => openCoupleInvite(meeting)}>Convidar</Button>}
              </div>
              <div className="flex items-center justify-between gap-1">
                <Button variant="ghost" size="xs" className="px-1.5" iconLeft={<Wallet size={13} />} disabled={!!openingEvent} title="Evento, gastos e entradas" onClick={() => openMeetingEvent(meeting)}>Finanças</Button>
                {canCreate && (status.closed
                  ? status.reason === 'manual' && <Button variant="ghost" size="xs" className="px-1.5" iconLeft={<LockOpen size={13} />} onClick={() => setMeetingActive(meeting, true)}>Reabrir</Button>
                  : <Button variant="ghost" size="xs" className="px-1.5" iconLeft={<Lock size={13} />} onClick={() => setCloseTarget(meeting)}>Encerrar</Button>)}
                {canCreate && <Button variant="ghost" size="xs" className="px-1.5" iconLeft={<Pencil size={13} />} onClick={() => openMeetingForm(meeting)}>Editar</Button>}
                {canDelete && <Button variant="ghost" size="xs" className="px-1.5 text-red-600 hover:bg-red-50" iconLeft={<Trash2 size={13} />} onClick={() => setDeleteMeetingTarget(meeting)}>Excluir</Button>}
              </div>
            </div>
          </ContentCard>
        ); })}
        {shownMeetings.length === 0 && meetings.length > 0 && <div className="md:col-span-2 xl:col-span-3"><ContentCard><EmptyState icon={Calendar} title={meetingFilter === 'closed' ? 'Nenhum encontro encerrado' : 'Nenhum encontro em andamento'} description={meetingFilter === 'closed' ? `Os encontros fecham sozinhos ${CLOSE_AFTER_DAYS} dias depois da data.` : 'Veja os encerrados ou crie um novo encontro.'} /></ContentCard></div>}
        <button type="button" onClick={() => navigate(`${BRIDAL_BASE}/encontro/${SEM_ENCONTRO}`)}
          className="flex min-h-[9rem] flex-col justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-blue-500">
          <div className="flex items-center justify-between gap-2"><Badge size="sm">Sem encontro</Badge><Badge size="sm" color="warning" icon={<Users size={10} />}>{orphanCount} {orphanCount === 1 ? 'casal' : 'casais'}</Badge></div>
          <h3 className="text-sm font-semibold text-slate-800">Casais sem encontro definido</h3>
          <p className="text-xs text-slate-500">Fichas que ainda não foram vinculadas a nenhuma turma.</p>
        </button>
      </div>
      {meetings.length === 0 && <ContentCard><EmptyState icon={Calendar} title="Nenhum encontro cadastrado" description="Crie o primeiro encontro para vincular os casais."
        action={canCreate ? <Button size="sm" onClick={() => openMeetingForm(null)}>Novo encontro</Button> : undefined} /></ContentCard>}
    </div>
  );

  const couplesTable = (
    <div className="space-y-3">
      {/* Celular: resumo em uma linha só */}
      <div className="grid grid-cols-4 gap-2 sm:hidden" aria-label="Resumo dos casais">
        {([['Casais', stats.total, 'text-blue-700'], ['Confirmados', stats.confirmados, 'text-emerald-600'], ['Pgto pendente', stats.pendentesPagamento, 'text-amber-600'], ['Pelo casal', stats.externos, 'text-purple-600']] as const).map(([label, value, color]) =>
          <div key={label} className="rounded-xl border border-slate-200 bg-white px-1.5 py-2.5 text-center"><p className={`text-lg font-semibold leading-none ${color}`}>{value}</p><p className="mt-1.5 text-[10px] leading-tight text-slate-500">{label}</p></div>)}
      </div>
      <div className="hidden sm:block">
      <StatGrid cols={4}>
        <StatCard title="Total de casais" value={stats.total} icon={Heart} color="info" />
        <StatCard title="Confirmados" value={stats.confirmados} icon={CheckCircle2} color="success" />
        <StatCard title="Pagamento pendente" value={stats.pendentesPagamento} icon={Clock} color="warning" />
        <StatCard title="Preenchidos pelo casal" value={stats.externos} icon={LinkIcon} color="purple" />
      </StatGrid>
      </div>
      <FilterLine>
        <FilterLineSection grow>
          <FilterLineItem grow><FilterLineSearch aria-label="Buscar casal" value={search} onChange={setSearch} placeholder="Nome do noivo ou da noiva…" /></FilterLineItem>
          <FilterLineItem><FilterLineSegmented<string> className="[&>button]:whitespace-nowrap [&>button]:px-1.5 [&>button]:text-[11.5px] sm:[&>button]:px-2.5 sm:[&>button]:text-xs" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'Todos', label: 'Todos' }, { value: 'Confirmado', label: 'Confirmados' }, { value: 'Aguardando Pagamento', label: 'Pendentes' }]} /></FilterLineItem>
        </FilterLineSection>
        <FilterLineSection align="right">
          <span className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'casal' : 'casais'}</span>
          {hasFilter && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter('Todos'); }}>Limpar filtros</Button>}
        </FilterLineSection>
      </FilterLine>
      {/* Celular e tablet: cartões (1 coluna no celular, 2 no tablet). Tabela só em telas largas. */}
      <div className="xl:hidden">
        {paginatedData.length
          ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{paginatedData.map(renderCoupleCard)}</div>
          : <ContentCard><EmptyState icon={Heart} title="Nenhum casal encontrado" description={hasFilter ? 'Ajuste a busca ou o filtro.' : 'Cadastre o primeiro casal.'}
            action={!hasFilter && canCreate ? <Button size="sm" onClick={() => setShowCoupleModal(true)}>Novo casal</Button> : undefined} /></ContentCard>}
        {filtered.length > 0 && <div className="mt-3"><Pagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} /></div>}
      </div>
      <div className="hidden xl:block">
      <ContentCard padding="none">
        <GridTable columns={columns} data={paginatedData} keyExtractor={couple => couple.id} noDesktopCard disableMobileCards onRowClick={couple => navigate(couplePath(couple, couples))}
          emptyMessage={<EmptyState icon={Heart} title="Nenhum casal encontrado" description={hasFilter ? 'Ajuste a busca ou o filtro.' : 'Cadastre o primeiro casal.'}
            action={!hasFilter && canCreate ? <Button size="sm" onClick={() => setShowCoupleModal(true)}>Novo casal</Button> : undefined} />}
          pagination={{ total: filtered.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }} />
      </ContentCard>
      </div>
    </div>
  );

  return (
    <PageWrapper>
      <div className="space-y-4">
        {inMeeting ? <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={() => navigate(BRIDAL_BASE)}>Voltar para Encontros</Button>
            {selectedMeeting && canCreate && <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              {!meetingStatus(selectedMeeting).closed && <Button variant="outline" size="sm" iconLeft={<Send size={14} />} loading={openingEvent === selectedMeeting.id} onClick={() => openCoupleInvite(selectedMeeting)}>Convidar casal</Button>}
              <Button variant="outline" size="sm" iconLeft={<Wallet size={14} />} loading={openingEvent === selectedMeeting.id} onClick={() => openMeetingEvent(selectedMeeting)}>Evento e finanças</Button>
              {!meetingStatus(selectedMeeting).closed && <Button variant="outline" size="sm" iconLeft={<Lock size={14} />} onClick={() => setCloseTarget(selectedMeeting)}>Encerrar encontro</Button>}
              {meetingStatus(selectedMeeting).reason === 'manual' && <Button variant="outline" size="sm" iconLeft={<LockOpen size={14} />} loading={closing} onClick={() => setMeetingActive(selectedMeeting, true)}>Reabrir encontro</Button>}
              <Button variant="outline" size="sm" iconLeft={<Pencil size={14} />} onClick={() => openMeetingForm(selectedMeeting)}>Editar encontro</Button>
            </div>}
          </div>
          <SectionTitle icon={Heart}
            title={orphanView ? 'Casais sem encontro definido' : selectedMeeting!.name}
            description={orphanView ? 'Fichas ainda não vinculadas a uma turma.' : [dateLabel(selectedMeeting!.date), [selectedMeeting!.startTime, selectedMeeting!.endTime].filter(Boolean).join(' às '), selectedMeeting!.location].filter(Boolean).join(' · ')}
            action={canCreate ? <Button size="sm" className="w-full sm:w-auto" iconLeft={<Plus size={14} />} disabled={!!selectedMeeting && meetingStatus(selectedMeeting).closed} title={selectedMeeting && meetingStatus(selectedMeeting).closed ? 'Encontro encerrado: reabra para vincular novos casais' : undefined} onClick={() => setShowCoupleModal(true)}>Novo casal</Button> : undefined} />
          {selectedMeeting && meetingStatus(selectedMeeting).closed && <ContentCard padding="md" className="bg-slate-50"><p className="flex items-center gap-2 text-xs text-slate-600"><Lock size={14} className="shrink-0" />Encontro encerrado{meetingStatus(selectedMeeting).reason === 'auto' ? ` automaticamente (${CLOSE_AFTER_DAYS} dias depois da data)` : ''}. As fichas continuam disponíveis para consulta.</p></ContentCard>}
          {couplesTable}
        </> : <>
          <SectionTitle icon={Heart} title="Encontro de Noivos" description={viewMode === 'todos' ? 'Todos os casais, de todos os encontros.' : 'Escolha um encontro para ver os casais inscritos.'}
            action={canCreate ? (viewMode === 'todos'
              ? <Button size="sm" className="w-full sm:w-auto" iconLeft={<Plus size={14} />} onClick={() => setShowCoupleModal(true)}>Novo casal</Button>
              : <Button size="sm" className="w-full sm:w-auto" iconLeft={<Plus size={14} />} onClick={() => openMeetingForm(null)}>Novo encontro</Button>) : undefined} />
          <Tabs<typeof tabs[number]['id']> items={tabs} value={viewMode} onChange={id => navigate(id === 'todos' ? `${BRIDAL_BASE}/casais` : BRIDAL_BASE)} label="Visualização do Encontro de Noivos">
            {viewMode === 'encontros' ? meetingsGrid : couplesTable}
          </Tabs>
        </>}
      </div>

      <Modal isOpen={showCoupleModal} onClose={() => !saving && setShowCoupleModal(false)} title="Nova ficha de casal" size="xl">
        <BridalCoupleForm mode="internal" defaultEventId={selectedMeeting?.id ?? null} onSave={handleCreateCouple} onCancel={() => setShowCoupleModal(false)} saving={saving} />
      </Modal>

      <BridalMeetingModal isOpen={showMeetingModal} meeting={editingMeeting} onClose={() => setShowMeetingModal(false)} onSaved={handleMeetingSaved} />
      <BridalMeetingInviteModal isOpen={!!inviteMeeting} meeting={inviteMeeting} event={inviteEvent} onClose={() => { setInviteMeeting(null); setInviteEvent(null); }} />

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteCouple} loading={deleting}
        title="Excluir ficha?" message={`A ficha de ${deleteTarget ? coupleName(deleteTarget) : ''} será excluída com os documentos anexados. Esta ação não pode ser desfeita.`} confirmLabel="Excluir ficha" variant="danger" />
      <ConfirmModal isOpen={!!closeTarget} onClose={() => setCloseTarget(null)} onConfirm={() => closeTarget && setMeetingActive(closeTarget, false)} loading={closing}
        title="Encerrar encontro?" message={`"${closeTarget?.name}" será encerrado: não aparece mais em andamento nem nas opções ao criar fichas. Os casais e documentos continuam salvos, e você pode reabrir depois.`} confirmLabel="Encerrar encontro" variant="primary" />
      <ConfirmModal isOpen={!!deleteMeetingTarget} onClose={() => setDeleteMeetingTarget(null)} onConfirm={handleDeleteMeeting} loading={deletingMeeting}
        title="Excluir encontro?" message={`"${deleteMeetingTarget?.name}" será excluído. Os casais vinculados ficam sem encontro definido.`} confirmLabel="Excluir encontro" variant="danger" />
    </PageWrapper>
  );
};

export default EncontroNoivos;
