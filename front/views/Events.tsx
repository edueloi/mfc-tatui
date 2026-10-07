import React, { useState, useMemo, useEffect } from 'react';
import {
  Ticket,
  Plus,
  Target,
  TrendingUp,
  Users,
  Calendar,
  Edit3,
  Trash2,
  ShoppingCart,
  Receipt,
  MapPin,
  User,
  DollarSign,
} from 'lucide-react';
import { api } from '../api';
import { Event, EventExpense, BaseTeam, EventSale, Member } from '../types';
import {
  PageWrapper,
  SectionTitle,
  StatGrid,
  StatCard,
  ContentCard,
  FilterLine,
  FilterLineSection,
  FilterLineSearch,
  FilterLineItem,
  Button,
  Input,
  Select,
  Switch,
  Modal,
  ModalFooter,
  ConfirmModal,
  EmptyState,
  Divider,
} from '../components/ui';

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => `R$ ${n.toFixed(2)}`;

const isSalePaid = (status: string) => String(status || '').toLowerCase() === 'pago';

// ── componente principal ──────────────────────────────────────────────────────

const EventsView: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [eventSales, setEventSales] = useState<EventSale[]>([]);

  // modal evento
  const [showModal, setShowModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'expenses' | 'goals'>('basic');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // modal venda
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [selectedEventForSale, setSelectedEventForSale] = useState<Event | null>(null);

  // filtros
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState('all');
  const [eventSortBy, setEventSortBy] = useState('date');

  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    description: '',
    responsible: '',
    goalValue: 0,
    showOnDashboard: true,
    ticketQuantity: 0,
    ticketValue: 0,
    expenses: [] as EventExpense[],
    teamQuotas: [] as { teamId: string; quotaValue: number }[],
  });

  const [saleForm, setSaleForm] = useState({
    teamId: '',
    memberId: '',
    buyerName: '',
    quantity: 1,
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    status: 'Pago' as 'Pago' | 'Pendente',
  });

  const [newExpense, setNewExpense] = useState({ description: '', amount: 0 });

  // ── data ──────────────────────────────────────────────────────────────────

  const loadData = () => {
    api.getEvents().then(setEvents).catch(() => setEvents([]));
    api.getTeams().then(setTeams).catch(() => setTeams([]));
    api.getMembers().then(setMembers).catch(() => setMembers([]));
    api.getEventSales().then(setEventSales).catch(() => setEventSales([]));
  };

  useEffect(() => {
    loadData();
    window.addEventListener('focus', loadData);
    const iv = setInterval(loadData, 30000);
    return () => { window.removeEventListener('focus', loadData); clearInterval(iv); };
  }, []);

  useEffect(() => {
    if (teams.length > 0 && formData.teamQuotas.length === 0) {
      setFormData(prev => ({
        ...prev,
        teamQuotas: teams.map(t => ({ teamId: t.id, quotaValue: 0 })),
      }));
    }
  }, [teams]);

  // ── computed ──────────────────────────────────────────────────────────────

  const teamMembersForSale = useMemo(() => {
    if (!saleForm.teamId) return [];
    return members.filter(m => m.teamId === saleForm.teamId);
  }, [members, saleForm.teamId]);

  useEffect(() => {
    if (teamMembersForSale.length > 0 && !teamMembersForSale.some(m => m.id === saleForm.memberId)) {
      setSaleForm(prev => ({ ...prev, memberId: teamMembersForSale[0].id }));
    }
  }, [teamMembersForSale]);

  const totalExpenses = formData.expenses.reduce((acc, exp) => acc + exp.amount, 0);
  const potentialRevenue = (formData.ticketQuantity || 0) * (formData.ticketValue || 0);

  const getEventStats = (event: Event) => {
    const sales = eventSales.filter(s => s.eventId === event.id);
    const paidSales = sales.filter(s => isSalePaid(s.status));
    const raised = paidSales.reduce((acc, s) => acc + s.amount, 0);
    const progress = event.goalValue > 0 ? (raised / event.goalValue) * 100 : 0;
    const netProfit = raised - event.costValue;
    const ticketsSold = paidSales.length;
    const totalTickets = Number(event.ticketQuantity) || 0;
    const ticketsRemaining = totalTickets > 0 ? Math.max(totalTickets - ticketsSold, 0) : null;
    return { raised, progress, netProfit, ticketsSold, totalTickets, ticketsRemaining };
  };

  const filteredEvents = useMemo(() => {
    return events
      .filter(e => e.name.toLowerCase().includes(eventSearch.toLowerCase()))
      .filter(e => {
        if (eventStatusFilter === 'active') return e.isActive;
        if (eventStatusFilter === 'closed') return !e.isActive;
        return true;
      })
      .sort((a, b) => {
        if (eventSortBy === 'name') return a.name.localeCompare(b.name);
        if (eventSortBy === 'progress') return getEventStats(b).progress - getEventStats(a).progress;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [events, eventSearch, eventStatusFilter, eventSortBy, eventSales]);

  const globalStats = useMemo(() => {
    return filteredEvents.reduce((acc, event) => {
      const stats = getEventStats(event);
      acc.raised += stats.raised;
      acc.goal += Number(event.goalValue) || 0;
      acc.net += stats.netProfit;
      return acc;
    }, { raised: 0, goal: 0, net: 0 });
  }, [filteredEvents, eventSales]);

  // ── actions ───────────────────────────────────────────────────────────────

  const openNewModal = () => {
    setEditingEventId(null);
    setActiveTab('basic');
    setFormData({
      name: '', date: new Date().toISOString().split('T')[0], location: '',
      description: '', responsible: '', goalValue: 0, showOnDashboard: true,
      ticketQuantity: 0, ticketValue: 0, expenses: [], teamQuotas: [],
    });
    setShowModal(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEventId(event.id);
    setActiveTab('basic');
    setFormData({
      name: event.name, date: event.date,
      location: (event as any).location || '', description: (event as any).description || '',
      responsible: (event as any).responsible || '', goalValue: Number(event.goalValue) || 0,
      showOnDashboard: Boolean(event.showOnDashboard),
      ticketQuantity: Number(event.ticketQuantity) || 0, ticketValue: Number(event.ticketValue) || 0,
      expenses: event.expenses || [],
      teamQuotas: event.teamQuotas || teams.map(t => ({ teamId: t.id, quotaValue: 0 })),
    });
    setShowModal(true);
  };

  const handleSave = () => {
    const payload: Event = {
      id: editingEventId || '', ...formData, costValue: totalExpenses, cityId: '1', isActive: true,
    } as Event;
    if (editingEventId) {
      api.updateEvent(editingEventId, payload)
        .then((updated: Event) => { setEvents(events.map(e => e.id === updated.id ? updated : e)); setTimeout(loadData, 500); })
        .catch(console.error);
    } else {
      api.createEvent(payload)
        .then((created: Event) => { setEvents([created, ...events]); setTimeout(loadData, 500); })
        .catch(console.error);
    }
    setShowModal(false);
    setEditingEventId(null);
  };

  const handleDeleteConfirm = () => {
    if (!deleteConfirmId) return;
    api.updateEvent(deleteConfirmId, { isActive: false })
      .then(() => loadData())
      .catch(console.error)
      .finally(() => setDeleteConfirmId(null));
  };

  const handleOpenSaleModal = (event: Event) => {
    const defaultTeam = teams[0];
    const defaultMember = members.find(m => m.teamId === defaultTeam?.id);
    setSelectedEventForSale(event);
    setSaleForm({
      teamId: defaultTeam?.id || '', memberId: defaultMember?.id || '',
      buyerName: '', quantity: 1, amount: Number(event.ticketValue) || 0,
      date: new Date().toISOString().split('T')[0], status: 'Pago',
    });
    setShowSaleModal(true);
  };

  const handleCreateSale = async () => {
    if (!selectedEventForSale || !saleForm.teamId || !saleForm.memberId) return;
    if (saleForm.quantity <= 0 || saleForm.amount < 0) return;
    try {
      await Promise.all(
        Array.from({ length: saleForm.quantity }).map(() =>
          api.createEventSale({
            eventId: selectedEventForSale.id, teamId: saleForm.teamId,
            memberId: saleForm.memberId, buyerName: saleForm.buyerName || 'Ingressos avulsos',
            amount: saleForm.amount, status: saleForm.status, date: saleForm.date,
          })
        )
      );
      loadData();
      setShowSaleModal(false);
      setSelectedEventForSale(null);
    } catch (e) {
      console.error('Erro ao registrar venda:', e);
    }
  };

  const handleAddExpense = () => {
    if (!newExpense.description || newExpense.amount <= 0) return;
    setFormData({
      ...formData,
      expenses: [...formData.expenses, { id: Math.random().toString(36).substr(2, 9), ...newExpense }],
    });
    setNewExpense({ description: '', amount: 0 });
  };

  // ── select options ────────────────────────────────────────────────────────

  const teamSelectOptions = [
    { value: 'all', label: 'Todas' },
    ...teams.map(t => ({ value: t.id, label: t.name })),
  ];

  const statusFilterOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Ativos' },
    { value: 'closed', label: 'Finalizados' },
  ];

  const sortOptions = [
    { value: 'date', label: 'Mais recentes' },
    { value: 'progress', label: 'Maior progresso' },
    { value: 'name', label: 'Nome A-Z' },
  ];

  const MODAL_TABS = [
    { id: 'basic', label: 'Dados básicos' },
    { id: 'expenses', label: 'Gastos' },
    { id: 'goals', label: 'Metas' },
  ] as const;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <PageWrapper>
      <div className="space-y-6">

        {/* Header */}
        <SectionTitle
          title="Gestão de Eventos"
          icon={Ticket}
          action={
            <Button variant="primary" size="sm" iconLeft={<Plus className="w-4 h-4" />} onClick={openNewModal}>
              Novo Evento
            </Button>
          }
        />

        {/* Stats */}
        <StatGrid cols={4}>
          <StatCard title="Eventos exibidos" value={filteredEvents.length} icon={Ticket} color="info" delay={0} />
          <StatCard title="Arrecadação" value={fmt(globalStats.raised)} icon={DollarSign} color="success" delay={0.05} />
          <StatCard title="Meta consolidada" value={fmt(globalStats.goal)} icon={Target} color="default" delay={0.1} />
          <StatCard title="Saldo líquido" value={fmt(globalStats.net)} icon={TrendingUp} color={globalStats.net >= 0 ? 'success' : 'danger'} delay={0.15} />
        </StatGrid>

        {/* Filters */}
        <ContentCard padding="md">
          <FilterLine>
            <FilterLineSection>
              <FilterLineSearch
                value={eventSearch}
                onChange={setEventSearch}
                placeholder="Buscar evento..."
              />
            </FilterLineSection>
            <FilterLineSection>
              <FilterLineItem>
                <Select value={eventStatusFilter} onChange={e => setEventStatusFilter(e.target.value)} options={statusFilterOptions} />
              </FilterLineItem>
              <FilterLineItem>
                <Select value={eventSortBy} onChange={e => setEventSortBy(e.target.value)} options={sortOptions} />
              </FilterLineItem>
            </FilterLineSection>
          </FilterLine>
        </ContentCard>

        {/* Event cards */}
        {filteredEvents.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="Nenhum evento encontrado"
            description="Crie um novo evento ou ajuste os filtros."
            action={<Button variant="primary" size="sm" iconLeft={<Plus className="w-4 h-4" />} onClick={openNewModal}>Novo Evento</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredEvents.map(event => {
              const stats = getEventStats(event);
              return (
                <ContentCard key={event.id} padding="none" className="overflow-hidden border-l-4 border-l-amber-500">
                  <div className="p-6 space-y-5">
                    {/* Card header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                          <Ticket className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-zinc-900 leading-tight">{event.name}</h3>
                          <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {new Date(event.date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="xs" onClick={() => handleEditEvent(event)}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="xs" onClick={() => setDeleteConfirmId(event.id)}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-4 gap-2 py-3 border-y border-zinc-100">
                      <div className="text-center">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Gasto Real</p>
                        <p className="text-xs font-black text-red-500">{fmt(event.costValue)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Meta Bruta</p>
                        <p className="text-xs font-black text-blue-600">{fmt(event.goalValue)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Ingressos</p>
                        <p className="text-xs font-black text-zinc-700">{stats.ticketsSold} / {stats.totalTickets || '∞'}</p>
                        {stats.ticketsRemaining !== null && (
                          <p className="text-[9px] font-black text-amber-600">Restantes: {stats.ticketsRemaining}</p>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Margem</p>
                        <p className={`text-xs font-black ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(stats.netProfit)}</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-zinc-400">Arrecadado vs Meta</span>
                        <span className="text-amber-600">{fmt(stats.raised)} ({stats.progress.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-700 rounded-full ${stats.progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(stats.progress, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${event.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300'}`} />
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                          {event.isActive ? 'Evento Ativo' : 'Finalizado'}
                        </span>
                      </div>
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                        Dash: {event.showOnDashboard ? 'Sim' : 'Não'}
                      </span>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="px-6 pb-5">
                    <Button variant="success" size="sm" fullWidth iconLeft={<ShoppingCart className="w-4 h-4" />}
                      onClick={() => handleOpenSaleModal(event)}>
                      Registrar Venda
                    </Button>
                  </div>
                </ContentCard>
              );
            })}
          </div>
        )}

      </div>

      {/* ── Modal Venda ──────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showSaleModal && !!selectedEventForSale}
        onClose={() => { setShowSaleModal(false); setSelectedEventForSale(null); }}
        title={<span>Registrar Venda <span className="text-zinc-400 font-normal text-sm">— {selectedEventForSale?.name}</span></span>}
        size="lg"
        footer={
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => { setShowSaleModal(false); setSelectedEventForSale(null); }}>Cancelar</Button>
            <Button variant="success" size="sm" iconLeft={<ShoppingCart className="w-4 h-4" />} onClick={handleCreateSale}>Salvar Venda</Button>
          </ModalFooter>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Equipe"
            value={saleForm.teamId}
            onChange={e => {
              const teamId = e.target.value;
              const firstMember = members.find(m => m.teamId === teamId);
              setSaleForm(prev => ({ ...prev, teamId, memberId: firstMember?.id || '' }));
            }}
            options={[{ value: '', label: 'Selecione' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
          />
          <Select
            label="Vendedor"
            value={saleForm.memberId}
            onChange={e => setSaleForm(prev => ({ ...prev, memberId: e.target.value }))}
            options={[{ value: '', label: 'Selecione' }, ...teamMembersForSale.map(m => ({ value: m.id, label: m.name }))]}
          />
          <Input
            label="Quantidade"
            type="number"
            min={1}
            value={String(saleForm.quantity)}
            onChange={e => setSaleForm(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
          />
          <Input
            label="Valor unitário (R$)"
            type="number"
            min={0}
            step="0.01"
            value={String(saleForm.amount)}
            onChange={e => setSaleForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
          />
          <Input
            label="Comprador"
            placeholder="Nome do comprador"
            value={saleForm.buyerName}
            onChange={e => setSaleForm(prev => ({ ...prev, buyerName: e.target.value }))}
          />
          <Input
            label="Data"
            type="date"
            value={saleForm.date}
            onChange={e => setSaleForm(prev => ({ ...prev, date: e.target.value }))}
          />
          <Select
            label="Status da venda"
            value={saleForm.status}
            onChange={e => setSaleForm(prev => ({ ...prev, status: e.target.value as 'Pago' | 'Pendente' }))}
            options={[{ value: 'Pago', label: 'Pago' }, { value: 'Pendente', label: 'Pendente' }]}
          />
          <div className="md:col-span-2 p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Total da operação</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{fmt(saleForm.quantity * saleForm.amount)}</p>
          </div>
        </div>
      </Modal>

      {/* ── Modal Evento ─────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingEventId(null); }}
        title={editingEventId ? 'Editar Evento' : 'Novo Evento'}
        size="2xl"
        footer={
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => { setShowModal(false); setEditingEventId(null); }}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!formData.name || formData.goalValue <= 0}>
              {editingEventId ? 'Salvar' : 'Criar Evento'}
            </Button>
          </ModalFooter>
        }
      >
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-zinc-100 overflow-x-auto">
          {MODAL_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Dados básicos */}
        {activeTab === 'basic' && (
          <div className="space-y-5">
            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">Receita potencial</p>
                <p className="text-sm font-black text-blue-700 mt-1">{fmt(potentialRevenue)}</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-red-500">Gastos atuais</p>
                <p className="text-sm font-black text-red-600 mt-1">{fmt(totalExpenses)}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Meta</p>
                <p className="text-sm font-black text-emerald-700 mt-1">{fmt(Number(formData.goalValue || 0))}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Nome do Evento *"
                  placeholder="Ex: Galinhada Beneficente 2024"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <Input
                label="Data do Evento *"
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
              <Input
                label="Local do Evento"
                placeholder="Ex: Salão Paroquial"
                iconLeft={<MapPin className="w-4 h-4" />}
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
              />
              <div className="md:col-span-2">
                <Input
                  label="Responsável"
                  placeholder="Nome do coordenador"
                  iconLeft={<User className="w-4 h-4" />}
                  value={formData.responsible}
                  onChange={e => setFormData({ ...formData, responsible: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Descrição</label>
                <textarea
                  placeholder="Descreva o evento, objetivo e programação..."
                  className="ds-input w-full resize-none"
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <div>
                  <p className="text-xs font-black text-amber-700 uppercase tracking-widest">Exibir no Dashboard</p>
                  <p className="text-[10px] text-amber-600 font-medium mt-0.5">Visível na página inicial</p>
                </div>
                <Switch
                  checked={formData.showOnDashboard}
                  onChange={v => setFormData({ ...formData, showOnDashboard: v })}
                />
              </div>
            </div>

            <Divider />
            <p className="text-xs font-black text-zinc-700 uppercase tracking-widest">Ingressos</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Quantidade"
                type="number"
                placeholder="0"
                value={String(formData.ticketQuantity)}
                onChange={e => setFormData({ ...formData, ticketQuantity: parseInt(e.target.value) || 0 })}
              />
              <Input
                label="Valor Unitário (R$)"
                type="number"
                placeholder="0.00"
                value={String(formData.ticketValue)}
                onChange={e => setFormData({ ...formData, ticketValue: parseFloat(e.target.value) || 0 })}
              />
              <div className="p-4 bg-amber-500 rounded-xl flex flex-col justify-center">
                <p className="text-[9px] font-black text-amber-100 uppercase tracking-widest mb-1">Receita Potencial</p>
                <p className="text-xl font-black text-white">{fmt(potentialRevenue)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Gastos */}
        {activeTab === 'expenses' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-zinc-800">Detalhamento de custos</p>
              <span className="px-3 py-1 bg-red-50 border border-red-100 rounded-lg text-[10px] font-black text-red-600 uppercase">
                Total: {fmt(totalExpenses)}
              </span>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-6">
                  <Input
                    placeholder="Descrição do gasto..."
                    value={newExpense.description}
                    onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    placeholder="Valor R$"
                    value={String(newExpense.amount)}
                    onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="col-span-3 flex items-end">
                  <Button variant="primary" size="md" fullWidth iconLeft={<Plus className="w-4 h-4" />} onClick={handleAddExpense}>
                    Adicionar
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {formData.expenses.map(exp => (
                  <div key={exp.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-zinc-100">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-zinc-700 truncate">{exp.description}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-black text-red-500">{fmt(exp.amount)}</span>
                      <Button variant="ghost" size="xs" onClick={() => setFormData({ ...formData, expenses: formData.expenses.filter(e => e.id !== exp.id) })}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
                {formData.expenses.length === 0 && (
                  <div className="py-8 text-center border-2 border-dashed border-zinc-200 rounded-xl">
                    <Receipt className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                    <p className="text-xs text-zinc-400 font-bold">Nenhum gasto cadastrado</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Metas */}
        {activeTab === 'goals' && (
          <div className="space-y-5">
            <div className="p-6 bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl border border-emerald-100">
              <p className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" /> Meta Total de Arrecadação (Bruto)
              </p>
              <Input
                type="number"
                placeholder="0.00"
                addonLeft="R$"
                value={String(formData.goalValue)}
                onChange={e => setFormData({ ...formData, goalValue: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-[10px] text-emerald-600 font-medium mt-2">
                Sua meta deve cobrir os gastos ({fmt(totalExpenses)}) e gerar lucro!
              </p>
            </div>

            <div>
              <p className="text-sm font-black text-zinc-800 mb-3">Distribuição por Equipe Base</p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {formData.teamQuotas.map((quota, idx) => {
                  const team = teams.find(t => t.id === quota.teamId);
                  return (
                    <div key={quota.teamId} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <span className="text-sm font-bold text-zinc-700 flex-1">{team?.name}</span>
                      <div className="w-32">
                        <Input
                          type="number"
                          placeholder="0.00"
                          addonLeft="R$"
                          value={String(quota.quotaValue)}
                          onChange={e => {
                            const newQuotas = [...formData.teamQuotas];
                            newQuotas[idx].quotaValue = parseFloat(e.target.value) || 0;
                            setFormData({ ...formData, teamQuotas: newQuotas });
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Confirm Delete ────────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteConfirm}
        title="Inativar evento"
        message="Deseja realmente inativar este evento? Ele não será exibido na listagem ativa."
        confirmLabel="Inativar"
        variant="danger"
      />
    </PageWrapper>
  );
};

export default EventsView;
