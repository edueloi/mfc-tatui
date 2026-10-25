import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Minus, Plus, Wand2 } from 'lucide-react';
import { api } from '../api';
import { NucleationContact, NucleationGroup } from '../types';
import { Button, DatePicker, Input, Modal, ModalFooter } from './ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contacts: NucleationContact[];
  onGenerated: (groups: NucleationGroup[]) => void;
}

/** Cria vários grupos de uma vez e reparte entre eles as pessoas que ainda estão sem grupo. */
export const NucleationGenerateModal: React.FC<Props> = ({ isOpen, onClose, contacts, onGenerated }) => {
  const [baseName, setBaseName] = useState('Grupo');
  const [count, setCount] = useState(2);
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Mesma regra do servidor: sem grupo e ainda em acompanhamento (Pendente ou Em andamento).
  const available = useMemo(() => contacts.filter(contact => !contact.groupId && ['Pendente', 'Em Andamento'].includes(contact.status)), [contacts]);
  const max = Math.max(1, Math.min(50, available.length));

  useEffect(() => { if (isOpen) { setBaseName('Grupo'); setCount(Math.min(2, Math.max(1, available.length))); setEventDate(''); setEventTime(''); setLocation(''); } }, [isOpen]);

  const per = available.length ? Math.floor(available.length / count) : 0;
  const rest = available.length ? available.length % count : 0;
  const sizeText = !available.length ? '' : rest ? `${per} a ${per + 1} contatos em cada grupo` : `${per} ${per === 1 ? 'contato' : 'contatos'} em cada grupo`;
  const nameError = baseName.trim().length < 3;

  const generate = async () => {
    if (savingRef.current || !available.length || nameError) return;
    savingRef.current = true; setSaving(true);
    try {
      const result = await api.generateNucleationGroups({ baseName: baseName.trim(), count, eventDate, eventTime, location: location.trim() });
      toast.success(`${result.groups.length} ${result.groups.length === 1 ? 'grupo criado' : 'grupos criados'} com ${result.assigned} ${result.assigned === 1 ? 'contato' : 'contatos'}.`);
      onGenerated(result.groups); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível gerar os grupos.'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  return <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title="Gerar grupos automaticamente" size="md"
    footer={<ModalFooter>
      <Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>Cancelar</Button>
      <Button size="sm" loading={saving} disabled={!available.length || nameError} iconLeft={<Wand2 size={14} />} onClick={generate}>Gerar {count} {count === 1 ? 'grupo' : 'grupos'}</Button>
    </ModalFooter>}>
    <div className="space-y-4">
      <div className={`rounded-xl border p-3 text-xs ${available.length ? 'border-blue-100 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        {available.length
          ? <><b>{available.length}</b> {available.length === 1 ? 'contato está' : 'contatos estão'} sem grupo (Pendentes ou em andamento) e {available.length === 1 ? 'será colocado' : 'serão repartidos'} nos novos grupos.</>
          : 'Todos os contatos já estão em algum grupo (ou já foram convertidos). Não há ninguém para distribuir agora.'}
      </div>
      <div>
        <Input label="Nome base dos grupos" value={baseName} onChange={event => setBaseName(event.target.value)} placeholder="Ex.: Grupo Novembro" />
        <p className="mt-1 text-[11px] text-slate-500">Os grupos ficam como “{baseName.trim() || 'Grupo'} 1”, “{baseName.trim() || 'Grupo'} 2”…</p>
      </div>
      <div>
        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Quantos grupos</span>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" aria-label="Menos um grupo" disabled={count <= 1} onClick={() => setCount(value => Math.max(1, value - 1))}><Minus size={14} /></Button>
          <span className="w-10 text-center text-lg font-bold text-slate-900" aria-live="polite">{count}</span>
          <Button variant="outline" size="sm" aria-label="Mais um grupo" disabled={count >= max} onClick={() => setCount(value => Math.min(max, value + 1))}><Plus size={14} /></Button>
          <span className="text-xs text-slate-500">{sizeText}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DatePicker label="Data do encontro (opcional)" value={eventDate} onChange={value => setEventDate(value || '')} />
        <Input label="Horário (opcional)" type="time" value={eventTime} onChange={event => setEventTime(event.target.value)} />
        <div className="sm:col-span-2"><Input label="Local (opcional)" value={location} onChange={event => setLocation(event.target.value)} placeholder="Ex.: Salão paroquial" /></div>
      </div>
      <p className="text-[11px] text-slate-500">Dá para ajustar tudo depois: editar a data de cada grupo, mover pessoas e baixar a ficha de presença.</p>
    </div>
  </Modal>;
};
