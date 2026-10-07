
import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserPlus, 
  Search, 
  Shield, 
  X, 
  Check, 
  Key, 
  Mail, 
  User as UserIcon,
  ShieldCheck,
  Save,
  Trash2,
  Edit,
  Users as UsersIcon,
  Eye,
  EyeOff
} from 'lucide-react';
import { api } from '../api';
import { UserRoleType, User as UserType, Member, City } from '../types';
import { 
  PageWrapper, 
  SectionTitle, 
  ContentCard, 
  Button, 
  IconButton, 
  Input, 
  Select, 
  Modal, 
  ModalFooter,
  ConfirmModal
} from '../components/ui';
import { cn } from '../src/lib/utils';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'manual' | 'mfcista'>('mfcista');
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; userId: string; userName: string }>({ show: false, userId: '', userName: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: UserRoleType.USUARIO,
    cityId: '1'
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => setUsers([]));
    api.getMembers().then(setMembers).catch(() => setMembers([]));
    api.getCities().then(setCities).catch(() => setCities([]));
  }, []);

  useEffect(() => {
    if (cities.length > 0) {
      setFormData(prev => ({ ...prev, cityId: prev.cityId || cities[0].id }));
    }
  }, [cities]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const handleLinkMember = (member: any) => {
    setFormData({
      ...formData,
      name: member.name,
      email: member.email || '',
      username: member.nickname?.toLowerCase().replace(/\s/g, '') || member.name.split(' ')[0].toLowerCase()
    });
    setActiveTab('manual');
  };

  const handleSave = () => {
    if (!formData.username || !formData.name || (!editingUserId && !formData.password)) {
      alert("Por favor, preencha os campos obrigatórios.");
      return;
    }

    if (editingUserId) {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        username: formData.username,
        role: formData.role,
        cityId: formData.cityId
      };
      
      if (formData.password) {
        payload.password = formData.password;
      }

      api.updateUser(editingUserId, payload)
        .then((updated: UserType) => {
          setUsers(users.map(u => u.id === editingUserId ? updated : u));
          setShowModal(false);
          setFormData({ name: '', email: '', username: '', password: '', role: UserRoleType.USUARIO, cityId: formData.cityId });
          setEditingUserId(null);
        })
        .catch(() => {
          alert('Erro ao atualizar usuário');
        });
    } else {
      api.createUser({
        name: formData.name,
        email: formData.email,
        username: formData.username,
        password: formData.password,
        role: formData.role,
        cityId: formData.cityId
      })
        .then((newUser: UserType) => {
          setUsers([newUser, ...users]);
          setShowModal(false);
          setFormData({ name: '', email: '', username: '', password: '', role: UserRoleType.USUARIO, cityId: formData.cityId });
        })
        .catch(() => {
          alert('Erro ao criar usuário');
        });
    }
  };

  const handleEdit = (user: UserType) => {
    setFormData({
      name: user.name,
      email: user.email,
      username: user.username,
      password: '',
      role: user.role,
      cityId: user.cityId
    });
    setEditingUserId(user.id);
    setActiveTab('manual');
    setShowModal(true);
  };

  const handleDelete = (user: UserType) => {
    setDeleteConfirm({ show: true, userId: user.id, userName: user.name });
  };

  const confirmDelete = () => {
    api.deleteUser(deleteConfirm.userId)
      .then(() => {
        setUsers(users.filter(u => u.id !== deleteConfirm.userId));
        setDeleteConfirm({ show: false, userId: '', userName: '' });
      })
      .catch((error) => {
        console.error('Erro ao deletar usuário:', error);
        setDeleteConfirm({ show: false, userId: '', userName: '' });
      });
  };

  return (
    <PageWrapper>
      <SectionTitle 
        title="Usuários do Sistema"
        description="Gerencie quem pode acessar e administrar a plataforma."
        icon={UserIcon}
        action={
          <Button 
            onClick={() => setShowModal(true)}
            iconLeft={<UserPlus className="w-5 h-5" />}
          >
            Novo Usuário
          </Button>
        }
      />

      <ContentCard padding="none" className="mt-8 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/30">
          <Input 
            iconLeft={<Search className="w-4 h-4 text-slate-300" />}
            placeholder="Buscar por nome, e-mail ou usuário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            wrapperClassName="max-w-md"
          />
        </div>
        
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificação</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nível de Acesso</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade / Cidade</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-10 py-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-blue-50/20 transition-all group">
                  <td className="px-10 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-black uppercase shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all">
                        {user.name.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 leading-tight">{user.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold tracking-tight">@{user.username} • {user.email || 'Sem e-mail'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-5">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg w-fit uppercase tracking-wider">
                      <Shield className="w-3.5 h-3.5 text-blue-500" />
                      {user.role.replace('_', ' ')}
                    </div>
                  </td>
                  <td className="px-10 py-5 text-sm font-bold text-slate-500">
                    {cities.find(c => c.id === user.cityId)?.name || 'Tatuí'} - SP
                  </td>
                  <td className="px-10 py-5 text-center">
                    <span className="px-4 py-1.5 text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 rounded-xl shadow-sm">Ativo</span>
                  </td>
                  <td className="px-10 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconButton onClick={() => handleEdit(user)} variant="outline" size="sm" className="border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-100">
                        <Edit className="w-4 h-4" />
                      </IconButton>
                      <IconButton onClick={() => handleDelete(user)} variant="outline" size="sm" className="border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-100">
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <p className="text-sm font-black text-slate-300 uppercase tracking-widest">Nenhum usuário encontrado.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ContentCard>

      {/* MODAL NOVO USUÁRIO */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingUserId(null); setFormData({ name: '', email: '', username: '', password: '', role: UserRoleType.USUARIO, cityId: formData.cityId }); }}
        title={editingUserId ? 'Editar Usuário' : 'Novo Acesso'}
        size="lg"
      >
        <div className="flex bg-slate-50 p-1.5 mb-6 rounded-2xl border border-slate-100">
          <button 
            onClick={() => setActiveTab('mfcista')}
            disabled={!!editingUserId}
            className={cn(
              "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              editingUserId ? "opacity-50 cursor-not-allowed" : "",
              activeTab === 'mfcista' ? "bg-white text-blue-600 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <UsersIcon className="w-4 h-4" /> Vincular MFCista
          </button>
          <button 
            onClick={() => setActiveTab('manual')}
            className={cn(
              "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              activeTab === 'manual' ? "bg-white text-blue-600 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Edit className="w-4 h-4" /> Cadastro Direto
          </button>
        </div>

        <div className="min-h-[300px]">
          {activeTab === 'mfcista' ? (
            <div className="space-y-4 animate-in fade-in duration-400">
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex items-start gap-4 mb-6">
                <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0" />
                <p className="text-[10px] text-blue-700 font-black leading-relaxed uppercase">
                  Selecione um membro da lista para criar seu acesso automaticamente. Isso evita erros de digitação e mantém os dados integrados.
                </p>
              </div>
              
              <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                {members.map(member => (
                  <button 
                    key={member.id}
                    onClick={() => handleLinkMember(member)}
                    className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-blue-200 hover:shadow-lg transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-blue-600 uppercase shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                        {member.name.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 leading-none mb-1">{member.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{member.phone}</p>
                      </div>
                    </div>
                    <Check className="w-5 h-5 text-transparent group-hover:text-blue-500 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-400">
              <Input 
                label="Nome Completo"
                iconLeft={<UserIcon className="w-4 h-4" />}
                placeholder="Ex: João da Silva"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Input 
                  label="E-mail"
                  iconLeft={<Mail className="w-4 h-4" />}
                  placeholder="exemplo@mfc.org"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />

                <Input 
                  label="Usuário (Username)"
                  addonLeft="@"
                  placeholder="joao.silva"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Input 
                  label={`Senha de Acesso ${editingUserId ? '(Opcional)' : ''}`}
                  iconLeft={<Key className="w-4 h-4" />}
                  type={showPassword ? 'text' : 'password'}
                  placeholder={editingUserId ? "Deixe vazio para manter" : "••••••••"}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  iconRight={
                    <button onClick={() => setShowPassword(!showPassword)} className="p-1 hover:text-blue-600 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />

                <Select 
                  label="Nível de Acesso"
                  iconLeft={<ShieldCheck className="w-4 h-4" />}
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as UserRoleType})}
                  options={Object.values(UserRoleType).map(role => ({ value: role, label: role.replace('_', ' ') }))}
                />
              </div>
            </div>
          )}
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={activeTab === 'mfcista'}
            iconLeft={<Save className="w-5 h-5" />}
          >
            {editingUserId ? 'Salvar Alterações' : 'Criar Usuário'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, userId: '', userName: '' })}
        onConfirm={confirmDelete}
        title="Excluir Usuário"
        message={`Tem certeza que deseja excluir o usuário ${deleteConfirm.userName}? Todas as credenciais de acesso serão permanentemente removidas.`}
        confirmLabel="Sim, Excluir"
        variant="danger"
      />
    </PageWrapper>
  );
};

export default UserManagement;
