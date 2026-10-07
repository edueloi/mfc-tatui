
import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  MapPin, 
  Plus, 
  Trash2, 
  Search, 
  Lock, 
  Globe, 
  Settings as SettingsIcon, 
  Filter, 
  X, 
  Building2, 
  Save, 
  ChevronDown,
  Calendar,
  Gift,
  AlertTriangle,
  Users,
  Layers,
  Power,
  Edit3,
  Clock,
  History,
  CheckCircle2,
  ShieldCheck,
  Eye,
  Settings,
  DollarSign,
  UserCog,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Percent,
  BadgeDollarSign,
  Bell,
  Palette,
  Info,
  Heart,
  PhoneCall
} from 'lucide-react';
import { api } from '../api';
import { UserRoleType, ModuleAction, City } from '../types';
import { 
  PageWrapper, 
  SectionTitle, 
  StatGrid, 
  ContentCard, 
  Button, 
  IconButton, 
  Input, 
  Select, 
  Modal, 
  ModalFooter,
  Switch,
  Badge,
  ConfirmModal
} from '../components/ui';
import { StatCard } from '../components/ui/StatCard';
import { cn } from '../src/lib/utils';
import toast from 'react-hot-toast';

const BRAZILIAN_STATES = [
  { value: 'AC', label: 'Acre' }, { value: 'AL', label: 'Alagoas' }, { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' }, { value: 'BA', label: 'Bahia' }, { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' }, { value: 'ES', label: 'Espírito Santo' }, { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' }, { value: 'MT', label: 'Mato Grosso' }, { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' }, { value: 'PA', label: 'Pará' }, { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' }, { value: 'PE', label: 'Pernambuco' }, { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' }, { value: 'RN', label: 'Rio Grande do Norte' }, { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' }, { value: 'RR', label: 'Roraima' }, { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' }, { value: 'SE', label: 'Sergipe' }, { value: 'TO', label: 'Tocantins' }
];

const MODULES = [
  { id: 'dashboard', name: 'Dashboard', icon: History },
  { id: 'mfcistas', name: 'Membros (MFCistas)', icon: Users },
  { id: 'equipes', name: 'Equipes Base', icon: Layers },
  { id: 'financeiro', name: 'Tesouraria de Equipes', icon: DollarSign },
  { id: 'livro-caixa', name: 'Livro Caixa Geral', icon: Building2 },
  { id: 'usuarios', name: 'Usuários do Sistema', icon: UserCog },
  { id: 'configuracoes', name: 'Configurações', icon: Settings },
  { id: 'encontro-noivos', name: 'Encontro de Noivos', icon: Heart },
  { id: 'nucleacao', name: 'Nucleação', icon: PhoneCall },
];

const ACTIONS: { id: ModuleAction; name: string }[] = [
  { id: 'view', name: 'Visualizar' },
  { id: 'create', name: 'Criar' },
  { id: 'edit', name: 'Editar' },
  { id: 'delete', name: 'Excluir' },
  { id: 'launch', name: 'Lançar' },
];

interface RoleDefinition {
  id: string;
  name: string;
  isSystem?: boolean;
  permissions: {
    [moduleId: string]: {
      [actionId in ModuleAction]: boolean;
    };
  };
}

interface FinancialConfig {
  monthlyPaymentAmount: number;
  eventTicketDefaultValue: number;
  currency: string;
}

interface AdvancedFinanceConfig {
  dueDay: number;
  graceDay: number;
  repassePercentage: number;
  allowPartialPayment: boolean;
  autoGenerateMonthlyCharges: boolean;
}

const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'geral' | 'permissoes' | 'cidades' | 'financeiro'>('geral');
  const [citySearch, setCitySearch] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  
  // State para Permissões
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [permissionSearch, setPermissionSearch] = useState('');

  // State para Configurações Gerais
  const [generalSettings, setGeneralSettings] = useState({
    institutionName: 'Movimento Familiar Cristão',
    logoUrl: '',
    primaryColor: '#2563eb',
    supportEmail: 'contato@mfc.org.br',
    notifications: true,
    maintenanceMode: false
  });

  // State para Configurações Financeiras
  const [financialConfig, setFinancialConfig] = useState<FinancialConfig>({
    monthlyPaymentAmount: 50.00,
    eventTicketDefaultValue: 100.00,
    currency: 'BRL'
  });
  
  const [citySortBy, setCitySortBy] = useState<'name' | 'status'>('name');
  const [advancedFinance, setAdvancedFinance] = useState<AdvancedFinanceConfig>({
    dueDay: 10,
    graceDay: 5,
    repassePercentage: 25,
    allowPartialPayment: true,
    autoGenerateMonthlyCharges: true
  });

  useEffect(() => {
    api.getCities().then(setCities).catch(() => setCities([]));
    api.getRoles().then(setRoles).catch(() => setRoles([]));
    
    api.getFinancialConfig()
      .then(setFinancialConfig)
      .catch(() => {});

    const storedAdvanced = localStorage.getItem('mfc.settings.advancedFinance');
    if (storedAdvanced) {
      try {
        setAdvancedFinance(JSON.parse(storedAdvanced));
      } catch (_) {}
    }

    const storedGeneral = localStorage.getItem('mfc.settings.general');
    if (storedGeneral) {
      try {
        setGeneralSettings(prev => ({ ...prev, ...JSON.parse(storedGeneral) }));
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    if (roles.length > 0 && !selectedRoleId) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  const [showCityModal, setShowCityModal] = useState(false);
  const [cityToDelete, setCityToDelete] = useState<City | null>(null);
  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  const [newCity, setNewCity] = useState({ name: '', uf: 'SP', mfcSince: new Date().toISOString().split('T')[0] });

  const filteredCities = cities
    .filter(c =>
      c.name.toLowerCase().includes(citySearch.toLowerCase()) ||
      c.uf.toLowerCase().includes(citySearch.toLowerCase())
    )
    .sort((a, b) => {
      if (citySortBy === 'status') return Number(Boolean(b.active)) - Number(Boolean(a.active));
      return a.name.localeCompare(b.name);
    });

  const activeCitiesCount = cities.filter((city) => city.active !== false).length;

  const filteredModules = MODULES.filter((module) =>
    module.name.toLowerCase().includes(permissionSearch.toLowerCase())
  );

  const handleSaveRole = () => {
    if (!newRoleName.trim()) return;
    api.createRole({ 
      name: newRoleName, 
      permissions: MODULES.reduce((acc, mod) => ({
        ...acc,
        [mod.id]: ACTIONS.reduce((actAcc, act) => ({ ...actAcc, [act.id]: false }), {})
      }), {})
    })
      .then((created: RoleDefinition) => {
        setRoles([...roles, created]);
        setSelectedRoleId(created.id);
        setShowRoleModal(false);
        setNewRoleName('');
        toast.success('Perfil criado com sucesso!');
      })
      .catch(() => toast.error('Erro ao criar perfil.'));
  };

  const togglePermission = (moduleId: string, actionId: ModuleAction) => {
    const role = roles.find(r => r.id === selectedRoleId);
    if (!role || role.isSystem) return;

    setRoles(roles.map(r => {
      if (r.id === selectedRoleId) {
        return {
          ...r,
          permissions: {
            ...r.permissions,
            [moduleId]: {
              ...r.permissions[moduleId],
              [actionId]: !r.permissions[moduleId]?.[actionId]
            }
          }
        };
      }
      return r;
    }));
  };

  const handleSaveRolePermissions = () => {
    const role = roles.find(r => r.id === selectedRoleId);
    if (!role || role.isSystem) return;
    toast.promise(
      api.updateRole(role.id, { name: role.name, permissions: role.permissions })
        .then((updated: RoleDefinition) => {
          setRoles(roles.map(r => r.id === updated.id ? updated : r));
        }),
      {
        loading: 'Salvando permissões...',
        success: 'Permissões salvas! ✅',
        error: 'Erro ao salvar permissões.'
      }
    );
  };

  const handleSaveCity = () => {
    const cityNameTrimmed = newCity.name.trim();
    if (!cityNameTrimmed) return;

    const promise = editingCityId
      ? api.updateCity(editingCityId, { name: cityNameTrimmed, uf: newCity.uf, mfcSince: newCity.mfcSince })
      : api.createCity({ name: cityNameTrimmed, uf: newCity.uf, mfcSince: newCity.mfcSince });

    toast.promise(
      promise.then((res: any) => {
        if (editingCityId) {
          setCities(cities.map(c => c.id === editingCityId ? res : c));
        } else {
          setCities([...cities, res]);
        }
        setShowCityModal(false);
      }),
      {
        loading: editingCityId ? 'Atualizando unidade...' : 'Criando unidade...',
        success: editingCityId ? 'Unidade atualizada! 📍' : 'Unidade criada! 🎉',
        error: 'Erro ao salvar unidade.'
      }
    );
  };

  const handleToggleCity = (city: City) => {
    api.toggleCity(city.id, !city.active)
      .then((updated: City) => {
        setCities(cities.map(c => c.id === city.id ? updated : c));
        toast.success(`Unidade ${updated.active ? 'ativada' : 'inativada'}!`);
      });
  };

  const handleConfirmDeleteCity = () => {
    if (!cityToDelete) return;
    toast.promise(
      api.deleteCity(cityToDelete.id).then(() => {
        setCities(cities.filter(c => c.id !== cityToDelete.id));
        setCityToDelete(null);
      }),
      {
        loading: 'Excluindo unidade...',
        success: 'Unidade excluída! 🗑️',
        error: 'Erro ao excluir unidade.'
      }
    );
  };

  const handleSaveGeneral = () => {
    localStorage.setItem('mfc.settings.general', JSON.stringify(generalSettings));
    toast.success('Configurações gerais salvas!');
  };

  const handleSaveFinancial = () => {
    toast.promise(
      api.updateFinancialConfig(financialConfig).then(() => {
        localStorage.setItem('mfc.settings.advancedFinance', JSON.stringify(advancedFinance));
      }),
      {
        loading: 'Salvando configurações financeiras...',
        success: 'Configurações financeiras salvas! 💰',
        error: 'Erro ao salvar configurações financeiras.'
      }
    );
  };

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  return (
    <PageWrapper>
      <SectionTitle 
        title="Configurações do Sistema"
        description="Gerencie permissões, unidades e regras financeiras da plataforma."
        icon={SettingsIcon}
      />

      <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/60 mb-8 max-w-fit">
        {[
          { id: 'geral', label: 'Geral', icon: Settings },
          { id: 'permissoes', label: 'Acessos', icon: Shield },
          { id: 'cidades', label: 'Unidades', icon: MapPin },
          { id: 'financeiro', label: 'Financeiro', icon: DollarSign }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === tab.id 
                ? "bg-white text-blue-600 shadow-sm border border-slate-100" 
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-2 space-y-6">
            <ContentCard title="Identidade da Instituição">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Input 
                  label="Nome da Instituição"
                  value={generalSettings.institutionName}
                  onChange={e => setGeneralSettings({...generalSettings, institutionName: e.target.value})}
                  iconLeft={<Building2 className="w-4 h-4 text-slate-400" />}
                  wrapperClassName="sm:col-span-2"
                />
                <Input 
                  label="Logo URL"
                  value={generalSettings.logoUrl}
                  onChange={e => setGeneralSettings({...generalSettings, logoUrl: e.target.value})}
                  placeholder="https://..."
                  iconLeft={<Globe className="w-4 h-4 text-slate-400" />}
                />
                <Input 
                  label="E-mail de Suporte"
                  type="email"
                  value={generalSettings.supportEmail}
                  onChange={e => setGeneralSettings({...generalSettings, supportEmail: e.target.value})}
                />
              </div>
            </ContentCard>

            <ContentCard title="Preferências do Sistema">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Notificações por E-mail</p>
                      <p className="text-xs text-slate-400 font-bold italic">Enviar alertas automáticos sobre lançamentos e prazos.</p>
                    </div>
                  </div>
                  <Switch 
                    checked={generalSettings.notifications}
                    onCheckedChange={v => setGeneralSettings({...generalSettings, notifications: v})}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Modo Manutenção</p>
                      <p className="text-xs text-slate-400 font-bold italic">Bloquear acesso de usuários não-administradores.</p>
                    </div>
                  </div>
                  <Switch 
                    checked={generalSettings.maintenanceMode}
                    onCheckedChange={v => setGeneralSettings({...generalSettings, maintenanceMode: v})}
                  />
                </div>
              </div>
            </ContentCard>
            
            <div className="flex justify-end">
              <Button 
                onClick={handleSaveGeneral}
                iconLeft={<Save className="w-4 h-4" />}
                className="px-10"
              >
                Salvar Alterações
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <ContentCard title="Resumo do Ambiente">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Versão</span>
                  <Badge color="default">v2.4.0-stable</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Ambiente</span>
                  <Badge color="success">Produção</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Database</span>
                  <span className="font-black text-slate-700">PostgreSQL Cloud</span>
                </div>
              </div>
            </ContentCard>

            <ContentCard title="Personalização Visual">
               <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-slate-200" style={{ backgroundColor: generalSettings.primaryColor }} />
                    <Input 
                      value={generalSettings.primaryColor}
                      onChange={e => setGeneralSettings({...generalSettings, primaryColor: e.target.value})}
                      placeholder="#000000"
                      size="sm"
                      wrapperClassName="flex-1"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold italic">Cor principal utilizada em botões e destaques.</p>
               </div>
            </ContentCard>
          </div>
        </div>
      )}

      {activeTab === 'permissoes' && (
        <div className="flex flex-col lg:flex-row gap-8 animate-in slide-in-from-left-4 duration-500">
          <div className="lg:w-80 space-y-4 shrink-0">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perfis de Acesso</h3>
              <IconButton 
                onClick={() => setShowRoleModal(true)}
                variant="primary"
                size="sm"
              >
                <Plus className="w-4 h-4" />
              </IconButton>
            </div>
            
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-3 space-y-2">
              {roles.map(role => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={cn(
                    "w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all group",
                    selectedRoleId === role.id 
                      ? "bg-blue-600 text-white shadow-xl shadow-blue-100" 
                      : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                    selectedRoleId === role.id ? "bg-white/20" : "bg-slate-100 text-slate-400 group-hover:bg-blue-50"
                  )}>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="flex-1 text-left truncate">{role.name}</span>
                  {selectedRoleId === role.id && <ChevronRight className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          <ContentCard padding="none" className="flex-1 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Permissões: {selectedRole?.name}</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1 italic">
                  {selectedRole?.isSystem ? 'Perfil de sistema (Protegido)' : 'Configure as ações permitidas para este perfil'}
                </p>
              </div>
              {!selectedRole?.isSystem && (
                <IconButton 
                  variant="danger" 
                  onClick={() => {}} 
                >
                  <Trash2 className="w-5 h-5" />
                </IconButton>
              )}
            </div>

            <div className="px-8 py-4 border-b border-slate-50 bg-white">
              <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <Input 
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                  placeholder="Buscar módulo..."
                  iconLeft={<Search className="w-4 h-4 text-slate-300" />}
                  wrapperClassName="max-w-md w-full"
                />
                {!selectedRole?.isSystem && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="xs" onClick={() => {
                      setRoles(roles.map((r) => r.id === selectedRoleId ? ({ ...r, permissions: Object.fromEntries(MODULES.map((m) => [m.id, { view: true, create: true, edit: true, delete: true, launch: true }])) as any }) : r));
                    }}>Liberar Tudo</Button>
                    <Button variant="ghost" size="xs" onClick={() => {
                      setRoles(roles.map((r) => r.id === selectedRoleId ? ({ ...r, permissions: Object.fromEntries(MODULES.map((m) => [m.id, { view: false, create: false, edit: false, delete: false, launch: false }])) as any }) : r));
                    }}>Zerar</Button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 sticky left-0 bg-slate-50/50 z-20">Módulo / Tela</th>
                    {ACTIONS.map(action => (
                      <th key={action.id} className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">{action.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredModules.map(module => (
                    <tr key={module.id} className="hover:bg-blue-50/10 transition-colors group">
                      <td className="px-10 py-5 sticky left-0 bg-white group-hover:bg-blue-50/10 z-10 border-r border-slate-50">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center transition-colors group-hover:bg-blue-600 group-hover:text-white shadow-sm border border-slate-100">
                            <module.icon className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-black text-slate-700 tracking-tight">{module.name}</span>
                        </div>
                      </td>
                      {ACTIONS.map(action => {
                        const isAllowed = selectedRole?.permissions[module.id]?.[action.id] || false;
                        return (
                          <td key={action.id} className="px-6 py-5 text-center">
                            <button 
                              disabled={selectedRole?.isSystem}
                              onClick={() => togglePermission(module.id, action.id)}
                              className={cn(
                                "p-2.5 rounded-2xl transition-all border shadow-sm",
                                isAllowed 
                                  ? "text-emerald-600 bg-emerald-50 border-emerald-100" 
                                  : "text-slate-200 bg-slate-50 border-slate-100 hover:bg-slate-100",
                                selectedRole?.isSystem ? "cursor-not-allowed opacity-50" : "cursor-pointer active:scale-95"
                              )}
                            >
                              {isAllowed ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {!selectedRole?.isSystem && (
              <div className="p-8 bg-slate-50/50 border-t border-slate-50 flex justify-end">
                <Button 
                  onClick={handleSaveRolePermissions}
                  iconLeft={<Save className="w-4 h-4" />}
                >
                  Salvar Configurações
                </Button>
              </div>
            )}
          </ContentCard>
        </div>
      )}

      {activeTab === 'cidades' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
          <StatGrid cols={3}>
            <StatCard title="Total Unidades" value={cities.length} icon={Building2} color="info" />
            <StatCard title="Ativas" value={activeCitiesCount} icon={CheckCircle2} color="success" />
            <StatCard title="Inativas" value={cities.length - activeCitiesCount} icon={AlertTriangle} color="warning" />
          </StatGrid>

          <div className="flex flex-col lg:flex-row gap-4 px-1 lg:px-0">
            <Select 
              value={citySortBy}
              onChange={(e) => setCitySortBy(e.target.value as any)}
              options={[
                { value: 'name', label: 'Ordenar por Nome' },
                { value: 'status', label: 'Ordenar por Status' }
              ]}
              wrapperClassName="lg:w-64"
            />
            <Input 
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              placeholder="Pesquisar unidade..."
              iconLeft={<Search className="w-4 h-4 text-slate-300" />}
              wrapperClassName="flex-1"
            />
            <Button 
              onClick={() => {
                setEditingCityId(null);
                setNewCity({ name: '', uf: 'SP', mfcSince: new Date().toISOString().split('T')[0] });
                setShowCityModal(true);
              }}
              iconLeft={<Plus className="w-5 h-5" />}
            >
              Nova Unidade
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCities.map(city => (
              <div 
                key={city.id} 
                className={cn(
                  "bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-2xl transition-all relative overflow-hidden",
                  !city.active && "opacity-70 bg-slate-50/50"
                )}
              >
                <div className="flex items-center justify-between mb-8">
                  <div className={cn(
                    "w-16 h-16 rounded-3xl flex items-center justify-center transition-all shadow-inner border",
                    city.active ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-100 text-slate-400 border-slate-200"
                  )}>
                    <MapPin className="w-8 h-8" />
                  </div>
                  <div className="flex gap-1.5">
                    <IconButton 
                      variant={city.active ? "success" : "ghost"}
                      onClick={() => handleToggleCity(city)}
                      title={city.active ? "Inativar" : "Ativar"}
                    >
                      <Power className="w-5 h-5" />
                    </IconButton>
                    <IconButton 
                      variant="danger"
                      onClick={() => setCityToDelete(city)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </IconButton>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black tracking-tight text-slate-900">{city.name}</h3>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Unidade {city.uf}</p>
                </div>
                <div className="mt-10 pt-6 border-t border-slate-50 flex items-center justify-between">
                   <Badge color={city.active ? 'success' : 'default'}>
                     {city.active ? 'Ativo' : 'Inativo'}
                   </Badge>
                   <Button 
                    variant="ghost" 
                    size="xs"
                    onClick={() => {
                      setEditingCityId(city.id);
                      setNewCity({ name: city.name, uf: city.uf, mfcSince: city.mfcSince || '' });
                      setShowCityModal(true);
                    }}
                    iconLeft={<Edit3 className="w-3.5 h-3.5" />}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'financeiro' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right-4 duration-500">
          <div className="lg:col-span-2 space-y-6">
            <ContentCard title="Regras de Mensalidade">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <Input 
                  label="Valor mensal por casal ou membro"
                  type="number"
                  addonLeft="R$"
                  value={financialConfig.monthlyPaymentAmount}
                  onChange={e => setFinancialConfig({...financialConfig, monthlyPaymentAmount: parseFloat(e.target.value) || 0})}
                  hint="Cobrado uma vez por casal ou para cada membro individual com mensalidade ativa."
                />
                <Input 
                  label="Cota de Repasse (Unidade)"
                  type="number"
                  addonLeft="R$"
                  value={financialConfig.eventTicketDefaultValue}
                  onChange={e => setFinancialConfig({...financialConfig, eventTicketDefaultValue: parseFloat(e.target.value) || 0})}
                  hint="Referência para o repasse fixo da unidade ao MFC Nacional."
                />
              </div>
            </ContentCard>

            <ContentCard title="Automação e Prazos">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <Input 
                  label="Dia Vencimento"
                  type="number"
                  min={1} max={31}
                  value={advancedFinance.dueDay}
                  onChange={e => setAdvancedFinance({...advancedFinance, dueDay: Number(e.target.value)})}
                  iconLeft={<Calendar className="w-4 h-4 text-slate-400" />}
                />
                <Input 
                  label="Tolerância (Dias)"
                  type="number"
                  min={0}
                  value={advancedFinance.graceDay}
                  onChange={e => setAdvancedFinance({...advancedFinance, graceDay: Number(e.target.value)})}
                  iconLeft={<Clock className="w-4 h-4 text-slate-400" />}
                />
                <Input 
                  label="Percentual Repasse"
                  type="number"
                  addonRight="%"
                  value={advancedFinance.repassePercentage}
                  onChange={e => setAdvancedFinance({...advancedFinance, repassePercentage: Number(e.target.value)})}
                />
              </div>
            </ContentCard>

            <div className="flex justify-end">
               <Button onClick={handleSaveFinancial} iconLeft={<Save className="w-4 h-4" />}>
                 Atualizar Regras Financeiras
               </Button>
            </div>
          </div>

          <div className="space-y-6">
            <ContentCard title="Políticas de Cobrança">
              <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-800">Regra das famílias</p>
                <p className="mt-1 text-xs leading-relaxed text-blue-700">Filhos e demais dependentes não entram na mensalidade. A cobrança considera o casal ou o membro individual que não esteja isento.</p>
              </div>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Pagamento Parcial</p>
                    <p className="text-[9px] text-slate-400 font-bold italic">Permitir abater valores menores que a mensalidade.</p>
                  </div>
                  <Switch 
                    checked={advancedFinance.allowPartialPayment}
                    onCheckedChange={v => setAdvancedFinance({...advancedFinance, allowPartialPayment: v})}
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Geração Automática</p>
                    <p className="text-[9px] text-slate-400 font-bold italic">Criar novas cobranças no início de cada mês.</p>
                  </div>
                  <Switch 
                    checked={advancedFinance.autoGenerateMonthlyCharges}
                    onCheckedChange={v => setAdvancedFinance({...advancedFinance, autoGenerateMonthlyCharges: v})}
                  />
                </div>
              </div>
            </ContentCard>

            <div className="p-6 bg-blue-600 rounded-[2.5rem] text-white shadow-xl shadow-blue-100">
               <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                   <Info className="w-5 h-5 text-white" />
                 </div>
                 <h4 className="font-black uppercase tracking-widest text-[11px]">Dica Financeira</h4>
               </div>
               <p className="text-xs font-bold leading-relaxed opacity-90">
                 As configurações de mensalidade são aplicadas globalmente na unidade. Alterações aqui afetarão novos lançamentos automáticos.
               </p>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <Modal 
        isOpen={showRoleModal} 
        onClose={() => setShowRoleModal(false)}
        title="Novo Perfil de Acesso"
        size="md"
      >
        <div className="space-y-6">
          <p className="text-sm text-slate-500 font-bold italic">Defina o nome do novo nível de acesso. Você poderá configurar as permissões detalhadas logo após a criação.</p>
          <Input 
            label="Nome do Perfil"
            placeholder="Ex: Supervisor, Tesoureiro Junior..."
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            autoFocus
          />
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowRoleModal(false)}>Cancelar</Button>
          <Button onClick={handleSaveRole} disabled={!newRoleName.trim()}>Criar e Configurar</Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={showCityModal}
        onClose={() => setShowCityModal(false)}
        title={editingCityId ? 'Editar Unidade' : 'Nova Unidade'}
        size="md"
      >
        <div className="space-y-6">
          <Input 
            label="Nome da Unidade"
            placeholder="Ex: Tatuí"
            value={newCity.name}
            onChange={e => setNewCity({...newCity, name: e.target.value})}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Estado (UF)"
              value={newCity.uf}
              onChange={e => setNewCity({...newCity, uf: e.target.value})}
              options={BRAZILIAN_STATES}
            />
            <Input 
              label="MFC Desde"
              type="date"
              value={newCity.mfcSince}
              onChange={e => setNewCity({...newCity, mfcSince: e.target.value})}
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowCityModal(false)}>Cancelar</Button>
          <Button onClick={handleSaveCity} iconLeft={<Save className="w-4 h-4" />}>
            {editingCityId ? 'Salvar Alterações' : 'Adicionar Unidade'}
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmModal 
        isOpen={!!cityToDelete}
        onClose={() => setCityToDelete(null)}
        onConfirm={handleConfirmDeleteCity}
        title="Excluir Unidade"
        message={`Tem certeza que deseja excluir a unidade ${cityToDelete?.name}? Todos os dados vinculados a esta unidade poderão ser afetados.`}
        confirmLabel="Sim, Excluir Permanente"
        variant="danger"
      />

    </PageWrapper>
  );
};

export default SettingsView;
