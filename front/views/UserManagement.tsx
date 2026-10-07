import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { UserPlus, Users, UserCheck, UserX, Pencil, Trash2, Power, Shield, Loader2 } from 'lucide-react';
import { api } from '../api';
import { BaseTeam, City, Member, User as UserType, UserRoleType } from '../types';
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard, Button, IconButton, Badge, Select, EmptyState, ConfirmModal, GridTable, usePagination,
  FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch, FilterLineSegmented,
} from '../components/ui';
import type { Column } from '../components/ui';
import { UserFormModal } from '../components/UserFormModal';
import { normalizeDirectoryText } from '../utils/memberDirectory';

const currentUserId = () => { try { return JSON.parse(localStorage.getItem('mfc.currentUser') || 'null')?.id as string | undefined; } catch { return undefined; } };

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<UserType | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const me = currentUserId();

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getUsers(), api.getMembers().catch(() => []), api.getCities().catch(() => []), api.getTeams().catch(() => [])])
      .then(([userItems, memberItems, cityItems, teamItems]) => { if (!cancelled) { setUsers(userItems); setMembers(memberItems); setCities(cityItems); setTeams(teamItems); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);

  const isActive = (user: UserType) => user.active !== false;
  const query = normalizeDirectoryText(search);
  const filtered = useMemo(() => users.filter(user =>
    (!query || normalizeDirectoryText(`${user.name} ${user.username} ${user.email}`).includes(query))
    && (roleFilter === 'all' || user.role === roleFilter)
    && (statusFilter === 'all' || (statusFilter === 'active') === isActive(user))
  ), [users, query, roleFilter, statusFilter]);
  const { page, pageSize, paginatedData, setPage, setPageSize } = usePagination(filtered, 15);

  const activeCount = users.filter(isActive).length;
  const adminCount = users.filter(user => user.role === UserRoleType.ADMIN && isActive(user)).length;
  const roleOptions = [{ value: 'all', label: 'Todos os níveis' }, ...Array.from(new Set(users.map(user => user.role))).sort().map(role => ({ value: role, label: role }))];
  const hasFilter = !!query || roleFilter !== 'all' || statusFilter !== 'all';

  const openForm = (user: UserType | null) => { setEditing(user); setShowForm(true); };
  const handleSaved = (saved: UserType, mode: 'created' | 'updated') => setUsers(prev => mode === 'created' ? [saved, ...prev] : prev.map(user => user.id === saved.id ? saved : user));

  const toggleActive = async (user: UserType) => {
    if (togglingId) return;
    setTogglingId(user.id);
    try {
      const updated: UserType = await api.updateUser(user.id, { ...user, active: !isActive(user) });
      setUsers(prev => prev.map(item => item.id === user.id ? updated : item));
      toast.success(isActive(updated) ? 'Acesso reativado.' : 'Acesso inativado: a pessoa não consegue mais entrar.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível alterar o acesso.'); }
    finally { setTogglingId(null); }
  };

  const remove = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.deleteUser(deleteTarget.id);
      setUsers(prev => prev.filter(user => user.id !== deleteTarget.id));
      toast.success('Usuário excluído.');
      setDeleteTarget(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o usuário.'); }
    finally { setDeleting(false); }
  };

  const columns: Column<UserType>[] = [
    { header: 'Usuário', render: user => <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-xs font-semibold text-blue-700">{user.name.slice(0, 2).toUpperCase()}</div>
      <div className="min-w-0"><p className="text-xs font-medium text-slate-800 break-words">{user.name}{user.id === me && <span className="ml-1.5 text-[11px] font-normal text-blue-600">(você)</span>}</p>
        <p className="mt-0.5 text-[11px] text-slate-500 break-all">@{user.username}{user.email ? ` · ${user.email}` : ''}</p></div></div> },
    { header: 'Nível de acesso', render: user => <Badge size="sm" icon={<Shield size={10} />} color={user.role === UserRoleType.ADMIN ? 'primary' : 'default'}>{user.role}</Badge> },
    { header: 'Unidade / equipe', render: user => { const city = cities.find(item => item.id === user.cityId); const team = teams.find(item => item.id === user.teamId);
      return <div><p className="text-xs text-slate-700">{city ? `${city.name} / ${city.uf}` : 'Sem unidade'}</p><p className="mt-0.5 text-[11px] text-slate-500">{team?.name || 'Sem equipe'}</p></div>; } },
    { header: 'Situação', render: user => <Badge size="sm" dot color={isActive(user) ? 'success' : 'default'}>{isActive(user) ? 'Ativo' : 'Inativo'}</Badge> },
    { header: 'Ações', render: user => { const self = user.id === me; return <div className="flex items-center gap-1 sm:justify-end">
      <IconButton variant="ghost" size="xs" aria-label={`Editar ${user.name}`} onClick={event => { event.stopPropagation(); openForm(user); }}><Pencil size={14} /></IconButton>
      <IconButton variant="ghost" size="xs" aria-label={`${isActive(user) ? 'Inativar' : 'Reativar'} ${user.name}`} title={self ? 'Você não pode inativar o próprio acesso' : isActive(user) ? 'Inativar acesso' : 'Reativar acesso'} disabled={self || !!togglingId}
        onClick={event => { event.stopPropagation(); toggleActive(user); }}><Power size={14} className={isActive(user) ? 'text-emerald-600' : 'text-slate-400'} /></IconButton>
      <IconButton variant="ghost" size="xs" aria-label={`Excluir ${user.name}`} title={self ? 'Você não pode excluir o próprio acesso' : 'Excluir usuário'} disabled={self}
        onClick={event => { event.stopPropagation(); setDeleteTarget(user); }}><Trash2 size={14} className={self ? 'text-slate-300' : 'text-red-500'} /></IconButton>
    </div>; } },
  ];

  if (loading) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando usuários…</div></PageWrapper>;

  if (error) return <PageWrapper><ContentCard><EmptyState icon={Users} title="Não foi possível carregar os usuários" description="Confira a conexão e tente novamente."
    action={<Button onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Tentar novamente</Button>} /></ContentCard></PageWrapper>;

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle title="Usuários" icon={Users} description="Quem pode entrar e administrar a plataforma."
          action={<Button size="sm" iconLeft={<UserPlus size={14} />} onClick={() => openForm(null)}>Novo usuário</Button>} />

        <StatGrid cols={3}>
          <StatCard title="Usuários" value={users.length} icon={Users} color="info" />
          <StatCard title="Ativos" value={activeCount} icon={UserCheck} color="success" description={`${adminCount} ${adminCount === 1 ? 'administrador' : 'administradores'}`} />
          <StatCard title="Inativos" value={users.length - activeCount} icon={UserX} color="warning" description="Sem acesso ao sistema" />
        </StatGrid>

        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem grow><FilterLineSearch aria-label="Buscar usuário" value={search} onChange={setSearch} placeholder="Nome, login ou e-mail…" /></FilterLineItem>
            <FilterLineItem><Select aria-label="Nível de acesso" value={roleFilter} onChange={event => setRoleFilter(event.target.value)} options={roleOptions} /></FilterLineItem>
            <FilterLineItem><FilterLineSegmented value={statusFilter} onChange={value => setStatusFilter(String(value))} options={[{ value: 'all', label: 'Todos' }, { value: 'active', label: 'Ativos' }, { value: 'inactive', label: 'Inativos' }]} /></FilterLineItem>
          </FilterLineSection>
          <FilterLineSection align="right">
            <span className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'usuário' : 'usuários'}</span>
            {hasFilter && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); }}>Limpar filtros</Button>}
          </FilterLineSection>
        </FilterLine>

        <ContentCard padding="none">
          <GridTable columns={columns} data={paginatedData} keyExtractor={user => user.id} noDesktopCard onRowClick={user => openForm(user)}
            emptyMessage={<EmptyState icon={Users} title="Nenhum usuário encontrado" description={hasFilter ? 'Ajuste a busca ou os filtros.' : 'Crie o primeiro acesso.'} action={!hasFilter ? <Button size="sm" onClick={() => openForm(null)}>Novo usuário</Button> : undefined} />}
            pagination={{ total: filtered.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }} />
        </ContentCard>
      </div>

      <UserFormModal isOpen={showForm} user={editing} users={users} members={members} cities={cities} teams={teams} onClose={() => setShowForm(false)} onSaved={handleSaved} />

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={remove} loading={deleting} title="Excluir usuário?"
        message={`${deleteTarget?.name} perde o acesso de forma permanente. Para bloquear só por um tempo, use “Inativar”.`} confirmLabel="Excluir usuário" variant="danger" />
    </PageWrapper>
  );
};

export default UserManagement;
