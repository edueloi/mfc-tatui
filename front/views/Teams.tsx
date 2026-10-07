import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Plus,
  MapPin,
  Users,
  ChevronRight,
  Edit2,
  Trash2,
  Crown,
  Baby,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../api';
import { BaseTeam, City } from '../types';
import {
  PageWrapper,
  SectionTitle,
  StatGrid,
  StatCard,
  ContentCard,
  FilterLine,
  FilterLineSection,
  FilterLineItem,
  FilterLineSearch,
  FilterLineSegmented,
  Select,
  Input,
  Switch,
  Button,
  Modal,
  ModalFooter,
  ConfirmModal,
  EmptyState,
  Badge,
} from '../components/ui';

const Teams: React.FC = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<BaseTeam | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BaseTeam | null>(null);
  const [newTeam, setNewTeam] = useState({ name: '', city: 'Tatuí', state: 'SP', isYouth: false });
  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [estados, setEstados] = useState<Array<{ id: number; sigla: string; nome: string }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [selectedCityFilter, setSelectedCityFilter] = useState('all');

  const loadData = () => {
    api.getTeams().then(setTeams).catch(() => setTeams([]));
    api.getCities().then(setCities).catch(() => setCities([]));
  };

  useEffect(() => {
    loadData();
    api.getEstados().then(setEstados).catch(() => setEstados([]));
    window.addEventListener('focus', loadData);
    const iv = setInterval(loadData, 30000);
    return () => { window.removeEventListener('focus', loadData); clearInterval(iv); };
  }, []);

  useEffect(() => {
    if (cities.length > 0) {
      setNewTeam(prev => ({ ...prev, city: prev.city || cities[0].name, state: prev.state || cities[0].uf }));
    }
  }, [cities]);

  const handleCreate = (saveAndNew: boolean) => {
    if (newTeam.name.trim().length < 3) return;
    api.createTeam(newTeam)
      .then((created: BaseTeam) => {
        setTeams(prev => [created, ...prev]);
        if (!saveAndNew) { setShowModal(false); setEditingTeam(null); }
        setNewTeam({ name: '', city: newTeam.city, state: newTeam.state, isYouth: false });
      })
      .catch(console.error);
  };

  const handleUpdate = () => {
    if (!editingTeam || newTeam.name.trim().length < 3) return;
    api.updateTeam(editingTeam.id, newTeam)
      .then((updated: BaseTeam) => {
        setTeams(prev => prev.map(t => t.id === editingTeam.id ? updated : t));
        setShowModal(false);
        setEditingTeam(null);
        setNewTeam({ name: '', city: 'Tatuí', state: 'SP', isYouth: false });
      })
      .catch(console.error);
  };

  const handleEdit = (team: BaseTeam) => {
    setEditingTeam(team);
    setNewTeam({ name: team.name, city: team.city, state: team.state, isYouth: team.isYouth || false });
    setShowModal(true);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget || (deleteTarget.memberCount && deleteTarget.memberCount > 0)) return;
    api.deleteTeam(deleteTarget.id)
      .then(() => { setTeams(prev => prev.filter(t => t.id !== deleteTarget.id)); setDeleteTarget(null); })
      .catch(() => setDeleteTarget(null));
  };

  const baseTeams = teams.filter(t => !t.isYouth);
  const youthTeams = teams.filter(t => t.isYouth);
  const totalMembers = teams.reduce((acc, t) => acc + (t.memberCount || 0), 0);
  const teamsAtRisk = teams.filter(t => (t.memberCount || 0) <= 2).length;
  const cityOptions = [
    { value: 'all', label: 'Todas as cidades' },
    ...Array.from(new Set(teams.map(t => t.city))).sort().map(c => ({ value: c, label: c })),
  ];
  const sortOptions = [
    { value: 'name', label: 'Por nome' },
    { value: 'members', label: 'Por membros' },
    { value: 'city', label: 'Por cidade' },
  ];
  const canSave = newTeam.name.trim().length >= 3 && newTeam.city.trim() !== '' && newTeam.state.trim() !== '';

  const filteredTeams = teams
    .filter(t => {
      const q = searchTerm.toLowerCase();
      const matchSearch = t.name.toLowerCase().includes(q) || t.city.toLowerCase().includes(q);
      const matchType = filterType === 'all' || (filterType === 'base' && !t.isYouth) || (filterType === 'youth' && t.isYouth);
      const matchCity = selectedCityFilter === 'all' || t.city === selectedCityFilter;
      return matchSearch && matchType && matchCity;
    })
    .sort((a, b) => {
      if (sortBy === 'members') return (b.memberCount || 0) - (a.memberCount || 0);
      if (sortBy === 'city') return a.city.localeCompare(b.city);
      return a.name.localeCompare(b.name);
    });

  return (
    <PageWrapper>
      <div className="space-y-6">

        {/* Header */}
        <SectionTitle
          title="Equipes Base"
          icon={Layers}
          action={
            <Button variant="primary" size="sm" iconLeft={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingTeam(null);
                setNewTeam({ name: '', city: cities[0]?.name || 'Tatuí', state: cities[0]?.uf || 'SP', isYouth: false });
                setShowModal(true);
              }}>
              Nova Equipe
            </Button>
          }
        />

        {/* Stats */}
        <StatGrid cols={4}>
          <StatCard title="Equipes Base" value={baseTeams.length} icon={Layers} color="info" delay={0} />
          <StatCard title="MFC Jovem" value={youthTeams.length} icon={Baby} color="purple" delay={0.05} />
          <StatCard title="Total MFCistas" value={totalMembers} icon={Users} color="success" delay={0.1} />
          <StatCard title="Equipes em atenção" value={teamsAtRisk} icon={AlertTriangle} color="warning" delay={0.15} />
        </StatGrid>

        {/* Filters */}
        <ContentCard padding="md">
          <FilterLine>
            <FilterLineSection>
              <FilterLineSearch value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por nome ou cidade..." />
            </FilterLineSection>
            <FilterLineSection>
              <FilterLineItem>
                <FilterLineSegmented
                  value={filterType}
                  onChange={setFilterType}
                  options={[
                    { value: 'all', label: 'Todas' },
                    { value: 'base', label: 'Base' },
                    { value: 'youth', label: 'Jovem' },
                  ]}
                />
              </FilterLineItem>
              <FilterLineItem>
                <Select value={selectedCityFilter} onChange={e => setSelectedCityFilter(e.target.value)} options={cityOptions} />
              </FilterLineItem>
              <FilterLineItem>
                <Select value={sortBy} onChange={e => setSortBy(e.target.value)} options={sortOptions} />
              </FilterLineItem>
            </FilterLineSection>
          </FilterLine>
        </ContentCard>

        {/* Team cards */}
        {filteredTeams.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Nenhuma equipe encontrada"
            description="Tente ajustar os filtros ou criar uma nova equipe."
            action={
              <Button variant="primary" size="sm" iconLeft={<Plus className="w-4 h-4" />}
                onClick={() => { setEditingTeam(null); setNewTeam({ name: '', city: cities[0]?.name || 'Tatuí', state: cities[0]?.uf || 'SP', isYouth: false }); setShowModal(true); }}>
                Nova Equipe
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTeams.map(team => (
              <ContentCard
                key={team.id}
                padding="lg"
                className="cursor-pointer hover:shadow-lg transition-all group"
                onClick={() => navigate(`/equipes/${team.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    team.isYouth ? 'bg-violet-100 text-violet-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {team.isYouth ? <Baby className="w-6 h-6" /> : <Crown className="w-6 h-6" />}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="xs" onClick={e => { e.stopPropagation(); handleEdit(team); }}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="xs" onClick={e => { e.stopPropagation(); setDeleteTarget(team); }}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>

                <h3 className="text-base font-black text-zinc-900 mb-3 group-hover:text-amber-600 transition-colors">
                  {team.name}
                </h3>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-xs font-semibold">{team.city}, {team.state}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-xs font-bold">{team.memberCount || 0} {team.memberCount === 1 ? 'membro' : 'membros'}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                  {team.isYouth && (
                    <span className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-lg text-[10px] font-black uppercase tracking-wide">
                      MFC Jovem
                    </span>
                  )}
                  <div className={`flex items-center gap-1.5 text-amber-600 font-bold text-xs ml-auto`}>
                    Ver detalhes <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </ContentCard>
            ))}
          </div>
        )}

      </div>

      {/* ── Modal Criar/Editar ───────────────────────────────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingTeam(null); }}
        title={editingTeam ? 'Editar Equipe' : 'Nova Equipe Base'}
        size="sm"
        footer={
          <ModalFooter>
            {!editingTeam && (
              <Button variant="outline" size="sm" disabled={!canSave} onClick={() => handleCreate(true)}>
                Salvar e Criar Outra
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setShowModal(false); setEditingTeam(null); }}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" disabled={!canSave} onClick={editingTeam ? handleUpdate : () => handleCreate(false)}>
              {editingTeam ? 'Atualizar' : 'Criar Equipe'}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome da Equipe *"
            placeholder="Ex: Equipe São José"
            value={newTeam.name}
            onChange={e => setNewTeam({ ...newTeam, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Estado"
              value={newTeam.state}
              onChange={e => setNewTeam({ ...newTeam, state: e.target.value })}
              options={estados.map(e => ({ value: e.sigla, label: e.sigla }))}
            />
            <Select
              label="Cidade"
              value={newTeam.city}
              onChange={e => setNewTeam({ ...newTeam, city: e.target.value })}
              options={cities.map(c => ({ value: c.name, label: c.name }))}
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-violet-50 border border-violet-100 rounded-xl">
            <div>
              <p className="text-xs font-black text-violet-700 uppercase tracking-widest">Equipe MFC Jovem</p>
              <p className="text-[10px] text-violet-500 font-medium mt-0.5">Marque se for uma equipe jovem</p>
            </div>
            <Switch checked={newTeam.isYouth} onChange={v => setNewTeam({ ...newTeam, isYouth: v })} />
          </div>
        </div>
      </Modal>

      {/* ── Confirm Delete ───────────────────────────────────────────────────── */}
      {deleteTarget && deleteTarget.memberCount && deleteTarget.memberCount > 0 ? (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Não é Possível Excluir"
          size="sm"
          footer={
            <ModalFooter>
              <Button variant="primary" size="sm" onClick={() => setDeleteTarget(null)}>Entendido</Button>
            </ModalFooter>
          }
        >
          <p className="text-sm text-zinc-600">
            A equipe <span className="font-black text-zinc-900">{deleteTarget.name}</span> possui{' '}
            <span className="font-black text-amber-600">{deleteTarget.memberCount} membro(s)</span> vinculado(s).
            Remova todos os membros antes de excluí-la.
          </p>
        </Modal>
      ) : (
        <ConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          title="Excluir Equipe"
          message={`Tem certeza que deseja excluir a equipe "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
          confirmLabel="Sim, Excluir"
          variant="danger"
        />
      )}
    </PageWrapper>
  );
};

export default Teams;
