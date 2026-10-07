import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Shield, MapPin, Plus, Trash2, Settings as SettingsIcon, Building2, Save, CheckCircle2, AlertTriangle, Users, Layers, Power, Pencil,
  DollarSign, UserCog, History, Heart, PhoneCall, ShieldCheck, Loader2, Info,
} from 'lucide-react';
import { api } from '../api';
import { ModuleAction, City, User as UserType } from '../types';
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard, PanelCard, Tabs, Button, IconButton, Input, Select, DatePicker, Modal, ModalFooter, Switch, Badge,
  ConfirmModal, EmptyState, FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch, FilterLineSegmented,
} from '../components/ui';
import { normalizeDirectoryText } from '../utils/memberDirectory';
import { entitySlug, findBySlug } from '../utils/entitySlug';

const BRAZILIAN_STATES = [
  ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'], ['BA', 'Bahia'], ['CE', 'Ceará'], ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'],
  ['GO', 'Goiás'], ['MA', 'Maranhão'], ['MT', 'Mato Grosso'], ['MS', 'Mato Grosso do Sul'], ['MG', 'Minas Gerais'], ['PA', 'Pará'], ['PB', 'Paraíba'],
  ['PR', 'Paraná'], ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'], ['RS', 'Rio Grande do Sul'],
  ['RO', 'Rondônia'], ['RR', 'Roraima'], ['SC', 'Santa Catarina'], ['SP', 'São Paulo'], ['SE', 'Sergipe'], ['TO', 'Tocantins'],
].map(([value, label]) => ({ value, label: `${value} · ${label}` }));

const MODULES = [
  { id: 'dashboard', name: 'Painel', icon: History },
  { id: 'mfcistas', name: 'MFCistas', icon: Users },
  { id: 'equipes', name: 'Equipes Base', icon: Layers },
  { id: 'financeiro', name: 'Tesouraria de Equipes', icon: DollarSign },
  { id: 'livro-caixa', name: 'Livro Caixa', icon: Building2 },
  { id: 'usuarios', name: 'Usuários do Sistema', icon: UserCog },
  { id: 'configuracoes', name: 'Ajustes', icon: SettingsIcon },
  { id: 'encontro-noivos', name: 'Encontro de Noivos', icon: Heart },
  { id: 'nucleacao', name: 'Nucleação', icon: PhoneCall },
];

const ACTIONS: { id: ModuleAction; name: string }[] = [
  { id: 'view', name: 'Visualizar' }, { id: 'create', name: 'Criar' }, { id: 'edit', name: 'Editar' }, { id: 'delete', name: 'Excluir' }, { id: 'launch', name: 'Lançar' },
];

interface RoleDefinition { id: string; name: string; isSystem?: boolean; permissions: { [moduleId: string]: { [action in ModuleAction]?: boolean } }; }
interface FinancialConfig { monthlyPaymentAmount: number; eventTicketDefaultValue: number; currency: string; }

const TABS = [
  { id: 'acessos', label: 'Acessos', icon: Shield },
  { id: 'unidades', label: 'Unidades', icon: MapPin },
  { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
] as const;
type TabId = typeof TABS[number]['id'];
const SETTINGS_BASE = '/configuracoes';
const roleBases = (role: RoleDefinition) => [role.name];
const emptyPermissions = (value: boolean) => Object.fromEntries(MODULES.map(module => [module.id, Object.fromEntries(ACTIONS.map(action => [action.id, value]))]));

const SettingsView: React.FC = () => {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [cities, setCities] = useState<City[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [savedRoles, setSavedRoles] = useState<RoleDefinition[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [financial, setFinancial] = useState<FinancialConfig>({ monthlyPaymentAmount: 50, eventTicketDefaultValue: 100, currency: 'BRL' });

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getCities(), api.getRoles(), api.getUsers().catch(() => []), api.getFinancialConfig()])
      .then(([cityItems, roleItems, userItems, config]) => {
        if (cancelled) return;
        setCities(cityItems); setRoles(roleItems); setSavedRoles(roleItems); setUsers(userItems); setFinancial(config); setError(false);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);

  const activeTab = TABS.find(item => item.id === tab)?.id;
  if (!activeTab) return <Navigate to={`${SETTINGS_BASE}/acessos`} replace />;

  if (loading) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando ajustes…</div></PageWrapper>;
  if (error) return <PageWrapper><ContentCard><EmptyState icon={SettingsIcon} title="Não foi possível carregar os ajustes" description="Confira a conexão e tente novamente."
    action={<Button onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Tentar novamente</Button>} /></ContentCard></PageWrapper>;

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle title="Ajustes" icon={SettingsIcon} description="Perfis de acesso, unidades e regras financeiras." />
        <Tabs<TabId> items={TABS} value={activeTab} onChange={id => navigate(`${SETTINGS_BASE}/${id}`)} label="Seções dos ajustes">
          {activeTab === 'acessos' && <AccessSection roles={roles} setRoles={setRoles} savedRoles={savedRoles} setSavedRoles={setSavedRoles} users={users} />}
          {activeTab === 'unidades' && <CitiesSection cities={cities} setCities={setCities} />}
          {activeTab === 'financeiro' && <FinancialSection config={financial} onSaved={setFinancial} />}
        </Tabs>
      </div>
    </PageWrapper>
  );
};

/* ───────────────────────────── Acessos ───────────────────────────── */

const AccessSection: React.FC<{ roles: RoleDefinition[]; setRoles: React.Dispatch<React.SetStateAction<RoleDefinition[]>>; savedRoles: RoleDefinition[]; setSavedRoles: React.Dispatch<React.SetStateAction<RoleDefinition[]>>; users: UserType[] }> = ({ roles, setRoles, savedRoles, setSavedRoles, users }) => {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const role = findBySlug(roles, params.get('perfil') || undefined, roleBases) || roles[0];
  const selectRole = (item: RoleDefinition) => setParams(prev => { const next = new URLSearchParams(prev); next.set('perfil', entitySlug(item, roles, roleBases)); return next; }, { replace: true });

  const saved = savedRoles.find(item => item.id === role?.id);
  const dirty = !!role && JSON.stringify(role.permissions) !== JSON.stringify(saved?.permissions);
  const usersWithRole = role ? users.filter(user => user.role === role.name).length : 0;
  const query = normalizeDirectoryText(search);
  const modules = MODULES.filter(module => !query || normalizeDirectoryText(module.name).includes(query));

  const setPermissions = (permissions: RoleDefinition['permissions']) => role && setRoles(prev => prev.map(item => item.id === role.id ? { ...item, permissions } : item));
  const toggle = (moduleId: string, action: ModuleAction) => role && !role.isSystem && setPermissions({ ...role.permissions, [moduleId]: { ...role.permissions[moduleId], [action]: !role.permissions[moduleId]?.[action] } });
  const setModule = (moduleId: string, value: boolean) => role && !role.isSystem && setPermissions({ ...role.permissions, [moduleId]: Object.fromEntries(ACTIONS.map(action => [action.id, value])) });

  const nameError = !newName.trim() ? '' : newName.trim().length < 3 ? 'Mínimo de 3 letras.' : roles.some(item => item.name.toLowerCase() === newName.trim().toLowerCase()) ? 'Já existe um perfil com este nome.' : '';

  const createRole = async () => {
    if (!newName.trim() || nameError || creating) return;
    setCreating(true);
    try {
      const created: RoleDefinition = await api.createRole({ name: newName.trim(), permissions: emptyPermissions(false) });
      setRoles(prev => [...prev, created]); setSavedRoles(prev => [...prev, created]);
      setParams(prev => { const next = new URLSearchParams(prev); next.set('perfil', entitySlug(created, [...roles, created], roleBases)); return next; }, { replace: true });
      setShowNew(false); setNewName('');
      toast.success('Perfil criado. Marque as permissões e salve.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível criar o perfil.'); }
    finally { setCreating(false); }
  };

  const save = async () => {
    if (!role || role.isSystem || !dirty || saving) return;
    setSaving(true);
    try {
      const updated: RoleDefinition = await api.updateRole(role.id, { name: role.name, permissions: role.permissions });
      setRoles(prev => prev.map(item => item.id === updated.id ? updated : item)); setSavedRoles(prev => prev.map(item => item.id === updated.id ? updated : item));
      toast.success('Permissões salvas.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível salvar as permissões.'); }
    finally { setSaving(false); }
  };

  const removeRole = async () => {
    if (!role || role.isSystem || deleting) return;
    setDeleting(true);
    try {
      await api.deleteRole(role.id);
      setRoles(prev => prev.filter(item => item.id !== role.id)); setSavedRoles(prev => prev.filter(item => item.id !== role.id));
      setParams(prev => { const next = new URLSearchParams(prev); next.delete('perfil'); return next; }, { replace: true });
      setShowDelete(false);
      toast.success('Perfil excluído.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o perfil.'); }
    finally { setDeleting(false); }
  };

  if (!role) return <ContentCard><EmptyState icon={Shield} title="Nenhum perfil cadastrado" description="Crie o primeiro perfil de acesso." action={<Button size="sm" onClick={() => setShowNew(true)}>Novo perfil</Button>} /></ContentCard>;

  return <div className="grid grid-cols-1 gap-3 lg:grid-cols-[18rem_1fr]">
    <PanelCard title="Perfis de acesso" description={`${roles.length} perfis`} className="self-start"
      action={<Button size="xs" iconLeft={<Plus size={12} />} onClick={() => setShowNew(true)}>Novo perfil</Button>}>
      <ul className="space-y-1" aria-label="Perfis de acesso">
        {roles.map(item => <li key={item.id}>
          <button type="button" aria-current={item.id === role.id} onClick={() => selectRole(item)}
            className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors focus-visible:outline-blue-500 ${item.id === role.id ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-transparent text-slate-700 hover:bg-slate-50'}`}>
            <ShieldCheck size={14} className="shrink-0" /><span className="min-w-0 flex-1 break-words">{item.name}</span>{item.isSystem && <Badge size="sm">Sistema</Badge>}
          </button>
        </li>)}
      </ul>
    </PanelCard>

    <div className="min-w-0 space-y-3">
      <ContentCard padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 break-words">Permissões: {role.name}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{role.isSystem ? 'Perfil de sistema, protegido: tem acesso total e não pode ser alterado.' : `${usersWithRole} ${usersWithRole === 1 ? 'usuário usa' : 'usuários usam'} este perfil.`}</p>
          </div>
          {!role.isSystem && <Button variant="outline" size="sm" iconLeft={<Trash2 size={14} />} onClick={() => setShowDelete(true)}>Excluir perfil</Button>}
        </div>
      </ContentCard>

      <FilterLine>
        <FilterLineSection grow><FilterLineItem grow><FilterLineSearch aria-label="Buscar módulo" value={search} onChange={setSearch} placeholder="Buscar módulo…" /></FilterLineItem></FilterLineSection>
        {!role.isSystem && <FilterLineSection align="right">
          <Button variant="outline" size="sm" onClick={() => setPermissions(emptyPermissions(true))}>Liberar tudo</Button>
          <Button variant="ghost" size="sm" onClick={() => setPermissions(emptyPermissions(false))}>Zerar</Button>
        </FilterLineSection>}
      </FilterLine>

      <ContentCard padding="none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left">
            <thead><tr className="bg-slate-50">
              <th scope="col" className="sticky left-0 z-10 border-b border-slate-100 bg-slate-50 px-3 py-2.5 text-[11px] font-semibold text-slate-500">Módulo</th>
              {ACTIONS.map(action => <th key={action.id} scope="col" className="border-b border-slate-100 px-3 py-2.5 text-center text-[11px] font-semibold text-slate-500">{action.name}</th>)}
              {!role.isSystem && <th scope="col" className="border-b border-slate-100 px-3 py-2.5 text-center text-[11px] font-semibold text-slate-500">Todos</th>}
            </tr></thead>
            <tbody>{modules.map(module => {
              const all = ACTIONS.every(action => role.isSystem || role.permissions[module.id]?.[action.id]);
              return <tr key={module.id} className="hover:bg-slate-50/60">
                <th scope="row" className="sticky left-0 z-10 border-b border-slate-50 bg-white px-3 py-2.5 text-left font-normal">
                  <span className="flex items-center gap-2.5 text-[13px] text-slate-800"><module.icon size={14} className="shrink-0 text-slate-400" />{module.name}</span>
                </th>
                {ACTIONS.map(action => <td key={action.id} className="border-b border-slate-50 px-3 py-2.5 text-center">
                  <Switch size="sm" aria-label={`${module.name}: ${action.name}`} checked={role.isSystem ? true : !!role.permissions[module.id]?.[action.id]} disabled={role.isSystem} onCheckedChange={() => toggle(module.id, action.id)} />
                </td>)}
                {!role.isSystem && <td className="border-b border-slate-50 px-3 py-2.5 text-center"><Switch size="sm" aria-label={`${module.name}: todas as ações`} checked={all} onCheckedChange={value => setModule(module.id, value)} /></td>}
              </tr>;
            })}</tbody>
          </table>
        </div>
        {modules.length === 0 && <EmptyState icon={Shield} title="Nenhum módulo encontrado" description="Ajuste a busca." className="m-3" />}
        {!role.isSystem && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 p-3">
          <p className="text-xs text-slate-500">{dirty ? 'Há alterações não salvas.' : 'Tudo salvo.'}</p>
          <Button size="sm" iconLeft={<Save size={14} />} loading={saving} disabled={!dirty} onClick={save}>Salvar permissões</Button>
        </div>}
      </ContentCard>
    </div>

    <Modal isOpen={showNew} onClose={() => !creating && setShowNew(false)} title="Novo perfil de acesso" size="sm"
      footer={<ModalFooter><Button variant="ghost" size="sm" disabled={creating} onClick={() => setShowNew(false)}>Cancelar</Button><Button size="sm" loading={creating} disabled={!newName.trim() || !!nameError} onClick={createRole}>Criar perfil</Button></ModalFooter>}>
      <div className="space-y-2">
        <p className="text-xs leading-relaxed text-slate-500">Defina o nome do perfil. Em seguida você marca o que ele pode fazer em cada módulo.</p>
        <Input label="Nome do perfil" placeholder="Ex.: Supervisor" value={newName} onChange={event => setNewName(event.target.value)} autoFocus />
        {nameError && <p role="alert" className="text-xs text-red-600">{nameError}</p>}
      </div>
    </Modal>

    {usersWithRole > 0
      ? <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Não é possível excluir" size="sm" footer={<ModalFooter><Button size="sm" onClick={() => setShowDelete(false)}>Entendi</Button></ModalFooter>}>
        <p className="text-[13px] leading-relaxed text-slate-600">O perfil <strong className="text-slate-900">{role.name}</strong> é usado por {usersWithRole} {usersWithRole === 1 ? 'usuário' : 'usuários'}. Troque o perfil deles antes de excluir.</p>
      </Modal>
      : <ConfirmModal isOpen={showDelete} onClose={() => setShowDelete(false)} onConfirm={removeRole} loading={deleting} title="Excluir perfil?" message={`O perfil "${role.name}" será excluído. Esta ação não pode ser desfeita.`} confirmLabel="Excluir perfil" variant="danger" />}
  </div>;
};

/* ───────────────────────────── Unidades ───────────────────────────── */

const CitiesSection: React.FC<{ cities: City[]; setCities: React.Dispatch<React.SetStateAction<City[]>> }> = ({ cities, setCities }) => {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [editing, setEditing] = useState<City | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<City | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const query = normalizeDirectoryText(search);
  const visible = useMemo(() => cities
    .filter(city => !query || normalizeDirectoryText(`${city.name} ${city.uf}`).includes(query))
    .sort((a, b) => sort === 'status' ? Number(b.active !== false) - Number(a.active !== false) || a.name.localeCompare(b.name, 'pt-BR') : a.name.localeCompare(b.name, 'pt-BR')), [cities, query, sort]);
  const activeCount = cities.filter(city => city.active !== false).length;

  const toggle = async (city: City) => {
    if (togglingId) return;
    setTogglingId(city.id);
    try {
      const updated: City = await api.toggleCity(city.id, city.active === false);
      setCities(prev => prev.map(item => item.id === city.id ? updated : item));
      toast.success(updated.active ? 'Unidade ativada.' : 'Unidade inativada.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível alterar a unidade.'); }
    finally { setTogglingId(null); }
  };

  const remove = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.deleteCity(deleteTarget.id);
      setCities(prev => prev.filter(city => city.id !== deleteTarget.id));
      toast.success('Unidade excluída.');
      setDeleteTarget(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível excluir a unidade.'); }
    finally { setDeleting(false); }
  };

  return <div className="space-y-3">
    <StatGrid cols={3}>
      <StatCard title="Unidades" value={cities.length} icon={Building2} color="info" />
      <StatCard title="Ativas" value={activeCount} icon={CheckCircle2} color="success" />
      <StatCard title="Inativas" value={cities.length - activeCount} icon={AlertTriangle} color="warning" />
    </StatGrid>
    <FilterLine>
      <FilterLineSection grow>
        <FilterLineItem grow><FilterLineSearch aria-label="Buscar unidade" value={search} onChange={setSearch} placeholder="Nome ou UF…" /></FilterLineItem>
        <FilterLineItem><FilterLineSegmented value={sort} onChange={value => setSort(String(value))} options={[{ value: 'name', label: 'Por nome' }, { value: 'status', label: 'Por situação' }]} /></FilterLineItem>
      </FilterLineSection>
      <FilterLineSection align="right"><Button size="sm" iconLeft={<Plus size={14} />} onClick={() => { setEditing(null); setShowForm(true); }}>Nova unidade</Button></FilterLineSection>
    </FilterLine>

    {visible.length === 0
      ? <ContentCard><EmptyState icon={MapPin} title="Nenhuma unidade encontrada" description={search ? 'Ajuste a busca.' : 'Cadastre a primeira unidade.'} /></ContentCard>
      : <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map(city => {
        const active = city.active !== false;
        return <ContentCard key={city.id} padding="none" className={`flex h-full flex-col overflow-hidden ${active ? '' : 'bg-slate-50'}`}>
          <div className="flex flex-1 flex-col gap-3 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-md border ${active ? 'border-blue-100 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-100 text-slate-400'}`}><MapPin size={14} /></div>
              <Badge size="sm" dot color={active ? 'success' : 'default'}>{active ? 'Ativa' : 'Inativa'}</Badge>
            </div>
            <div><h3 className="text-sm font-semibold text-slate-900 break-words">{city.name}</h3><p className="mt-1 text-xs text-slate-500">{city.uf}{city.mfcSince ? ` · MFC desde ${new Date(`${city.mfcSince.slice(0, 10)}T12:00:00`).getFullYear()}` : ''}</p></div>
          </div>
          <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/50 p-3">
            <Button variant="outline" size="xs" className="flex-1" iconLeft={<Power size={12} />} loading={togglingId === city.id} disabled={!!togglingId} onClick={() => toggle(city)}>{active ? 'Inativar' : 'Ativar'}</Button>
            <IconButton variant="ghost" size="xs" aria-label={`Editar ${city.name}`} className="h-8 w-8" onClick={() => { setEditing(city); setShowForm(true); }}><Pencil size={14} /></IconButton>
            <IconButton variant="ghost" size="xs" aria-label={`Excluir ${city.name}`} className="h-8 w-8" onClick={() => setDeleteTarget(city)}><Trash2 size={14} className="text-red-500" /></IconButton>
          </div>
        </ContentCard>;
      })}</div>}

    <CityModal isOpen={showForm} city={editing} onClose={() => setShowForm(false)} onSaved={(saved, mode) => setCities(prev => mode === 'created' ? [...prev, saved] : prev.map(city => city.id === saved.id ? saved : city))} />
    <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={remove} loading={deleting} title="Excluir unidade?"
      message={`A unidade ${deleteTarget?.name} será excluída e os dados vinculados a ela podem ser afetados. Esta ação não pode ser desfeita.`} confirmLabel="Excluir unidade" variant="danger" />
  </div>;
};

const CityModal: React.FC<{ isOpen: boolean; city: City | null; onClose: () => void; onSaved: (city: City, mode: 'created' | 'updated') => void }> = ({ isOpen, city, onClose, onSaved }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ name: '', uf: 'SP', mfcSince: today });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => { if (isOpen) setForm(city ? { name: city.name, uf: city.uf, mfcSince: (city.mfcSince || '').slice(0, 10) } : { name: '', uf: 'SP', mfcSince: today }); }, [isOpen, city]); // eslint-disable-line react-hooks/exhaustive-deps
  const invalid = form.name.trim().length < 2;

  const save = async () => {
    if (invalid || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const payload = { name: form.name.trim(), uf: form.uf, mfcSince: form.mfcSince || null };
      const saved: City = city ? await api.updateCity(city.id, payload) : await api.createCity(payload);
      toast.success(city ? 'Unidade atualizada.' : 'Unidade criada.');
      onSaved(saved, city ? 'updated' : 'created');
      onClose();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível salvar a unidade.'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  return <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title={city ? 'Editar unidade' : 'Nova unidade'} size="sm"
    footer={<ModalFooter><Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>Cancelar</Button><Button size="sm" loading={saving} disabled={invalid} onClick={save}>{city ? 'Salvar' : 'Criar unidade'}</Button></ModalFooter>}>
    <div className="space-y-3">
      <Input label="Nome da unidade" placeholder="Ex.: Tatuí" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Estado" value={form.uf} onChange={event => setForm({ ...form, uf: event.target.value })} options={BRAZILIAN_STATES} />
        <DatePicker label="MFC desde" value={form.mfcSince} onChange={value => setForm({ ...form, mfcSince: value || '' })} />
      </div>
    </div>
  </Modal>;
};

/* ───────────────────────────── Financeiro ───────────────────────────── */

const FinancialSection: React.FC<{ config: FinancialConfig; onSaved: (config: FinancialConfig) => void }> = ({ config, onSaved }) => {
  const [form, setForm] = useState({ monthly: String(config.monthlyPaymentAmount ?? ''), quota: String(config.eventTicketDefaultValue ?? '') });
  const [saving, setSaving] = useState(false);
  const monthly = parseFloat(form.monthly.replace(',', '.'));
  const quota = parseFloat(form.quota.replace(',', '.'));
  const errors = { monthly: !(monthly > 0) ? 'Informe um valor maior que zero.' : '', quota: !(quota >= 0) ? 'Informe um valor válido.' : '' };
  const dirty = monthly !== Number(config.monthlyPaymentAmount) || quota !== Number(config.eventTicketDefaultValue);
  const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const save = async () => {
    if (errors.monthly || errors.quota || saving) return;
    setSaving(true);
    try {
      const next = { ...config, monthlyPaymentAmount: monthly, eventTicketDefaultValue: quota };
      await api.updateFinancialConfig(next);
      onSaved(next);
      toast.success('Regras financeiras salvas.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível salvar as regras financeiras.'); }
    finally { setSaving(false); }
  };

  return <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
    <PanelCard title="Regras de mensalidade" description="Valores aplicados em toda a unidade." className="lg:col-span-2">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Input label="Mensalidade por casal ou membro" type="number" min={0} step="0.01" addonLeft="R$" value={form.monthly} onChange={event => setForm({ ...form, monthly: event.target.value })}
            hint="Cobrada uma vez por casal, dividida entre os dois, ou por membro individual ativo." />{errors.monthly && <p role="alert" className="mt-1 text-xs text-red-600">{errors.monthly}</p>}</div>
          <div><Input label="Cota de repasse da unidade" type="number" min={0} step="0.01" addonLeft="R$" value={form.quota} onChange={event => setForm({ ...form, quota: event.target.value })}
            hint="Valor de referência do repasse da unidade ao MFC Nacional." />{errors.quota && <p role="alert" className="mt-1 text-xs text-red-600">{errors.quota}</p>}</div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500">{dirty ? 'Há alterações não salvas.' : 'Tudo salvo.'}</p>
          <Button size="sm" iconLeft={<Save size={14} />} loading={saving} disabled={!dirty || !!errors.monthly || !!errors.quota} onClick={save}>Salvar regras</Button>
        </div>
      </div>
    </PanelCard>
    <PanelCard title="Como a cobrança funciona" icon={Info}>
      <ul className="space-y-2.5 text-xs leading-relaxed text-slate-600">
        <li>Só o titular e o cônjuge pagam. Filhos e demais dependentes ficam na família, sem cobrança.</li>
        <li>No casal, {Number.isFinite(monthly) && monthly > 0 ? `${money(monthly)} é dividido: ${money(monthly / 2)} para cada um` : 'o valor é dividido entre os dois'}.</li>
        <li>Quem está isento ou sem contribuição ativa não entra no valor da família.</li>
        <li>A alteração vale para novos cálculos; recebimentos já lançados não mudam.</li>
      </ul>
    </PanelCard>
  </div>;
};

export default SettingsView;
