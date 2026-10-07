import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Plus,
  X,
  Heart,
  Users,
  Baby,
  PersonStanding,
  UserRound,
  Clock,
  Layers,
  ChevronRight,
  Filter,
  BriefcaseBusiness,
} from 'lucide-react';
import { api } from '../api';
import { groupProfessions, matchesDirectorySearch, normalizeDirectoryText, professionKey } from '../utils/memberDirectory';
import { MemberStatus, Member } from '../types';
import {
  PageWrapper,
  SectionTitle,
  StatGrid,
  StatCard,
  ContentCard,
  Button,
  Select,
  Modal,
  ModalFooter,
  ConfirmModal,
  EmptyState,
  FilterLine,
  FilterLineSection,
  FilterLineItem,
  FilterLineSearch,
  FilterLineSegmented,
  GridTable,
  usePagination,
} from '../components/ui';
import type { Column } from '../components/ui';

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcYears(dateStr: string) {
  if (!dateStr) return 0;
  const today = new Date();
  const d = new Date(dateStr);
  let y = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) y--;
  return y;
}

// ── Componente principal ──────────────────────────────────────────────────────

const Members: React.FC = () => {
  const navigate = useNavigate();

  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [genderFilter, setGenderFilter] = useState('Todos');
  const [ageGroupFilter, setAgeGroupFilter] = useState('Todos');
  const [mfcTimeFilter, setMfcTimeFilter] = useState('Todos');
  const [teamFilter, setTeamFilter] = useState('Todos');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'mfc-desc' | 'age-desc'>('name-asc');
  const [showFilters, setShowFilters] = useState(false);
  const [activeView, setActiveView] = useState<'members' | 'professions'>('members');
  const [professionFilter, setProfessionFilter] = useState('Todos');
  const [professionSearch, setProfessionSearch] = useState('');

  // Modais
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string; name: string }>({ show: false, id: '', name: '' });
  const [teamModal, setTeamModal] = useState<{ show: boolean; memberId: string; memberName: string; currentTeamId: string | null }>({ show: false, memberId: '', memberName: '', currentTeamId: null });

  // Dados
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  // Carregamento
  const loadData = () => {
    api.getMembers().then(setMembers).catch(() => setMembers([]));
    api.getTeams().then(setTeams).catch(() => setTeams([]));
  };

  useEffect(() => {
    loadData();
    window.addEventListener('focus', loadData);
    const iv = setInterval(loadData, 30000);
    return () => { window.removeEventListener('focus', loadData); clearInterval(iv); };
  }, []);

  // Stats
  const stats = useMemo(() => {
    const t = { total: members.length, male: 0, female: 0, children: 0, youth: 0, adult: 0, elderly: 0, active: 0 };
    members.forEach(m => {
      if (m.gender === 'Masculino') t.male++; else t.female++;
      if (m.status === MemberStatus.ATIVO) t.active++;
      const age = calcYears(m.dob);
      if (age <= 12) t.children++; else if (age <= 18) t.youth++; else if (age <= 59) t.adult++; else t.elderly++;
    });
    return t;
  }, [members]);

  // Filtros
  const baseFiltered = useMemo(() => {
    const r = members.filter(m => {
      const matchSearch = matchesDirectorySearch(m, search);
      const matchStatus = statusFilter === 'Todos' || m.status === statusFilter;
      const matchGender = genderFilter === 'Todos' || m.gender === genderFilter;
      const age = calcYears(m.dob);
      let grp = 'Adulto';
      if (age <= 12) grp = 'Criança'; else if (age <= 18) grp = 'Jovem'; else if (age >= 60) grp = 'Idoso';
      const matchAge = ageGroupFilter === 'Todos' || grp === ageGroupFilter;
      const yMfc = calcYears(m.mfcDate);
      let tr = '0-5';
      if (yMfc > 25) tr = '25+'; else if (yMfc > 10) tr = '10-25'; else if (yMfc > 5) tr = '5-10';
      const matchMfc = mfcTimeFilter === 'Todos' || tr === mfcTimeFilter;
      const matchTeam = teamFilter === 'Todos' || m.teamId === teamFilter || (teamFilter === 'Sem equipe' && !m.teamId);
      return matchSearch && matchStatus && matchGender && matchAge && matchMfc && matchTeam;
    });
    return [...r].sort((a, b) => {
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'mfc-desc') return calcYears(b.mfcDate) - calcYears(a.mfcDate);
      if (sortBy === 'age-desc') return calcYears(b.dob) - calcYears(a.dob);
      return a.name.localeCompare(b.name);
    });
  }, [members, search, statusFilter, genderFilter, ageGroupFilter, mfcTimeFilter, teamFilter, sortBy]);

  const professions = useMemo(() => groupProfessions(members), [members]);
  const matchingProfessions = useMemo(() => groupProfessions(baseFiltered), [baseFiltered]);
  const visibleProfessions = matchingProfessions.filter(item => normalizeDirectoryText(item.label).includes(normalizeDirectoryText(professionSearch)));
  const filtered = useMemo(() => baseFiltered.filter(member => professionFilter === 'Todos' || professionKey(member.profession) === professionFilter), [baseFiltered, professionFilter]);
  const selectedProfessionLabel = professions.find(item => item.key === professionFilter)?.label || 'Não informada';

  const { page, pageSize, paginatedData, setPage, setPageSize } = usePagination(filtered, 15);
  useEffect(() => { setPage(1); }, [search, statusFilter, genderFilter, ageGroupFilter, mfcTimeFilter, teamFilter, professionFilter, sortBy]);

  const activeFiltersCount = [statusFilter !== 'Todos', genderFilter !== 'Todos', ageGroupFilter !== 'Todos', mfcTimeFilter !== 'Todos', teamFilter !== 'Todos', professionFilter !== 'Todos'].filter(Boolean).length;

  const resetFilters = () => { setStatusFilter('Todos'); setGenderFilter('Todos'); setAgeGroupFilter('Todos'); setMfcTimeFilter('Todos'); setTeamFilter('Todos'); setProfessionFilter('Todos'); setProfessionSearch(''); setSearch(''); setSortBy('name-asc'); };

  const confirmDelete = () => {
    toast.promise(api.deleteMember(deleteConfirm.id).then(() => {
      setMembers(p => p.filter(m => m.id !== deleteConfirm.id));
      setDeleteConfirm({ show: false, id: '', name: '' });
    }), { loading: 'Excluindo...', success: 'MFCista excluído! 🗑️', error: (e) => e.message });
  };

  const handleRemoveTeam = () => {
    toast.promise(api.updateMember(teamModal.memberId, { teamId: null }).then(u => {
      setMembers(p => p.map(m => m.id === teamModal.memberId ? u : m));
      setTeamModal({ show: false, memberId: '', memberName: '', currentTeamId: null });
    }), { loading: 'Desvinculando...', success: 'Membro desvinculado! ✅', error: (e) => e.message });
  };

  const handleTransferTeam = (teamId: string) => {
    toast.promise(api.updateMember(teamModal.memberId, { teamId }).then(u => {
      setMembers(p => p.map(m => m.id === teamModal.memberId ? u : m));
      setTeamModal({ show: false, memberId: '', memberName: '', currentTeamId: null });
    }), { loading: 'Transferindo...', success: 'Transferido! 🔄', error: (e) => e.message });
  };

  // Colunas da tabela
  const columns: Column<Member>[] = [
    {
      header: 'MFCista',
      render: (m) => (
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-[10px] sm:text-sm shrink-0 ${m.gender === 'Masculino' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
            {m.name.substring(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-zinc-900 truncate">{m.name}</p>
            <p className="text-[10px] text-zinc-400 font-semibold truncate">{m.phone}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Profissão',
      render: (m) => <span className={`text-xs ${m.profession?.trim() ? 'text-slate-700' : 'text-slate-400'}`}>{m.profession?.trim() || 'Não informada'}</span>,
    },
    {
      header: 'Equipe',
      render: (m) => m.teamId
        ? <span className="text-sm font-semibold text-zinc-700">{teams.find(t => t.id === m.teamId)?.name || '—'}</span>
        : <span className="text-xs text-zinc-400 italic">Sem equipe</span>,
    },
    {
      header: 'Tempo MFC',
      render: (m) => (
        <div>
          <p className="text-sm font-bold text-zinc-800">{calcYears(m.mfcDate)} anos</p>
          <p className="text-[10px] text-zinc-400">desde {new Date(m.mfcDate).getFullYear()}</p>
        </div>
      ),
    },
    {
      header: 'Idade',
      render: (m) => (
        <div>
          <p className="text-sm font-bold text-zinc-800">{calcYears(m.dob)} anos</p>
          <p className="text-[10px] text-zinc-400">{m.gender === 'Masculino' ? 'Masculino' : 'Feminino'}</p>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (m) => (
        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${
          m.status === MemberStatus.ATIVO ? 'bg-emerald-100 text-emerald-700' :
          m.status === MemberStatus.AGUARDANDO ? 'bg-amber-100 text-amber-700' :
          'bg-zinc-100 text-zinc-500'}`}>
          {m.status}
        </span>
      ),
    },
    {
      header: 'Ações',
      render: (m) => (
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          {m.teamId && (
            <Button variant="ghost" size="xs" iconLeft={<Layers className="w-3.5 h-3.5" />}
              className="flex-1 sm:flex-initial"
              onClick={(e) => { e.stopPropagation(); setTeamModal({ show: true, memberId: m.id, memberName: m.name, currentTeamId: m.teamId || null }); }}>
              Equipe
            </Button>
          )}
          <Button variant="outline" size="xs" className="flex-1 sm:flex-initial" onClick={(e) => { e.stopPropagation(); navigate(`/mfcistas/${m.id}/editar`); }}>Editar</Button>
          <Button variant="danger" size="xs" className="flex-1 sm:flex-initial" onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ show: true, id: m.id, name: m.name }); }}>Excluir</Button>
        </div>
      ),
    },
  ];

  const currentMonth = new Date().getMonth() + 1;
  const birthdays = filtered.filter(m => m.dob && new Date(m.dob).getMonth() + 1 === currentMonth)
    .sort((a, b) => new Date(a.dob).getDate() - new Date(b.dob).getDate());

  const MONTH_NAMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return (
    <PageWrapper>
      <div className="space-y-6">

        {/* Header */}
        <SectionTitle
          title="Comunidade MFC"
          description="Gestão demográfica e administrativa de MFCistas"
          icon={Users}
          action={
            <Button variant="primary" size="md" iconLeft={<Plus className="w-4 h-4" />} onClick={() => navigate('/mfcistas/novo')}>
              Novo MFCista
            </Button>
          }
        />

        {/* Stats */}
        <StatGrid cols={4}>
          <StatCard title="Total MFCistas" value={stats.total} icon={Users} color="info" description={`${stats.active} ativos`} delay={0} />
          <StatCard title="Jovens e Crianças" value={stats.children + stats.youth} icon={Baby} color="warning" description="Base do Movimento" delay={0.05} />
          <StatCard title="3ª Idade" value={stats.elderly} icon={PersonStanding} color="danger" description="Nossa Fortaleza" delay={0.1} />
          <StatCard title="Adultos" value={stats.adult} icon={UserRound} color="success" description="Força do MFC" delay={0.15} />
        </StatGrid>

        {/* Aniversariantes */}
        {activeView === 'members' && birthdays.length > 0 && (
          <ContentCard padding="md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-pink-50 rounded-2xl flex items-center justify-center border border-pink-100">
                <span className="text-lg">🎂</span>
              </div>
              <div>
                <h3 className="text-base font-black text-zinc-900">Aniversariantes de {MONTH_NAMES[currentMonth]}</h3>
                <p className="text-xs text-zinc-400 font-semibold">{birthdays.length} {birthdays.length === 1 ? 'aniversariante' : 'aniversariantes'} este mês</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {birthdays.map(m => {
                const day = new Date(m.dob).getDate();
                const today = new Date().getDate();
                const isToday = day === today;
                return (
                  <div key={m.id} onClick={() => navigate(`/mfcistas/${m.id}`)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer hover:shadow-md transition-all ${isToday ? 'border-pink-400 bg-pink-50' : 'border-zinc-200 hover:border-amber-300'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${m.gender === 'Masculino' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                      {m.name.substring(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-zinc-900 text-sm truncate">{m.name}</p>
                      <p className="text-[10px] text-zinc-400 font-semibold">dia {day} · {calcYears(m.dob)} anos</p>
                    </div>
                    {isToday && <span className="text-lg">🎉</span>}
                  </div>
                );
              })}
            </div>
          </ContentCard>
        )}

        <div className="flex gap-1 border-b border-slate-200" role="tablist" aria-label="Visualização dos MFCistas">
          {([{ value: 'members', label: 'MFCistas', icon: Users }, { value: 'professions', label: 'Profissões', icon: BriefcaseBusiness }] as const).map(({ value, label, icon: Icon }) => (
            <button key={value} id={`directory-tab-${value}`} type="button" role="tab" aria-selected={activeView === value} aria-controls="directory-panel" tabIndex={activeView === value ? 0 : -1}
              onClick={() => setActiveView(value)} onKeyDown={event => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault();
                  const next = event.key === 'Home' ? 'members' : event.key === 'End' ? 'professions' : activeView === 'members' ? 'professions' : 'members';
                  setActiveView(next);
                  document.getElementById(`directory-tab-${next}`)?.focus();
                }
              }}
              className={`flex items-center gap-2 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors focus-visible:outline-blue-500 ${activeView === value ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        <div id="directory-panel" role="tabpanel" aria-labelledby={`directory-tab-${activeView}`} className="space-y-4">
        {/* Filtros compartilhados entre a lista e o diretório de profissões. */}
        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem grow>
              <FilterLineSearch aria-label="Buscar MFCistas" value={search} onChange={setSearch} placeholder="Nome, profissão, telefone ou CPF…" />
            </FilterLineItem>
          </FilterLineSection>
          <FilterLineSection align="right">
            <FilterLineSegmented<string>
              value={teamFilter === 'Sem equipe' ? 'Sem equipe' : statusFilter}
              onChange={(val) => {
                if (val === 'Sem equipe') {
                  setTeamFilter('Sem equipe');
                  setStatusFilter('Todos');
                } else {
                  setTeamFilter('Todos');
                  setStatusFilter(val);
                }
              }}
              options={[
                { value: 'Todos', label: 'Todos' },
                { value: MemberStatus.ATIVO, label: 'Ativos' },
                { value: MemberStatus.AGUARDANDO, label: 'Aguardando' },
                { value: 'Sem equipe', label: 'Sem Equipe' },
              ]}
              size="sm"
            />
            <Button variant={showFilters ? 'primary' : 'outline'} size="sm"
              iconLeft={<Filter className="w-3.5 h-3.5" />}
              aria-expanded={showFilters} aria-controls="member-advanced-filters" onClick={() => setShowFilters(v => !v)}>
              Filtros {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </Button>
            {(activeFiltersCount > 0 || search || professionSearch || sortBy !== 'name-asc') && (
              <Button variant="ghost" size="sm" iconLeft={<X className="w-3.5 h-3.5" />} onClick={resetFilters}>Limpar filtros</Button>
            )}
          </FilterLineSection>
        </FilterLine>

        {/* Gaveta de filtros avançados */}
        {showFilters && (
          <ContentCard padding="md">
            <div id="member-advanced-filters" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <Select label="Profissão" value={professionFilter} onChange={e => setProfessionFilter(e.target.value)}
                options={[{ value: 'Todos', label: 'Todas as profissões' }, ...professions.map(item => ({ value: item.key, label: `${item.label} (${item.count})` }))]} />
              <Select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                options={[{ value: 'Todos', label: 'Todos os Status' }, ...Object.values(MemberStatus).map(s => ({ value: s, label: s }))]} />
              <Select label="Gênero" value={genderFilter} onChange={e => setGenderFilter(e.target.value)}
                options={[{ value: 'Todos', label: 'Todos' }, { value: 'Masculino', label: 'Masculino' }, { value: 'Feminino', label: 'Feminino' }]} />
              <Select label="Faixa Etária" value={ageGroupFilter} onChange={e => setAgeGroupFilter(e.target.value)}
                options={[{ value: 'Todos', label: 'Todas' }, { value: 'Criança', label: 'Crianças (0-12)' }, { value: 'Jovem', label: 'Jovens (13-18)' }, { value: 'Adulto', label: 'Adultos (19-59)' }, { value: 'Idoso', label: 'Idosos (60+)' }]} />
              <Select label="Tempo MFC" value={mfcTimeFilter} onChange={e => setMfcTimeFilter(e.target.value)}
                options={[{ value: 'Todos', label: 'Qualquer' }, { value: '0-5', label: 'Novatos (0-5)' }, { value: '5-10', label: 'Integrados (5-10)' }, { value: '10-25', label: 'Experientes (10-25)' }, { value: '25+', label: 'Veteranos (25+)' }]} />
              <Select label="Equipe" value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
                options={[{ value: 'Todos', label: 'Todas' }, { value: 'Sem equipe', label: 'Sem Equipe' }, ...teams.map(t => ({ value: t.id, label: t.name }))]} />
              <Select label="Ordenação" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                options={[{ value: 'name-asc', label: 'Nome (A-Z)' }, { value: 'name-desc', label: 'Nome (Z-A)' }, { value: 'mfc-desc', label: 'Mais tempo MFC' }, { value: 'age-desc', label: 'Maior idade' }]} />
            </div>
          </ContentCard>
        )}

        {activeView === 'professions' && (
          <ContentCard padding="md">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-800">Profissões da comunidade</h3>
                <p className="text-xs text-slate-500 mt-1">Selecione uma profissão para ver os MFCistas abaixo. As quantidades respeitam os filtros acima.</p>
              </div>
              <div className="w-full sm:w-60 shrink-0"><FilterLineSearch aria-label="Buscar profissão" placeholder="Buscar profissão…" value={professionSearch} onChange={setProfessionSearch} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1" aria-label="Profissões cadastradas">
              {[{ key: 'Todos', label: 'Todas as profissões', count: baseFiltered.length }, ...visibleProfessions].map(item => (
                <button key={item.key} type="button" aria-pressed={professionFilter === item.key} onClick={() => setProfessionFilter(item.key)}
                  className={`flex items-center justify-between gap-3 text-left min-w-0 rounded-md border px-3 py-2 text-xs transition-colors focus-visible:outline-blue-500 ${professionFilter === item.key ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'}`}>
                  <span className="break-words min-w-0">{item.label}</span><span className="shrink-0 tabular-nums font-semibold">{item.count}</span>
                </button>
              ))}
            </div>
            {visibleProfessions.length === 0 && <p className="text-xs text-slate-500 mt-3">Nenhuma profissão encontrada com esta busca.</p>}
            <p className="text-[11px] text-slate-500 mt-3">Para completar uma profissão, abra Editar no MFCista e acesse a aba Contato.</p>
          </ContentCard>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <p role="status">{filtered.length} {filtered.length === 1 ? 'MFCista encontrado' : 'MFCistas encontrados'} de {members.length}</p>
          {professionFilter !== 'Todos' && <button type="button" aria-label="Remover filtro de profissão" onClick={() => setProfessionFilter('Todos')} className="flex items-center gap-2 border border-blue-100 bg-blue-50 text-blue-700 px-2 py-1.5 rounded-md">Profissão: {selectedProfessionLabel}<X size={13} /></button>}
        </div>

        {/* Tabela */}
        <ContentCard padding="none">
          <GridTable
            columns={columns}
            data={paginatedData}
            keyExtractor={(m) => m.id}
            onRowClick={(m) => navigate(`/mfcistas/${m.id}`)}
            noDesktopCard
            emptyMessage={
              <EmptyState icon={Users} title="Nenhum MFCista encontrado" description="Tente ajustar os filtros ou cadastre um novo membro."
                action={<Button variant="primary" size="sm" onClick={resetFilters}>Limpar Filtros</Button>} />
            }
            pagination={{ total: filtered.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }}
          />
        </ContentCard>
        </div>

      </div>

      {/* ── Confirmar Exclusão ────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: '', name: '' })}
        onConfirm={confirmDelete}
        title="Excluir MFCista"
        message={`Tem certeza que deseja excluir ${deleteConfirm.name}? Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, Excluir"
        variant="danger"
      />

      {/* ── Modal Gerenciar Equipe ─────────────────────────────────────────────── */}
      <Modal
        isOpen={teamModal.show}
        onClose={() => setTeamModal({ show: false, memberId: '', memberName: '', currentTeamId: null })}
        title="Gerenciar Equipe"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-0.5">Equipe Atual</p>
            <p className="text-sm font-black text-zinc-900">
              {teamModal.currentTeamId ? teams.find(t => t.id === teamModal.currentTeamId)?.name || '—' : 'Sem equipe'}
            </p>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Transferir para:</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {teams.filter(t => t.id !== teamModal.currentTeamId).map(team => (
              <button key={team.id} onClick={() => handleTransferTeam(team.id)}
                className="w-full p-3 bg-zinc-50 hover:bg-amber-50 border border-zinc-200 hover:border-amber-300 rounded-xl text-left transition-all flex items-center justify-between group">
                <div>
                  <p className="text-sm font-bold text-zinc-900 group-hover:text-amber-700">{team.name}</p>
                  <p className="text-xs text-zinc-400">{team.city} - {team.state}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-amber-500" />
              </button>
            ))}
          </div>
          {teamModal.currentTeamId && (
            <button onClick={handleRemoveTeam}
              className="w-full p-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-left transition-all flex items-center gap-3">
              <X className="w-4 h-4 text-red-600" />
              <div>
                <p className="text-sm font-bold text-red-700">Remover da Equipe</p>
                <p className="text-xs text-red-400">O membro ficará sem equipe</p>
              </div>
            </button>
          )}
        </div>
        <ModalFooter>
          <div />
          <Button variant="outline" size="sm" onClick={() => setTeamModal({ show: false, memberId: '', memberName: '', currentTeamId: null })}>Fechar</Button>
        </ModalFooter>
      </Modal>

    </PageWrapper>
  );
};

export default Members;
