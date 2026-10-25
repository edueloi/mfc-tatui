import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';
import { api } from '../api';
import { NucleationContact, NucleationGroup } from '../types';
import { Button, DatePicker, Input, Modal, ModalFooter, Textarea } from './ui';
import { maskPhone } from '../utils/masks';
import { normalizeDirectoryText } from '../utils/memberDirectory';

/** Lista de pessoas (contatos) com busca e caixas de seleção. Usada ao criar o grupo e ao adicionar pessoas. */
export const ContactPicker: React.FC<{
  contacts: NucleationContact[];
  groups: NucleationGroup[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Esconde estes contatos (ex.: quem já está no grupo). */
  hideIds?: Set<string>;
}> = ({ contacts, groups, selected, onChange, hideIds }) => {
  const [search, setSearch] = useState('');
  const query = normalizeDirectoryText(search);
  const digits = search.replace(/\D/g, '');
  const groupName = (contact: NucleationContact) => contact.groupName || groups.find(group => group.id === contact.groupId)?.name || '';
  const visible = useMemo(() => contacts
    .filter(contact => !hideIds?.has(contact.id))
    .filter(contact => !query || normalizeDirectoryText(contact.name).includes(query) || (digits.length >= 3 && [contact.phone1, contact.phone2].some(phone => (phone || '').replace(/\D/g, '').includes(digits))))
    // quem está sem grupo aparece primeiro
    .sort((a, b) => Number(!!a.groupId) - Number(!!b.groupId) || a.name.localeCompare(b.name, 'pt-BR')), [contacts, hideIds, query, digits]);
  const free = visible.filter(contact => !contact.groupId);

  const toggle = (id: string) => { const next = new Set(selected); if (next.has(id)) next.delete(id); else next.add(id); onChange(next); };
  const allFreeSelected = free.length > 0 && free.every(contact => selected.has(contact.id));

  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome ou telefone…" aria-label="Buscar pessoas"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 [@media(pointer:fine)]:text-sm" />
      </div>
      <Button variant="outline" size="xs" disabled={!free.length} onClick={() => { const next = new Set(selected); if (allFreeSelected) free.forEach(contact => next.delete(contact.id)); else free.forEach(contact => next.add(contact.id)); onChange(next); }}>
        {allFreeSelected ? 'Desmarcar sem grupo' : `Marcar sem grupo (${free.length})`}
      </Button>
    </div>
    <ul className="max-h-64 divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-200">
      {visible.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">Nenhuma pessoa encontrada.</li>}
      {visible.map(contact => {
        const current = groupName(contact);
        return <li key={contact.id}>
          <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-slate-50">
            <input type="checkbox" className="mt-1" checked={selected.has(contact.id)} onChange={() => toggle(contact.id)} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-slate-800 [overflow-wrap:anywhere]">{contact.name}</span>
              <span className="block text-[11px] text-slate-500">{[contact.phone1, contact.phone2].filter(Boolean).map(maskPhone).join(' · ') || 'sem telefone'}</span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${current ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{current || 'Sem grupo'}</span>
          </label>
        </li>;
      })}
    </ul>
    <p className="text-[11px] text-slate-500">{selected.size} {selected.size === 1 ? 'pessoa selecionada' : 'pessoas selecionadas'}. Quem já está em outro grupo é movido para este.</p>
  </div>;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Quando informado, edita o grupo; senão cria um novo. */
  group?: NucleationGroup | null;
  contacts: NucleationContact[];
  groups: NucleationGroup[];
  onSaved: (group: NucleationGroup) => void;
}

const blank = { name: '', description: '', eventDate: '', eventTime: '', location: '', leader: '' };

export const NucleationGroupModal: React.FC<Props> = ({ isOpen, onClose, group, contacts, groups, onSaved }) => {
  const editing = !!group;
  const [form, setForm] = useState(blank);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(group ? { name: group.name, description: group.description || '', eventDate: group.eventDate || '', eventTime: group.eventTime || '', location: group.location || '', leader: group.leader || '' } : blank);
    setSelected(new Set()); setTouched(false);
  }, [isOpen, group?.id]);

  const set = (patch: Partial<typeof blank>) => setForm(prev => ({ ...prev, ...patch }));
  const nameError = form.name.trim().length < 3 ? 'Informe o nome do grupo (mínimo 3 letras).' : '';

  const save = async () => {
    setTouched(true);
    if (nameError || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const payload = { name: form.name.trim(), description: form.description.trim(), eventDate: form.eventDate, eventTime: form.eventTime, location: form.location.trim(), leader: form.leader.trim() };
      const saved: NucleationGroup = editing && group
        ? await api.updateNucleationGroup(group.id, payload)
        : await api.createNucleationGroup({ ...payload, contactIds: [...selected] });
      toast.success(editing ? 'Grupo atualizado.' : selected.size ? `Grupo criado com ${selected.size} ${selected.size === 1 ? 'pessoa' : 'pessoas'}.` : 'Grupo criado.');
      onSaved(saved);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o grupo.');
    } finally { savingRef.current = false; setSaving(false); }
  };
  const close = () => { if (!saving) onClose(); };

  return <Modal isOpen={isOpen} onClose={close} title={editing ? 'Editar grupo de nucleação' : 'Novo grupo de nucleação'} size="xl"
    footer={<ModalFooter>
      <Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancelar</Button>
      <Button size="sm" loading={saving} onClick={save}>{editing ? 'Salvar alterações' : 'Criar grupo'}</Button>
    </ModalFooter>}>
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Cada grupo é também um encontro de nucleação: defina quando e onde ele acontece para gerar a ficha de presença.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Input label="Nome do grupo" value={form.name} onChange={event => set({ name: event.target.value })} placeholder="Ex.: Grupo São José — Novembro" />
          {touched && nameError && <p role="alert" className="mt-1 text-xs text-red-600">{nameError}</p>}</div>
        <DatePicker label="Data do encontro" value={form.eventDate} onChange={value => set({ eventDate: value || '' })} />
        <Input label="Horário" type="time" value={form.eventTime} onChange={event => set({ eventTime: event.target.value })} />
        <Input label="Local" value={form.location} onChange={event => set({ location: event.target.value })} placeholder="Ex.: Salão paroquial" />
        <Input label="Responsável" value={form.leader} onChange={event => set({ leader: event.target.value })} placeholder="Casal ou pessoa responsável" />
        <div className="sm:col-span-2"><Textarea label="Descrição (opcional)" rows={2} maxLength={2000} value={form.description} onChange={event => set({ description: event.target.value })} placeholder="Objetivo ou observações do grupo" /></div>
      </div>
      {!editing && <div>
        <p className="mb-2 text-xs font-semibold text-slate-700">Pessoas do grupo (opcional)</p>
        <ContactPicker contacts={contacts} groups={groups} selected={selected} onChange={setSelected} />
      </div>}
    </div>
  </Modal>;
};

/** Modal para acrescentar pessoas a um grupo que já existe. */
export const NucleationAddMembersModal: React.FC<{
  isOpen: boolean; onClose: () => void; group: NucleationGroup | null;
  contacts: NucleationContact[]; groups: NucleationGroup[]; onAdded: () => void;
}> = ({ isOpen, onClose, group, contacts, groups, onAdded }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (isOpen) setSelected(new Set()); }, [isOpen]);
  const members = useMemo(() => new Set(contacts.filter(contact => contact.groupId === group?.id).map(contact => contact.id)), [contacts, group?.id]);

  const save = async () => {
    if (!group || !selected.size || saving) return;
    setSaving(true);
    try {
      await api.addNucleationGroupMembers(group.id, [...selected]);
      toast.success(`${selected.size} ${selected.size === 1 ? 'pessoa adicionada' : 'pessoas adicionadas'} ao grupo.`);
      onAdded(); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível adicionar as pessoas.'); }
    finally { setSaving(false); }
  };

  return <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title={`Adicionar pessoas${group ? ` — ${group.name}` : ''}`} size="lg"
    footer={<ModalFooter>
      <Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>Cancelar</Button>
      <Button size="sm" loading={saving} disabled={!selected.size} onClick={save}>Adicionar {selected.size || ''}</Button>
    </ModalFooter>}>
    <ContactPicker contacts={contacts} groups={groups} selected={selected} onChange={setSelected} hideIds={members} />
  </Modal>;
};
