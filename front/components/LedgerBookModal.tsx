import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { FinancialEntity } from '../types';
import { Button, Input, Modal, ModalFooter, Select } from './ui';

interface LedgerBookModalProps {
  isOpen: boolean;
  /** Livro em edição; null cria um novo. */
  book: FinancialEntity | null;
  /** Quantidade de lançamentos do livro: com lançamentos o ano não pode mudar. */
  entryCount?: number;
  userId?: string;
  onClose: () => void;
  onSaved: (book: FinancialEntity, mode: 'created' | 'updated') => void;
}

export const LedgerBookModal: React.FC<LedgerBookModalProps> = ({ isOpen, book, entryCount = 0, userId, onClose, onSaved }) => {
  const thisYear = new Date().getFullYear();
  const [form, setForm] = useState({ name: '', year: String(thisYear), initialBalance: '', observations: '' });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setTouched(false);
    setForm(book ? { name: book.name, year: String(book.year), initialBalance: String(book.initialBalance ?? ''), observations: book.observations || '' } : { name: '', year: String(thisYear), initialBalance: '', observations: '' });
  }, [isOpen, book]); // eslint-disable-line react-hooks/exhaustive-deps

  const balance = form.initialBalance.trim() === '' ? 0 : parseFloat(form.initialBalance.replace(',', '.'));
  const errors = {
    name: form.name.trim().length < 3 ? 'Informe o título (mínimo 3 letras).' : '',
    balance: Number.isNaN(balance) ? 'Informe um valor válido.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);
  const err = (message: string) => touched && message ? <p role="alert" className="mt-1 text-xs text-red-600">{message}</p> : null;
  const yearLocked = !!book && entryCount > 0;
  const yearOptions = [...new Set([String(book?.year || thisYear), ...Array.from({ length: 30 }, (_, i) => String(thisYear + 1 - i))])].sort((a, b) => Number(b) - Number(a)).map(value => ({ value, label: value }));

  const save = async () => {
    setTouched(true);
    if (invalid || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const payload = { name: form.name.trim(), year: Number(form.year), initialBalance: balance, observations: form.observations.trim(), createdBy: userId };
      const saved: FinancialEntity = book ? await api.updateLedgerEntity(book.id, payload) : await api.createLedgerEntity(payload);
      toast.success(book ? 'Livro atualizado.' : 'Livro caixa criado.');
      onSaved(saved, book ? 'updated' : 'created');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o livro.');
    } finally { savingRef.current = false; setSaving(false); }
  };

  const close = () => { if (!saving) onClose(); };

  return <Modal isOpen={isOpen} onClose={close} title={book ? 'Editar livro caixa' : 'Novo livro caixa'} size="md"
    footer={<ModalFooter><Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancelar</Button><Button size="sm" loading={saving} onClick={save}>{book ? 'Salvar' : 'Criar livro'}</Button></ModalFooter>}>
    <div className="space-y-3">
      <div><Input label="Título" placeholder="Ex.: Livro Caixa da Unidade" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />{err(errors.name)}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Exercício (ano)" value={form.year} disabled={yearLocked} onChange={event => setForm({ ...form, year: event.target.value })} options={yearOptions} />
        <div><Input label="Saldo inicial" type="number" step="0.01" addonLeft="R$" placeholder="0,00" value={form.initialBalance} onChange={event => setForm({ ...form, initialBalance: event.target.value })} />{err(errors.balance)}</div>
      </div>
      {yearLocked && <p className="text-[11px] text-slate-500">O ano não muda porque o livro já tem {entryCount} {entryCount === 1 ? 'lançamento' : 'lançamentos'}.</p>}
      <Input label="Observações" placeholder="Opcional" value={form.observations} onChange={event => setForm({ ...form, observations: event.target.value })} />
    </div>
  </Modal>;
};
