import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Heart, Plus, CheckCircle2, Clock, Link as LinkIcon, Copy, PhoneCall, Calendar, ArrowLeft, ArrowRight, MapPin, Wallet, Users, LayoutGrid, Pencil, Trash2, Loader2, Lock, LockOpen } from 'lucide-react';
import { api } from '../api';
import { BridalCouple, BridalMeeting } from '../types';
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard, Button, IconButton, FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch,
  FilterLineSegmented, GridTable, EmptyState, Badge, Modal, ConfirmModal, Tabs, usePagination,
} from '../components/ui';
import type { Column } from '../components/ui';
import { BridalCoupleForm, BridalCoupleFormData } from '../components/BridalCoupleForm';
import { BridalMeetingModal } from '../components/BridalMeetingModal';
import { usePermission } from '../src/hooks/usePermission';
import { dateLabel } from '../utils/dates';
import { meetingStatus, CLOSE_AFTER_DAYS } from '../utils/meetingStatus';
import { normalizeDirectoryText } from '../utils/memberDirectory';
import { BRIDAL_BASE, SEM_ENCONTRO, couplePath, findMeeting, meetingPath } from '../utils/bridalPaths';

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
      await navigator.clipboard.writeText(`${window.location.origin}/noivos/form/${token}`);
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
          <FilterLineSegmented value={meetingFilter} onChange={value => setMeetingFilter(String(value))} options={[{ value: 'open', label: `Em andamento (${openMeetings.length})` }, { value: 'closed', label: `Encerrados (${closedMeetings.length})` }, { value: 'all', label: 'Todos' }]} />
        </FilterLineSection>
        <FilterLineSection align="right">{canCreate && <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => openMeetingForm(null)}>Novo encontro</Button>}</FilterLineSection>
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
            <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/50 p-3">
              <Button size="xs" className="flex-1" iconRight={<ArrowRight size={12} />} onClick={() => navigate(meetingPath(meeting, meetings))}>Abrir encontro</Button>
              {canCreate && (status.closed
                ? status.reason === 'manual' && <IconButton variant="ghost" size="xs" aria-label={`Reabrir ${meeting.name}`} title="Reabrir encontro" className="h-8 w-8" onClick={() => setMeetingActive(meeting, true)}><LockOpen size={14} /></IconButton>
                : <IconButton variant="ghost" size="xs" aria-label={`Encerrar ${meeting.name}`} title="Encerrar encontro" className="h-8 w-8" onClick={() => setCloseTarget(meeting)}><Lock size={14} /></IconButton>)}
              {canCreate && <IconButton variant="ghost" size="xs" aria-label={`Editar ${meeting.name}`} className="h-8 w-8" onClick={() => openMeetingForm(meeting)}><Pencil size={14} /></IconButton>}
              {canDelete && <IconButton variant="ghost" size="xs" aria-label={`Excluir ${meeting.name}`} className="h-8 w-8" onClick={() => setDeleteMeetingTarget(meeting)}><Trash2 size={14} className="text-red-500" /></IconButton>}
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
      <StatGrid cols={4}>
        <StatCard title="Total de casais" value={stats.total} icon={Heart} color="info" />
        <StatCard title="Confirmados" value={stats.confirmados} icon={CheckCircle2} color="success" />
        <StatCard title="Pagamento pendente" value={stats.pendentesPagamento} icon={Clock} color="warning" />
        <StatCard title="Preenchidos pelo casal" value={stats.externos} icon={LinkIcon} color="purple" />
      </StatGrid>
      <FilterLine>
        <FilterLineSection grow>
          <FilterLineItem grow><FilterLineSearch aria-label="Buscar casal" value={search} onChange={setSearch} placeholder="Nome do noivo ou da noiva…" /></FilterLineItem>
          <FilterLineItem><FilterLineSegmented<string> value={statusFilter} onChange={setStatusFilter} options={[{ value: 'Todos', label: 'Todos' }, { value: 'Confirmado', label: 'Confirmados' }, { value: 'Aguardando Pagamento', label: 'Pendentes' }]} /></FilterLineItem>
        </FilterLineSection>
        <FilterLineSection align="right">
          <span className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'casal' : 'casais'}</span>
          {hasFilter && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter('Todos'); }}>Limpar filtros</Button>}
        </FilterLineSection>
      </FilterLine>
      <ContentCard padding="none">
        <GridTable columns={columns} data={paginatedData} keyExtractor={couple => couple.id} noDesktopCard onRowClick={couple => navigate(couplePath(couple, couples))}
          emptyMessage={<EmptyState icon={Heart} title="Nenhum casal encontrado" description={hasFilter ? 'Ajuste a busca ou o filtro.' : 'Cadastre o primeiro casal.'}
            action={!hasFilter && canCreate ? <Button size="sm" onClick={() => setShowCoupleModal(true)}>Novo casal</Button> : undefined} />}
          pagination={{ total: filtered.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }} />
      </ContentCard>
    </div>
  );

  return (
    <PageWrapper>
      <div className="space-y-4">
        {inMeeting ? <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={() => navigate(BRIDAL_BASE)}>Voltar para Encontros</Button>
            {selectedMeeting && canCreate && <div className="flex flex-wrap gap-2">
              {!meetingStatus(selectedMeeting).closed && <Button variant="outline" size="sm" iconLeft={<Lock size={14} />} onClick={() => setCloseTarget(selectedMeeting)}>Encerrar encontro</Button>}
              {meetingStatus(selectedMeeting).reason === 'manual' && <Button variant="outline" size="sm" iconLeft={<LockOpen size={14} />} loading={closing} onClick={() => setMeetingActive(selectedMeeting, true)}>Reabrir encontro</Button>}
              <Button variant="outline" size="sm" iconLeft={<Pencil size={14} />} onClick={() => openMeetingForm(selectedMeeting)}>Editar encontro</Button>
            </div>}
          </div>
          <SectionTitle icon={Heart}
            title={orphanView ? 'Casais sem encontro definido' : selectedMeeting!.name}
            description={orphanView ? 'Fichas ainda não vinculadas a uma turma.' : [dateLabel(selectedMeeting!.date), [selectedMeeting!.startTime, selectedMeeting!.endTime].filter(Boolean).join(' às '), selectedMeeting!.location].filter(Boolean).join(' · ')}
            action={canCreate ? <Button size="sm" iconLeft={<Plus size={14} />} disabled={!!selectedMeeting && meetingStatus(selectedMeeting).closed} title={selectedMeeting && meetingStatus(selectedMeeting).closed ? 'Encontro encerrado: reabra para vincular novos casais' : undefined} onClick={() => setShowCoupleModal(true)}>Novo casal</Button> : undefined} />
          {selectedMeeting && meetingStatus(selectedMeeting).closed && <ContentCard padding="md" className="bg-slate-50"><p className="flex items-center gap-2 text-xs text-slate-600"><Lock size={14} className="shrink-0" />Encontro encerrado{meetingStatus(selectedMeeting).reason === 'auto' ? ` automaticamente (${CLOSE_AFTER_DAYS} dias depois da data)` : ''}. As fichas continuam disponíveis para consulta.</p></ContentCard>}
          {couplesTable}
        </> : <>
          <SectionTitle icon={Heart} title="Encontro de Noivos" description={viewMode === 'todos' ? 'Todos os casais, de todos os encontros.' : 'Escolha um encontro para ver os casais inscritos.'}
            action={viewMode === 'todos' && canCreate ? <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => setShowCoupleModal(true)}>Novo casal</Button> : undefined} />
          <Tabs<typeof tabs[number]['id']> items={tabs} value={viewMode} onChange={id => navigate(id === 'todos' ? `${BRIDAL_BASE}/casais` : BRIDAL_BASE)} label="Visualização do Encontro de Noivos">
            {viewMode === 'encontros' ? meetingsGrid : couplesTable}
          </Tabs>
        </>}
      </div>

      <Modal isOpen={showCoupleModal} onClose={() => !saving && setShowCoupleModal(false)} title="Nova ficha de casal" size="xl">
        <BridalCoupleForm mode="internal" defaultEventId={selectedMeeting?.id ?? null} onSave={handleCreateCouple} onCancel={() => setShowCoupleModal(false)} saving={saving} />
      </Modal>

      <BridalMeetingModal isOpen={showMeetingModal} meeting={editingMeeting} onClose={() => setShowMeetingModal(false)} onSaved={handleMeetingSaved} />

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
