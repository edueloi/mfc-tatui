import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { Event } from '../types';
import { Button, DatePicker, Input, Modal, ModalFooter, Switch } from './ui';
import { CLOSE_AFTER_DAYS } from '../utils/events';

interface EventQuickEditModalProps {
  isOpen: boolean;
  event: Event;
  onClose: () => void;
  onSaved: () => void;
}

/** Ajustes do dia a dia sem abrir o formulário completo: metas, vagas, prazo, inscrições abertas, painel e observações. */
export const EventQuickEditModal: React.FC<EventQuickEditModalProps> = ({ isOpen, event, onClose, onSaved }) => {
  const fee = event.hasFee !== false && Number(event.ticketValue) > 0;
  const [form, setForm] = useState({ participantsGoal: '', capacity: '', goalValue: '', registrationDeadline: '', registrationOpen: true, showOnDashboard: true, notes: '' });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      participantsGoal: event.participantsGoal ? String(event.participantsGoal) : '', capacity: event.capacity ? String(event.capacity) : '', goalValue: event.goalValue ? String(event.goalValue) : '',
      registrationDeadline: event.registrationDeadline || '', registrationOpen: event.registrationOpen !== false, showOnDashboard: event.showOnDashboard !== false, notes: event.notes || '',
    });
  }, [isOpen, event.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      await api.updateEvent(event.id, {
        participantsGoal: parseInt(form.participantsGoal, 10) || null, capacity: parseInt(form.capacity, 10) || null,
        goalValue: parseFloat(form.goalValue.replace(',', '.')) || 0, registrationDeadline: form.registrationDeadline || null,
        registrationOpen: form.registrationOpen, showOnDashboard: form.showOnDashboard, notes: form.notes.trim(),
      });
      toast.success('Ajustes salvos.');
      onSaved(); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar os ajustes.'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  const close = () => { if (!saving) onClose(); };

  return <Modal isOpen={isOpen} onClose={close} title="Ajustes rápidos" size="md"
    footer={<ModalFooter><Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancelar</Button><Button size="sm" loading={saving} onClick={save}>Salvar</Button></ModalFooter>}>
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Meta de participantes" type="number" min={0} value={form.participantsGoal} onChange={e => setForm({ ...form, participantsGoal: e.target.value })} />
        <Input label="Vagas (limite)" type="number" min={0} value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} hint="Vazio = sem limite." />
        {fee && <Input label="Meta de arrecadação" type="number" min={0} step="0.01" addonLeft="R$" value={form.goalValue} onChange={e => setForm({ ...form, goalValue: e.target.value })} />}
        <DatePicker label="Prazo de inscrição" value={form.registrationDeadline} onChange={value => setForm({ ...form, registrationDeadline: value || '' })} />
      </div>
      {event.kind === 'externo' && <label className="flex cursor-pointer items-center gap-3"><Switch checked={form.registrationOpen} onCheckedChange={value => setForm({ ...form, registrationOpen: value })} size="sm" /><span className="text-xs text-slate-700">Inscrições abertas pelo link público</span></label>}
      <label className="flex cursor-pointer items-center gap-3"><Switch checked={form.showOnDashboard} onCheckedChange={value => setForm({ ...form, showOnDashboard: value })} size="sm" /><span className="text-xs text-slate-700">Mostrar no painel</span></label>
      <div>
        <label htmlFor="quick-notes" className="ds-label mb-1 block">Observações internas</label>
        <textarea id="quick-notes" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-[13px] text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10" />
      </div>
      <p className="text-[11px] text-slate-500">Para mudar nome, data, local, taxa, imagem ou gastos, use “Editar”. O evento é encerrado sozinho {CLOSE_AFTER_DAYS} dias depois da data.</p>
    </div>
  </Modal>;
};
