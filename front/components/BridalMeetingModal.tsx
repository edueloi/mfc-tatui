import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { BridalMeeting } from '../types';
import { Button, DatePicker, Input, Modal, ModalFooter } from './ui';

interface BridalMeetingModalProps {
  isOpen: boolean;
  /** Encontro em edição; null cria um novo. */
  meeting: BridalMeeting | null;
  onClose: () => void;
  onSaved: (meeting: BridalMeeting, mode: 'created' | 'updated') => void;
}

const blank = { name: '', date: '', startTime: '', endTime: '', location: '', pixKey: '' };

export const BridalMeetingModal: React.FC<BridalMeetingModalProps> = ({ isOpen, meeting, onClose, onSaved }) => {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setTouched(false);
    setForm(meeting ? { name: meeting.name, date: meeting.date || '', startTime: meeting.startTime || '', endTime: meeting.endTime || '', location: meeting.location || '', pixKey: meeting.pixKey || '' } : blank);
  }, [isOpen, meeting]);

  const set = (field: keyof typeof blank, value: string) => setForm(prev => ({ ...prev, [field]: value }));
  const errors = {
    name: form.name.trim().length < 3 ? 'Informe o nome do encontro (mínimo 3 letras).' : '',
    date: !form.date ? 'Informe a data do encontro.' : '',
    time: form.startTime && form.endTime && form.endTime <= form.startTime ? 'O término precisa ser depois do início.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);

  const save = async () => {
    setTouched(true);
    if (invalid || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), location: form.location.trim(), pixKey: form.pixKey.trim() };
      const saved: BridalMeeting = meeting ? await api.updateBridalMeeting(meeting.id, payload) : await api.createBridalMeeting(payload);
      toast.success(meeting ? 'Encontro atualizado.' : 'Encontro criado.');
      onSaved(saved, meeting ? 'updated' : 'created');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o encontro.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const close = () => { if (!saving) onClose(); };
  const err = (message: string) => touched && message ? <p role="alert" className="mt-1 text-xs text-red-600">{message}</p> : null;

  return <Modal isOpen={isOpen} onClose={close} title={meeting ? 'Editar encontro' : 'Novo encontro'} size="md"
    footer={<ModalFooter>
      <Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancelar</Button>
      <Button size="sm" loading={saving} onClick={save}>{meeting ? 'Salvar' : 'Criar encontro'}</Button>
    </ModalFooter>}>
    <div className="space-y-3">
      <div><Input label="Nome" value={form.name} onChange={event => set('name', event.target.value)} placeholder="Ex.: Encontro de Noivos - Agosto 2026" />{err(errors.name)}</div>
      <div><DatePicker label="Data" value={form.date} onChange={value => set('date', value || '')} />{err(errors.date)}</div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Início" type="time" value={form.startTime} onChange={event => set('startTime', event.target.value)} />
        <Input label="Término" type="time" value={form.endTime} onChange={event => set('endTime', event.target.value)} />
      </div>
      {err(errors.time)}
      <Input label="Local" value={form.location} onChange={event => set('location', event.target.value)} placeholder="Nome do local" />
      <Input label="Chave Pix" value={form.pixKey} onChange={event => set('pixKey', event.target.value)} placeholder="Chave Pix para pagamento" />
    </div>
  </Modal>;
};
