import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { UserPlus, Users } from 'lucide-react';
import { api } from '../api';
import { BaseTeam, Event, EventRegistration, Member } from '../types';
import { Button, EmptyState, Input, Modal, ModalFooter, Select, Tabs } from './ui';
import { money } from '../utils/events';
import { maskPhone, unmask } from '../utils/masks';
import { matchesDirectorySearch } from '../utils/memberDirectory';

interface EventRegistrationModalProps {
  isOpen: boolean;
  event: Event;
  teams: BaseTeam[];
  members: Member[];
  registrations: EventRegistration[];
  /** Equipe a que o usuário está limitado; null deixa escolher qualquer uma. */
  scopeTeamId: string | null;
  /** Equipe já selecionada ao abrir (ex.: botão "Inscrever equipe"). */
  initialTeamId?: string;
  userId?: string;
  spotsLeft: number | null;
  onClose: () => void;
  onSaved: (created: EventRegistration[]) => void;
}

const modes = [{ id: 'equipe', label: 'Membros da equipe', icon: Users }, { id: 'convidado', label: 'Convidado', icon: UserPlus }] as const;

export const EventRegistrationModal: React.FC<EventRegistrationModalProps> = ({ isOpen, event, teams, members, registrations, scopeTeamId, initialTeamId, userId, spotsLeft, onClose, onSaved }) => {
  const [mode, setMode] = useState<typeof modes[number]['id']>('equipe');
  const [teamId, setTeamId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [guest, setGuest] = useState({ name: '', phone: '', email: '', guests: '0', notes: '', teamId: '' });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const availableTeams = scopeTeamId ? teams.filter(team => team.id === scopeTeamId) : teams;
  const registered = useMemo(() => new Set(registrations.filter(item => item.status !== 'Cancelado' && item.memberId).map(item => item.memberId as string)), [registrations]);
  const candidates = useMemo(() => members
    .filter(member => member.teamId === teamId && member.status !== 'Inativo' && matchesDirectorySearch(member, search))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [members, teamId, search]);
  const fee = event.hasFee !== false ? Number(event.ticketValue) || 0 : 0;

  useEffect(() => {
    if (!isOpen) return;
    setMode('equipe'); setSearch(''); setSelected([]); setTouched(false);
    setTeamId(scopeTeamId && teams.some(team => team.id === scopeTeamId) ? scopeTeamId : teams.some(team => team.id === initialTeamId) ? initialTeamId! : teams[0]?.id || '');
    setGuest({ name: '', phone: '', email: '', guests: '0', notes: '', teamId: scopeTeamId || '' });
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSelected([]); }, [teamId]);

  const guests = Math.max(0, parseInt(guest.guests, 10) || 0);
  const newPeople = mode === 'equipe' ? selected.length : 1 + guests;
  const overCapacity = spotsLeft !== null && newPeople > spotsLeft;
  const guestErrors = {
    name: guest.name.trim().length < 3 ? 'Informe o nome completo.' : '',
    phone: guest.phone && ![10, 11].includes(unmask(guest.phone).length) ? 'Telefone incompleto: use DDD + número.' : '',
    email: guest.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email.trim()) ? 'E-mail inválido.' : '',
  };
  const canSave = !overCapacity && (mode === 'equipe' ? selected.length > 0 : !Object.values(guestErrors).some(Boolean));
  const err = (message: string) => touched && message ? <p role="alert" className="mt-1 text-xs text-red-600">{message}</p> : null;

  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  const toggleAll = () => { const free = candidates.filter(member => !registered.has(member.id)).map(member => member.id); setSelected(prev => free.every(id => prev.includes(id)) ? [] : free); };

  const save = async () => {
    setTouched(true);
    if (!canSave || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const payload = mode === 'equipe'
        ? members.filter(member => selected.includes(member.id)).map(member => ({ memberId: member.id, teamId: member.teamId, name: member.name, phone: member.phone || '', source: 'equipe', createdBy: userId }))
        : [{ name: guest.name.trim(), phone: unmask(guest.phone), email: guest.email.trim(), guests, notes: guest.notes.trim(), teamId: guest.teamId || null, source: 'manual', createdBy: userId }];
      const created: EventRegistration[] = await api.createEventRegistrations(event.id, payload);
      toast.success(created.length === 1 ? 'Inscrição registrada.' : `${created.length} inscrições registradas.`);
      onSaved(created);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar as inscrições.');
    } finally { savingRef.current = false; setSaving(false); }
  };

  const close = () => { if (!saving) onClose(); };

  return <Modal isOpen={isOpen} onClose={close} title={`Inscrever · ${event.name}`} size="lg"
    footer={<ModalFooter><Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancelar</Button>
      <Button size="sm" loading={saving} disabled={!canSave && touched} onClick={save}>{newPeople > 0 && mode === 'equipe' && selected.length === 0 ? 'Inscrever' : `Inscrever ${newPeople} ${newPeople === 1 ? 'pessoa' : 'pessoas'}${fee ? ` · ${money(fee * newPeople)}` : ''}`}</Button></ModalFooter>}>
    <div className="space-y-3">
      <Tabs<typeof modes[number]['id']> items={modes} value={mode} onChange={setMode} label="Quem inscrever">{null}</Tabs>
      {spotsLeft !== null && <p className={`text-xs ${overCapacity ? 'text-red-600' : 'text-slate-500'}`} role={overCapacity ? 'alert' : undefined}>{spotsLeft === 0 ? 'As vagas acabaram.' : `${spotsLeft} ${spotsLeft === 1 ? 'vaga restante' : 'vagas restantes'}.`}{overCapacity && ' Reduza a quantidade de pessoas.'}</p>}

      {mode === 'equipe' && <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Equipe" value={teamId} disabled={!!scopeTeamId} onChange={event => setTeamId(event.target.value)} options={availableTeams.map(team => ({ value: team.id, label: team.name }))} placeholder="Selecione" />
          <Input label="Buscar membro" placeholder="Nome, apelido ou telefone…" value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        {candidates.length ? <>
          <div className="flex items-center justify-between text-xs text-slate-500"><span>{selected.length} selecionados</span><Button variant="ghost" size="xs" onClick={toggleAll}>Marcar / desmarcar todos</Button></div>
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {candidates.map(member => { const already = registered.has(member.id); return <li key={member.id}>
              <label className={`flex items-center gap-3 px-3 py-2.5 ${already ? 'cursor-not-allowed bg-slate-50 opacity-70' : 'cursor-pointer hover:bg-slate-50'}`}>
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={already || selected.includes(member.id)} disabled={already} onChange={() => toggle(member.id)} />
                <span className="min-w-0 flex-1"><span className="block text-[13px] text-slate-800 break-words">{member.name}</span><span className="block text-xs text-slate-500">{member.phone ? maskPhone(member.phone) : 'Sem telefone'}</span></span>
                {already && <span className="shrink-0 text-xs text-emerald-700">Já inscrito</span>}
              </label></li>; })}
          </ul></>
          : <EmptyState icon={Users} title="Nenhum membro encontrado" description={teamId ? 'Ajuste a busca ou escolha outra equipe.' : 'Escolha uma equipe.'} />}
      </div>}

      {mode === 'convidado' && <div className="space-y-3">
        <div><Input label="Nome completo" value={guest.name} onChange={event => setGuest({ ...guest, name: event.target.value })} />{err(guestErrors.name)}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><Input label="Telefone" inputMode="tel" placeholder="(00) 00000-0000" value={guest.phone} onChange={event => setGuest({ ...guest, phone: maskPhone(event.target.value) })} />{err(guestErrors.phone)}</div>
          <div><Input label="E-mail" type="email" value={guest.email} onChange={event => setGuest({ ...guest, email: event.target.value })} />{err(guestErrors.email)}</div>
          <Input label="Acompanhantes" type="number" min={0} max={10} value={guest.guests} onChange={event => setGuest({ ...guest, guests: event.target.value })} hint={fee ? `Cada pessoa paga ${money(fee)}.` : undefined} />
          <Select label="Equipe que convida" value={guest.teamId} disabled={!!scopeTeamId} onChange={event => setGuest({ ...guest, teamId: event.target.value })} options={[{ value: '', label: 'Nenhuma' }, ...availableTeams.map(team => ({ value: team.id, label: team.name }))]} />
        </div>
        <Input label="Observações" placeholder="Opcional (alergias, restrições…)" value={guest.notes} onChange={event => setGuest({ ...guest, notes: event.target.value })} />
      </div>}
    </div>
  </Modal>;
};
