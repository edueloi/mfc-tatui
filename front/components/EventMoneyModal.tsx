import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { Event, EventExpense, EventIncome } from '../types';
import { Button, DatePicker, Input, Modal, ModalFooter, Switch } from './ui';
import { money } from '../utils/events';
import { localDateToday } from '../utils/paymentAccounting';

interface EventMoneyModalProps {
  isOpen: boolean;
  event: Event;
  kind: 'income' | 'expense';
  userId?: string;
  onClose: () => void;
  onSaved: (kind: 'income' | 'expense', item: EventIncome | EventExpense) => void;
}

/** Lança uma entrada (doação, patrocínio…) ou um gasto do evento. O gasto pode ser marcado como "a mais", fora do previsto. */
export const EventMoneyModal: React.FC<EventMoneyModalProps> = ({ isOpen, event, kind, userId, onClose, onSaved }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDateToday());
  const [extra, setExtra] = useState(true);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const income = kind === 'income';

  useEffect(() => { if (isOpen) { setDescription(''); setAmount(''); setDate(localDateToday()); setExtra(true); setTouched(false); } }, [isOpen, kind]);

  const value = parseFloat(amount.replace(',', '.'));
  const errors = {
    description: description.trim().length < 2 ? (income ? 'Descreva a entrada (ex.: doação da paróquia).' : 'Descreva o gasto (ex.: gelo, aluguel).') : '',
    amount: !(value > 0) ? 'Informe um valor maior que zero.' : '',
    date: !date ? 'Informe a data.' : date > localDateToday() ? 'A data não pode ser futura.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);
  const err = (message: string) => touched && message ? <p role="alert" className="mt-1 text-xs text-red-600">{message}</p> : null;

  const save = async () => {
    setTouched(true);
    if (invalid || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const payload = { description: description.trim(), amount: value, date, isExtra: !income && extra, createdBy: userId };
      const saved = income ? await api.createEventIncome(event.id, payload) : await api.createEventExpense(event.id, payload);
      toast.success(income ? `Entrada de ${money(value)} registrada.` : `Gasto de ${money(value)} registrado.`);
      onSaved(kind, saved);
      onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível registrar.'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  const close = () => { if (!saving) onClose(); };

  return <Modal isOpen={isOpen} onClose={close} title={income ? 'Registrar entrada' : 'Registrar gasto'} size="sm"
    footer={<ModalFooter><Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancelar</Button>
      <Button size="sm" variant={income ? 'success' : 'danger'} loading={saving} onClick={save}>{value > 0 ? `${income ? 'Registrar entrada' : 'Registrar gasto'} de ${money(value)}` : 'Registrar'}</Button></ModalFooter>}>
    <div className="space-y-3">
      <div><Input label="Descrição" placeholder={income ? 'Ex.: Doação da paróquia' : 'Ex.: Gelo e bebidas'} value={description} onChange={e => setDescription(e.target.value)} />{err(errors.description)}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><Input label="Valor" type="number" min={0} step="0.01" addonLeft="R$" value={amount} onChange={e => setAmount(e.target.value)} />{err(errors.amount)}</div>
        <div><DatePicker label="Data" value={date} onChange={next => setDate(next || '')} />{err(errors.date)}</div>
      </div>
      {!income && <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
        <Switch checked={extra} onCheckedChange={setExtra} size="sm" />
        <span><span className="block text-xs font-semibold text-slate-800">Gasto a mais</span><span className="block text-[11px] text-slate-500">Marque quando não estava nos gastos previstos do evento. Entra no resultado do mesmo jeito.</span></span>
      </label>}
    </div>
  </Modal>;
};
