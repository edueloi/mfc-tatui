import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { NucleationContact } from '../types';
import { Button, Input, Modal, ModalFooter } from './ui';
import { maskPhone, unmask } from '../utils/masks';

interface NucleationContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (contact: NucleationContact) => void;
}

const blank = { name: '', phone1: '', phone2: '' };
const phoneOk = (value: string) => !value || [10, 11].includes(unmask(value).length);

export const NucleationContactModal: React.FC<NucleationContactModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [form, setForm] = useState(blank);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => { if (isOpen) { setForm(blank); setTouched(false); } }, [isOpen]);

  const errors = {
    name: form.name.trim().length < 3 ? 'Informe o nome do casal ou contato (mínimo 3 letras).' : '',
    phone: !form.phone1 && !form.phone2 ? 'Informe ao menos um telefone.' : !phoneOk(form.phone1) || !phoneOk(form.phone2) ? 'Telefone incompleto: use DDD + número.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);
  const err = (message: string) => touched && message ? <p role="alert" className="mt-1 text-xs text-red-600">{message}</p> : null;

  const save = async () => {
    setTouched(true);
    if (invalid || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const created: NucleationContact = await api.createNucleationContact({ name: form.name.trim(), phone1: unmask(form.phone1), phone2: unmask(form.phone2) });
      toast.success('Contato criado.');
      onCreated(created);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar o contato.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const close = () => { if (!saving) onClose(); };

  return <Modal isOpen={isOpen} onClose={close} title="Novo contato de nucleação" size="sm"
    footer={<ModalFooter>
      <Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancelar</Button>
      <Button size="sm" loading={saving} onClick={save}>Criar contato</Button>
    </ModalFooter>}>
    <div className="space-y-3">
      <div><Input label="Nome" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Nome do casal ou contato" />{err(errors.name)}</div>
      <Input label="Telefone 1" inputMode="tel" value={form.phone1} onChange={event => setForm({ ...form, phone1: maskPhone(event.target.value) })} placeholder="(00) 00000-0000" />
      <Input label="Telefone 2" inputMode="tel" value={form.phone2} onChange={event => setForm({ ...form, phone2: maskPhone(event.target.value) })} placeholder="(00) 00000-0000" />
      {err(errors.phone)}
    </div>
  </Modal>;
};
