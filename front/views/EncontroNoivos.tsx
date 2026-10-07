import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Heart,
  Plus,
  Upload,
  CheckCircle2,
  Clock,
  Link as LinkIcon,
  Copy,
  PhoneCall,
  Calendar,
  ArrowLeft,
  MapPin,
  Wallet,
  Users,
  LayoutGrid,
} from 'lucide-react';
import { api } from '../api';
import { BridalCouple, BridalMeeting } from '../types';
import {
  PageWrapper,
  SectionTitle,
  StatGrid,
  StatCard,
  ContentCard,
  Button,
  Input,
  DatePicker,
  FilterLine,
  FilterLineSection,
  FilterLineItem,
  FilterLineSearch,
  FilterLineSegmented,
  GridTable,
  EmptyState,
  Badge,
  Modal,
  ModalFooter,
  ConfirmModal,
  usePagination,
} from '../components/ui';
import type { Column } from '../components/ui';
import { BridalCoupleForm, BridalCoupleFormData } from '../components/BridalCoupleForm';
import { usePermission } from '../src/hooks/usePermission';

const SEM_ENCONTRO = 'sem-encontro';

const blankMeetingForm = {
  name: '',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  pixKey: '',
};

const EncontroNoivos: React.FC = () => {
  const navigate = useNavigate();
  const canCreate = usePermission('encontro-noivos', 'create');
  const canDelete = usePermission('encontro-noivos', 'delete');

  const [viewMode, setViewMode] = useState<'encontros' | 'todos'>('encontros');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null); // string | SEM_ENCONTRO | null

  const [couples, setCouples] = useState<BridalCouple[]>([]);
  const [meetings, setMeetings] = useState<BridalMeeting[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [showCoupleModal, setShowCoupleModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BridalCouple | null>(null);

  // CRUD de Encontros
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [meetingForm, setMeetingForm] = useState(blankMeetingForm);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [deleteMeetingTarget, setDeleteMeetingTarget] = useState<BridalMeeting | null>(null);

  const loadCouples = () => {
    api.getBridalCouples().then(setCouples).catch(() => setCouples([]));
  };
  const loadMeetings = () => {
    api.getBridalMeetings().then(setMeetings).catch(() => setMeetings([]));
  };

  useEffect(() => {
    loadCouples();
    loadMeetings();
  }, []);

  const orphanCount = useMemo(() => couples.filter(c => !c.eventId).length, [couples]);

  const meetingLookup = useMemo(() => {
    const map = new Map<string, BridalMeeting>();
    meetings.forEach(m => map.set(m.id, m));
    return map;
  }, [meetings]);

  const scopedCouples = useMemo(() => {
    if (viewMode === 'todos') return couples;
    if (!selectedMeetingId) return [];
    if (selectedMeetingId === SEM_ENCONTRO) return couples.filter(c => !c.eventId);
    return couples.filter(c => c.eventId === selectedMeetingId);
  }, [couples, viewMode, selectedMeetingId]);

  const filtered = useMemo(() => {
    return scopedCouples.filter(c => {
      const name = `${c.noivoName || ''} ${c.noivaName || ''}`.toLowerCase();
      const matchesSearch = !search || name.includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'Todos' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [scopedCouples, search, statusFilter]);

  const { page, setPage, pageSize, setPageSize, paginatedData } = usePagination(filtered);

  const stats = useMemo(() => ({
    total: scopedCouples.length,
    confirmados: scopedCouples.filter(c => c.status === 'Confirmado').length,
    pendentesPagamento: scopedCouples.filter(c => c.paymentStatus === 'Pendente').length,
    externos: scopedCouples.filter(c => c.filledExternally).length,
  }), [scopedCouples]);

  const handleCreateCouple = async (data: BridalCoupleFormData) => {
    setSaving(true);
    try {
      const created = await api.createBridalCouple(data);
      setCouples(prev => [created, ...prev]);
      setShowCoupleModal(false);
      toast.success('Ficha criada com sucesso!');
      navigate(`/encontro-noivos/${created.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar ficha.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    toast.promise(
      api.deleteBridalCouple(deleteTarget.id).then(() => {
        setCouples(prev => prev.filter(c => c.id !== deleteTarget.id));
        setDeleteTarget(null);
      }),
      { loading: 'Excluindo ficha...', success: 'Ficha excluída!', error: 'Erro ao excluir ficha.' }
    );
  };

  const copyPublicLink = (token: string) => {
    const url = `${window.location.origin}/noivos/form/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const handleSendToNucleation = async (couple: BridalCouple) => {
    try {
      const full = await api.getBridalCouple(couple.id);
      const noivo = full.partners?.find((p: any) => p.role === 'noivo');
      const noiva = full.partners?.find((p: any) => p.role === 'noiva');
      await api.createNucleationContact({
        coupleId: couple.id,
        name: `${noivo?.name || ''} & ${noiva?.name || ''}`,
        phone1: noivo?.phone || '',
        phone2: noiva?.phone || '',
      });
      toast.success('Casal enviado para Nucleação!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar para Nucleação.');
    }
  };

  // ── CRUD de Encontro ─────────────────────────────────────────────────────
  const openNewMeeting = () => {
    setEditingMeetingId(null);
    setMeetingForm(blankMeetingForm);
    setShowMeetingModal(true);
  };

  const openEditMeeting = (meeting: BridalMeeting) => {
    setEditingMeetingId(meeting.id);
    setMeetingForm({
      name: meeting.name,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
      pixKey: meeting.pixKey,
    });
    setShowMeetingModal(true);
  };

  const handleSaveMeeting = async () => {
    if (!meetingForm.name.trim() || !meetingForm.date) {
      toast.error('Informe nome e data do encontro.');
      return;
    }
    setSavingMeeting(true);
    try {
      if (editingMeetingId) {
        const updated = await api.updateBridalMeeting(editingMeetingId, meetingForm);
        setMeetings(prev => prev.map(m => m.id === editingMeetingId ? { ...updated, couplesCount: m.couplesCount } : m));
        toast.success('Encontro atualizado!');
      } else {
        const created = await api.createBridalMeeting(meetingForm);
        setMeetings(prev => [created, ...prev]);
        toast.success('Encontro criado!');
      }
      setShowMeetingModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar encontro.');
    } finally {
      setSavingMeeting(false);
    }
  };

  const handleConfirmDeleteMeeting = () => {
    if (!deleteMeetingTarget) return;
    toast.promise(
      api.deleteBridalMeeting(deleteMeetingTarget.id).then(() => {
        setMeetings(prev => prev.filter(m => m.id !== deleteMeetingTarget.id));
        setDeleteMeetingTarget(null);
        loadCouples();
      }),
      { loading: 'Excluindo encontro...', success: 'Encontro excluído!', error: 'Erro ao excluir encontro.' }
    );
  };

  const columns: Column<BridalCouple>[] = [
    {
      header: 'Casal',
      render: (c) => (
        <div>
          <p className="font-black text-zinc-900 text-sm">{c.noivoName || '—'} & {c.noivaName || '—'}</p>
          <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest">
            {c.filledExternally ? 'Preenchido Externamente' : 'Cadastro Interno'}
          </p>
        </div>
      ),
    },
    ...(viewMode === 'todos' ? [{
      header: 'Encontro',
      render: (c: BridalCouple) => {
        const meeting = c.eventId ? meetingLookup.get(c.eventId) : null;
        return meeting
          ? <span className="text-xs font-semibold text-zinc-600">{meeting.name}</span>
          : <span className="text-xs font-semibold text-zinc-400 italic">Sem encontro</span>;
      },
    } as Column<BridalCouple>] : []),
    {
      header: 'Status',
      render: (c) => (
        <Badge color={
          c.status === 'Confirmado' ? 'success' :
          c.status === 'Cancelado' ? 'danger' :
          c.status === 'Aguardando Pagamento' ? 'warning' : 'default'
        }>
          {c.status}
        </Badge>
      ),
    },
    {
      header: 'Pagamento',
      render: (c) => (
        <Badge color={c.paymentStatus === 'Pago' ? 'success' : c.paymentStatus === 'Parcial' ? 'purple' : 'warning'}>
          {c.paymentStatus}
        </Badge>
      ),
    },
    {
      header: 'Ações',
      render: (c) => (
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          <Button variant="ghost" size="xs" iconLeft={<Copy className="w-3.5 h-3.5" />}
            onClick={(e) => { e.stopPropagation(); copyPublicLink(c.publicToken); }}>
            Link
          </Button>
          {canCreate && c.status === 'Confirmado' && (
            <Button variant="outline" size="xs" iconLeft={<PhoneCall className="w-3.5 h-3.5" />}
              onClick={(e) => { e.stopPropagation(); handleSendToNucleation(c); }}>
              Nucleação
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" size="xs" onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}>
              Excluir
            </Button>
          )}
        </div>
      ),
    },
  ];

  const selectedMeeting = selectedMeetingId && selectedMeetingId !== SEM_ENCONTRO ? meetingLookup.get(selectedMeetingId) : null;

  // ── Nível 1: grid de Encontros ───────────────────────────────────────────
  const renderMeetingsGrid = () => (
    <div className="space-y-4">
      <SectionTitle
        title="Encontro de Noivos"
        description="Selecione um encontro para ver os casais inscritos."
        icon={Heart}
        action={
          <Button variant="primary" size="md" iconLeft={<Plus className="w-4 h-4" />} onClick={openNewMeeting}>
            Novo Encontro
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {meetings.map(meeting => (
          <div key={meeting.id} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all space-y-3">
            <div onClick={() => setSelectedMeetingId(meeting.id)} className="cursor-pointer space-y-3">
              <div className="flex items-center justify-between">
                <Badge color={meeting.isActive ? 'success' : 'default'}>{meeting.isActive ? 'Ativo' : 'Inativo'}</Badge>
                <Badge color="info" icon={<Users className="w-3 h-3" />}>{meeting.couplesCount || 0} casais</Badge>
              </div>
              <h3 className="font-black text-zinc-900 text-sm">{meeting.name}</h3>
              <div className="space-y-1 text-xs text-zinc-500">
                <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {meeting.date}</p>
                {(meeting.startTime || meeting.endTime) && (
                  <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {meeting.startTime} às {meeting.endTime}</p>
                )}
                {meeting.location && (
                  <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {meeting.location}</p>
                )}
                {meeting.pixKey && (
                  <p className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> {meeting.pixKey}</p>
                )}
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="xs" onClick={(e) => { e.stopPropagation(); openEditMeeting(meeting); }}>Editar</Button>
              <Button variant="danger" size="xs" onClick={(e) => { e.stopPropagation(); setDeleteMeetingTarget(meeting); }}>Excluir</Button>
            </div>
          </div>
        ))}

        {/* Card fixo: Sem Encontro definido */}
        <div
          onClick={() => setSelectedMeetingId(SEM_ENCONTRO)}
          className="bg-zinc-50/70 p-5 rounded-2xl border-2 border-dashed border-zinc-300 shadow-sm cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all space-y-3 flex flex-col justify-center"
        >
          <div className="flex items-center justify-between">
            <Badge color="default">Sem Encontro</Badge>
            <Badge color="warning" icon={<Users className="w-3 h-3" />}>{orphanCount} casais</Badge>
          </div>
          <h3 className="font-black text-zinc-700 text-sm">Casais sem encontro definido</h3>
          <p className="text-xs text-zinc-400">Fichas que ainda não foram vinculadas a nenhuma turma.</p>
        </div>
      </div>

      {meetings.length === 0 && (
        <ContentCard padding="md">
          <EmptyState icon={Calendar} title="Nenhum encontro cadastrado" description="Crie o primeiro encontro para vincular os casais."
            action={<Button variant="primary" size="sm" onClick={openNewMeeting}>Novo Encontro</Button>} />
        </ContentCard>
      )}
    </div>
  );

  // ── Nível 2 / aba "Todos": tabela de casais ──────────────────────────────
  const renderCouplesTable = () => (
    <div className="space-y-4">
      {viewMode === 'encontros' && selectedMeetingId && (
        <button
          onClick={() => setSelectedMeetingId(null)}
          className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar aos Encontros
        </button>
      )}

      <SectionTitle
        title={
          viewMode === 'todos'
            ? 'Todos os Casais'
            : selectedMeetingId === SEM_ENCONTRO
              ? 'Casais sem Encontro definido'
              : selectedMeeting?.name || 'Encontro'
        }
        description={
          viewMode === 'todos'
            ? 'Todos os casais, de todos os encontros.'
            : selectedMeetingId === SEM_ENCONTRO
              ? 'Fichas ainda não vinculadas a uma turma.'
              : `${selectedMeeting?.date || ''} — Fichas de inscrição desta turma.`
        }
        icon={Heart}
        action={
          <div className="flex gap-2">
            {canCreate && (
              <>
                <Button variant="outline" size="md" iconLeft={<Upload className="w-4 h-4" />}>
                  Importar
                </Button>
                <Button variant="primary" size="md" iconLeft={<Plus className="w-4 h-4" />} onClick={() => setShowCoupleModal(true)}>
                  Novo Casal
                </Button>
              </>
            )}
          </div>
        }
      />

      <StatGrid cols={4}>
        <StatCard title="Total de Casais" value={stats.total} icon={Heart} color="info" delay={0} />
        <StatCard title="Confirmados" value={stats.confirmados} icon={CheckCircle2} color="success" delay={0.05} />
        <StatCard title="Pendentes Pagamento" value={stats.pendentesPagamento} icon={Clock} color="warning" delay={0.1} />
        <StatCard title="Preenchidos Externamente" value={stats.externos} icon={LinkIcon} color="purple" delay={0.15} />
      </StatGrid>

      <FilterLine>
        <FilterLineSection grow>
          <FilterLineItem grow>
            <FilterLineSearch value={search} onChange={setSearch} placeholder="Buscar por nome do casal..." />
          </FilterLineItem>
        </FilterLineSection>
        <FilterLineSection align="right">
          <FilterLineSegmented<string>
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'Todos', label: 'Todos' },
              { value: 'Confirmado', label: 'Confirmados' },
              { value: 'Aguardando Pagamento', label: 'Pendentes' },
            ]}
            size="sm"
          />
        </FilterLineSection>
      </FilterLine>

      <ContentCard padding="none">
        <GridTable
          columns={columns}
          data={paginatedData}
          keyExtractor={(c) => c.id}
          onRowClick={(c) => navigate(`/encontro-noivos/${c.id}`)}
          noDesktopCard
          emptyMessage={
            <EmptyState icon={Heart} title="Nenhuma ficha encontrada" description="Cadastre um novo casal."
              action={canCreate ? <Button variant="primary" size="sm" onClick={() => setShowCoupleModal(true)}>Novo Casal</Button> : undefined} />
          }
          pagination={{ total: filtered.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }}
        />
      </ContentCard>
    </div>
  );

  const showTable = viewMode === 'todos' || !!selectedMeetingId;

  return (
    <PageWrapper>
      <div className="space-y-4">
        <div className="flex bg-zinc-100/60 p-1 rounded-xl border border-zinc-200/60 max-w-fit">
          {[
            { id: 'encontros', label: 'Encontros', icon: Calendar },
            { id: 'todos', label: 'Todos os Casais', icon: LayoutGrid },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setViewMode(tab.id as any); setSelectedMeetingId(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                viewMode === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          ))}
        </div>

        {viewMode === 'encontros' && !selectedMeetingId ? renderMeetingsGrid() : renderCouplesTable()}
      </div>

      <Modal isOpen={showCoupleModal} onClose={() => setShowCoupleModal(false)} title="Nova Ficha de Casal" size="xl">
        <BridalCoupleForm
          mode="internal"
          defaultEventId={selectedMeetingId && selectedMeetingId !== SEM_ENCONTRO ? selectedMeetingId : null}
          onSave={handleCreateCouple}
          onCancel={() => setShowCoupleModal(false)}
          saving={saving}
        />
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Ficha"
        message={`Tem certeza que deseja excluir a ficha de ${deleteTarget?.noivoName} & ${deleteTarget?.noivaName}?`}
        confirmLabel="Sim, Excluir"
        variant="danger"
      />

      {/* Modal de Encontro (criar/editar) */}
      <Modal isOpen={showMeetingModal} onClose={() => setShowMeetingModal(false)} title={editingMeetingId ? 'Editar Encontro' : 'Novo Encontro'} size="md">
        <div className="space-y-4">
          <Input
            label="Nome"
            value={meetingForm.name}
            onChange={(e) => setMeetingForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Encontro de Noivos - Agosto 2026"
          />
          <DatePicker
            label="Data"
            value={meetingForm.date}
            onChange={(v) => setMeetingForm(prev => ({ ...prev, date: v || '' }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Horário de Início"
              value={meetingForm.startTime}
              onChange={(e) => setMeetingForm(prev => ({ ...prev, startTime: e.target.value }))}
              placeholder="07:30"
            />
            <Input
              label="Horário de Término"
              value={meetingForm.endTime}
              onChange={(e) => setMeetingForm(prev => ({ ...prev, endTime: e.target.value }))}
              placeholder="17:00"
            />
          </div>
          <Input
            label="Local"
            value={meetingForm.location}
            onChange={(e) => setMeetingForm(prev => ({ ...prev, location: e.target.value }))}
            placeholder="Nome do local"
          />
          <Input
            label="Chave Pix"
            value={meetingForm.pixKey}
            onChange={(e) => setMeetingForm(prev => ({ ...prev, pixKey: e.target.value }))}
            placeholder="Chave Pix para pagamento"
          />
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowMeetingModal(false)}>Cancelar</Button>
          <Button variant="primary" onClick={handleSaveMeeting} loading={savingMeeting}>
            {editingMeetingId ? 'Salvar Alterações' : 'Criar Encontro'}
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteMeetingTarget}
        onClose={() => setDeleteMeetingTarget(null)}
        onConfirm={handleConfirmDeleteMeeting}
        title="Excluir Encontro"
        message={`Tem certeza que deseja excluir "${deleteMeetingTarget?.name}"? Casais vinculados ficarão sem encontro definido.`}
        confirmLabel="Sim, Excluir"
        variant="danger"
      />
    </PageWrapper>
  );
};

export default EncontroNoivos;
