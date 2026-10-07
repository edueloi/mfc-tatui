import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Layers, Plus, MapPin, Users, Pencil, Trash2, Baby, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../api';
import { BaseTeam } from '../types';
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard, FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch,
  FilterLineSegmented, Select, Button, IconButton, Modal, ModalFooter, ConfirmModal, EmptyState, Badge,
} from '../components/ui';
import { TeamFormModal } from '../components/TeamFormModal';
import { normalizeDirectoryText } from '../utils/memberDirectory';
import { teamPath } from '../utils/teamSlug';

const sortOptions = [
  { value: 'name', label: 'Por nome' },
  { value: 'members', label: 'Por membros' },
  { value: 'city', label: 'Por cidade' },
];

const Teams: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<BaseTeam | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BaseTeam | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [cityFilter, setCityFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    const load = () => api.getTeams()
      .then((items: BaseTeam[]) => { if (!cancelled) { setTeams(items); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    load();
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.removeEventListener('focus', load); };
  }, [retry]);

  const openForm = (team: BaseTeam | null) => { setEditingTeam(team); setShowForm(true); };

  const handleSaved = (saved: BaseTeam, mode: 'created' | 'updated') =>
    setTeams(prev => mode === 'created' ? [saved, ...prev] : prev.map(team => team.id === saved.id ? { ...team, ...saved } : team));

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.deleteTeam(deleteTarget.id);
      setTeams(prev => prev.filter(team => team.id !== deleteTarget.id));
      toast.success('Equipe excluída.');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir a equipe.');
    } finally { setDeleting(false); }
  };

  const baseCount = teams.filter(team => !team.isYouth).length;
  const youthCount = teams.length - baseCount;
  const totalMembers = teams.reduce((total, team) => total + (team.memberCount || 0), 0);
  const attentionCount = teams.filter(team => (team.memberCount || 0) <= 2).length;
  const cityOptions = [{ value: 'all', label: 'Todas as cidades' }, ...Array.from(new Set(teams.map(team => team.city))).sort().map(city => ({ value: city, label: city }))];

  const query = normalizeDirectoryText(searchTerm);
  const filteredTeams = teams
    .filter(team => (!query || normalizeDirectoryText(`${team.name} ${team.city}`).includes(query))
      && (filterType === 'all' || (filterType === 'youth') === !!team.isYouth)
      && (cityFilter === 'all' || team.city === cityFilter))
    .sort((a, b) => sortBy === 'members' ? (b.memberCount || 0) - (a.memberCount || 0) : sortBy === 'city' ? a.city.localeCompare(b.city, 'pt-BR') : a.name.localeCompare(b.name, 'pt-BR'));
  const hasFilter = !!query || filterType !== 'all' || cityFilter !== 'all';
  const clearFilters = () => { setSearchTerm(''); setFilterType('all'); setCityFilter('all'); };

  if (loading) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando equipes…</div></PageWrapper>;

  if (error && !teams.length) return <PageWrapper><ContentCard><EmptyState icon={Layers} title="Não foi possível carregar as equipes" description="Confira a conexão e tente novamente."
    action={<Button onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Tentar novamente</Button>} /></ContentCard></PageWrapper>;

  const blockedDelete = !!deleteTarget && (deleteTarget.memberCount || 0) > 0;

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle title="Equipes Base" icon={Layers} description={`${teams.length} equipes · ${totalMembers} MFCistas`}
          action={<Button size="sm" iconLeft={<Plus size={14} />} onClick={() => openForm(null)}>Nova equipe</Button>} />

        <StatGrid cols={4}>
          <StatCard title="Equipes base" value={baseCount} icon={Layers} color="info" />
          <StatCard title="MFC Jovem" value={youthCount} icon={Baby} color="purple" />
          <StatCard title="Total de MFCistas" value={totalMembers} icon={Users} color="success" />
          <StatCard title="Equipes em atenção" value={attentionCount} icon={AlertTriangle} color="warning" description="Com 2 membros ou menos" />
        </StatGrid>

        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem grow><FilterLineSearch aria-label="Buscar equipes" value={searchTerm} onChange={setSearchTerm} placeholder="Nome da equipe ou cidade…" /></FilterLineItem>
            <FilterLineItem>
              <FilterLineSegmented value={filterType} onChange={value => setFilterType(String(value))} options={[{ value: 'all', label: 'Todas' }, { value: 'base', label: 'Base' }, { value: 'youth', label: 'Jovem' }]} />
            </FilterLineItem>
            <FilterLineItem><Select aria-label="Filtrar por cidade" value={cityFilter} onChange={event => setCityFilter(event.target.value)} options={cityOptions} /></FilterLineItem>
            <FilterLineItem><Select aria-label="Ordenar equipes" value={sortBy} onChange={event => setSortBy(event.target.value)} options={sortOptions} /></FilterLineItem>
          </FilterLineSection>
          <FilterLineSection align="right">
            <span className="text-xs text-slate-500">{filteredTeams.length} {filteredTeams.length === 1 ? 'equipe' : 'equipes'}</span>
            {hasFilter && <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button>}
          </FilterLineSection>
        </FilterLine>

        {filteredTeams.length === 0 ? (
          <ContentCard><EmptyState icon={Layers} title="Nenhuma equipe encontrada"
            description={hasFilter ? 'Ajuste os filtros para encontrar a equipe.' : 'Crie a primeira equipe para começar.'}
            action={!hasFilter ? <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => openForm(null)}>Nova equipe</Button> : undefined} /></ContentCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredTeams.map(team => {
              const members = team.memberCount || 0;
              const open = () => navigate(teamPath(team, teams));
              return (
                <ContentCard key={team.id} padding="none" className="group flex h-full flex-col overflow-hidden transition-all hover:border-blue-200">
                  <div className="flex flex-1 flex-col gap-3 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-md border ${team.isYouth ? 'border-violet-100 bg-violet-50 text-violet-600' : 'border-blue-100 bg-blue-50 text-blue-600'}`}>
                        {team.isYouth ? <Baby size={14} /> : <Layers size={14} />}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {members <= 2 && <Badge color="warning" size="sm" dot>Poucos membros</Badge>}
                        <Badge color={team.isYouth ? 'purple' : 'info'} size="sm">{team.isYouth ? 'MFC Jovem' : 'Base'}</Badge>
                      </div>
                    </div>
                    <button type="button" className="text-left focus-visible:outline-blue-500" onClick={open}>
                      <h3 className="text-sm font-semibold leading-tight text-slate-900 break-words transition-colors group-hover:text-blue-600">{team.name}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={12} className="shrink-0 text-slate-400" />{team.city} / {team.state}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Users size={12} className="shrink-0 text-slate-400" />{members} {members === 1 ? 'membro' : 'membros'}</p>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/50 p-3">
                    <Button size="xs" className="flex-1" iconRight={<ArrowRight size={12} />} onClick={open}>Abrir equipe</Button>
                    <IconButton variant="ghost" size="xs" aria-label={`Editar ${team.name}`} className="h-8 w-8" onClick={() => openForm(team)}><Pencil size={14} /></IconButton>
                    <IconButton variant="ghost" size="xs" aria-label={`Excluir ${team.name}`} className="h-8 w-8" onClick={() => setDeleteTarget(team)}><Trash2 size={14} className="text-red-500" /></IconButton>
                  </div>
                </ContentCard>
              );
            })}
          </div>
        )}
      </div>

      <TeamFormModal isOpen={showForm} team={editingTeam} onClose={() => { setShowForm(false); setEditingTeam(null); }} onSaved={handleSaved} />

      {blockedDelete ? (
        <Modal isOpen onClose={() => setDeleteTarget(null)} title="Não é possível excluir" size="sm"
          footer={<ModalFooter><Button size="sm" onClick={() => setDeleteTarget(null)}>Entendi</Button></ModalFooter>}>
          <p className="text-[13px] leading-relaxed text-slate-600">
            A equipe <strong className="text-slate-900">{deleteTarget!.name}</strong> tem {deleteTarget!.memberCount} {deleteTarget!.memberCount === 1 ? 'membro vinculado' : 'membros vinculados'}. Desvincule todos antes de excluir.
          </p>
        </Modal>
      ) : (
        <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
          title="Excluir equipe?" message={`A equipe "${deleteTarget?.name}" será excluída. Esta ação não pode ser desfeita.`} confirmLabel="Excluir equipe" variant="danger" />
      )}
    </PageWrapper>
  );
};

export default Teams;
