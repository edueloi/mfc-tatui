import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Search, Users as UsersIcon, UserRound } from 'lucide-react';
import { api } from '../api';
import { BaseTeam, City, Member, User, UserRoleType } from '../types';
import { Button, EmptyState, Input, Modal, ModalFooter, Select, Tabs } from './ui';
import { maskPhone } from '../utils/masks';
import { normalizeDirectoryText, matchesDirectorySearch } from '../utils/memberDirectory';
import { slugify } from '../utils/teamSlug';

interface UserFormModalProps {
  isOpen: boolean;
  /** Usuário em edição; null cria um novo. */
  user: User | null;
  users: User[];
  members: Member[];
  cities: City[];
  teams: BaseTeam[];
  onClose: () => void;
  onSaved: (user: User, mode: 'created' | 'updated') => void;
}

const MIN_PASSWORD = 6;
const modes = [{ id: 'mfcista', label: 'Vincular MFCista', icon: UsersIcon }, { id: 'direto', label: 'Cadastro direto', icon: UserRound }] as const;
const blank = { name: '', email: '', username: '', password: '', role: UserRoleType.USUARIO as string, cityId: '', teamId: '' };

/** login sugerido a partir do nome (nome.sobrenome), sem repetir um login que já existe */
function suggestUsername(name: string, taken: Set<string>) {
  const parts = slugify(name).split('-').filter(Boolean);
  const base = parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0] || 'usuario';
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) candidate = `${base}${n}`;
  return candidate;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, user, users, members, cities, teams, onClose, onSaved }) => {
  const [form, setForm] = useState(blank);
  const [mode, setMode] = useState<typeof modes[number]['id']>('mfcista');
  const [memberSearch, setMemberSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setTouched(false); setShowPassword(false); setMemberSearch('');
    setMode(user ? 'direto' : 'mfcista');
    setForm(user ? { name: user.name, email: user.email || '', username: user.username, password: '', role: user.role, cityId: user.cityId, teamId: user.teamId || '' } : { ...blank, cityId: cities[0]?.id || '' });
  }, [isOpen, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const taken = useMemo(() => new Set(users.filter(item => item.id !== user?.id).map(item => item.username.toLowerCase())), [users, user]);
  const set = (field: keyof typeof blank, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const errors = {
    name: form.name.trim().length < 3 ? 'Informe o nome completo.' : '',
    username: !form.username.trim() ? 'Informe o login.' : /\s/.test(form.username) ? 'O login não pode ter espaços.' : taken.has(form.username.trim().toLowerCase()) ? 'Este login já está em uso.' : '',
    email: form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? 'E-mail inválido.' : '',
    password: !user && !form.password ? 'Defina uma senha.' : form.password && form.password.length < MIN_PASSWORD ? `Use ao menos ${MIN_PASSWORD} caracteres.` : '',
    cityId: !form.cityId ? 'Escolha a unidade.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);
  const err = (message: string) => touched && message ? <p role="alert" className="mt-1 text-xs text-red-600">{message}</p> : null;

  const candidates = useMemo(() => members.filter(member => matchesDirectorySearch(member, memberSearch)).slice(0, 40), [members, memberSearch]);

  const pickMember = (member: Member) => {
    setForm(prev => ({ ...prev, name: member.name, email: (member as Member & { email?: string }).email || '', username: suggestUsername(member.nickname || member.name, taken), teamId: member.teamId || '' }));
    setMode('direto');
  };

  const save = async () => {
    setTouched(true);
    if (invalid || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const payload: Record<string, unknown> = { name: form.name.trim(), email: form.email.trim(), username: form.username.trim(), role: form.role, cityId: form.cityId, teamId: form.teamId || null };
      if (form.password) payload.password = form.password;
      const saved: User = user ? await api.updateUser(user.id, payload) : await api.createUser(payload);
      toast.success(user ? 'Usuário atualizado.' : 'Usuário criado.');
      onSaved(saved, user ? 'updated' : 'created');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o usuário.');
    } finally { savingRef.current = false; setSaving(false); }
  };

  const close = () => { if (!saving) onClose(); };
  const direct = mode === 'direto';

  return <Modal isOpen={isOpen} onClose={close} title={user ? 'Editar usuário' : 'Novo usuário'} size="lg"
    footer={<ModalFooter>
      <Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancelar</Button>
      {direct && <Button size="sm" loading={saving} onClick={save}>{user ? 'Salvar' : 'Criar usuário'}</Button>}
    </ModalFooter>}>
    {user ? null : <div className="mb-3"><Tabs<typeof modes[number]['id']> items={modes} value={mode} onChange={setMode} label="Como criar o acesso">{null}</Tabs></div>}

    {!direct && <div className="space-y-3">
      <p className="text-xs leading-relaxed text-slate-500">Escolha um MFCista para preencher nome, e-mail, equipe e um login sugerido. Depois é só definir a senha.</p>
      <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10">
        <Search size={15} className="shrink-0 text-zinc-400" />
        <input aria-label="Buscar MFCista" value={memberSearch} onChange={event => setMemberSearch(event.target.value)} placeholder="Nome, apelido, telefone ou CPF…" className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400" />
      </div>
      {candidates.length ? <ul className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
        {candidates.map(member => <li key={member.id}>
          <button type="button" onClick={() => pickMember(member)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-blue-500">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-xs font-semibold text-blue-700">{member.name.slice(0, 2).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><span className="block text-[13px] text-slate-800 break-words">{member.name}</span>
              <span className="block text-xs text-slate-500">{[teams.find(team => team.id === member.teamId)?.name || 'Sem equipe', member.phone ? maskPhone(member.phone) : ''].filter(Boolean).join(' · ')}</span></span>
            <span className="shrink-0 text-xs font-medium text-blue-700">Usar</span>
          </button>
        </li>)}
      </ul> : <EmptyState icon={UsersIcon} title="Nenhum MFCista encontrado" description={normalizeDirectoryText(memberSearch) ? 'Ajuste a busca ou use o cadastro direto.' : 'Cadastre MFCistas ou use o cadastro direto.'} action={<Button variant="outline" size="sm" onClick={() => setMode('direto')}>Cadastro direto</Button>} />}
    </div>}

    {direct && <div className="space-y-3">
      <div><Input label="Nome completo" placeholder="Ex.: João da Silva" value={form.name} onChange={event => set('name', event.target.value)} />{err(errors.name)}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><Input label="Login" addonLeft="@" placeholder="joao.silva" autoCapitalize="none" value={form.username} onChange={event => set('username', event.target.value.replace(/\s/g, ''))} />{err(errors.username)}</div>
        <div><Input label="E-mail" type="email" placeholder="exemplo@mfc.org" value={form.email} onChange={event => set('email', event.target.value)} />{err(errors.email)}</div>
        <div><Input label={user ? 'Nova senha (opcional)' : 'Senha'} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder={user ? 'Deixe vazio para manter' : `Mínimo de ${MIN_PASSWORD} caracteres`} value={form.password} onChange={event => set('password', event.target.value)}
          iconRight={<button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(value => !value)} className="p-1 text-slate-400 hover:text-blue-600">{showPassword ? <EyeOff size={14} /> : <Eye size={14} />}</button>} />{err(errors.password)}</div>
        <Select label="Nível de acesso" value={form.role} onChange={event => set('role', event.target.value)} options={Object.values(UserRoleType).map(role => ({ value: role, label: role }))} />
        <div><Select label="Unidade" value={form.cityId} onChange={event => set('cityId', event.target.value)} options={cities.map(city => ({ value: city.id, label: `${city.name} / ${city.uf}` }))} placeholder="Selecione" />{err(errors.cityId)}</div>
        <Select label="Equipe base" value={form.teamId} onChange={event => set('teamId', event.target.value)} options={[{ value: '', label: 'Sem equipe' }, ...teams.map(team => ({ value: team.id, label: team.name }))]} />
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">A equipe define o que a pessoa vê em “Minha equipe”. A senha é guardada de forma criptografada e nunca é exibida.</p>
    </div>}
  </Modal>;
};
