import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { EventRegistration } from '../types';
import { Button, Input, Modal, ModalFooter, Switch } from './ui';
import { money } from '../utils/events';

interface EventPaymentModalProps {
  isOpen: boolean;
  registration: EventRegistration | null;
  onClose: () => void;
  onSaved: (registration: EventRegistration) => void;
}

/** Recebe (total ou parte) a taxa de uma inscrição, ou marca a pessoa como isenta. */
export const EventPaymentModal: React.FC<EventPaymentModalProps> = ({ isOpen, registration, onClose, onSaved }) => {
  const [received, setReceived] = useState('');
  const [confirm, setConfirm] = useState(true);
  const [exempt, setExempt] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const remaining = registration ? Math.max(0, registration.amountDue - registration.amountPaid) : 0;
  useEffect(() => { if (isOpen && registration) { setReceived(remaining ? remaining.toFixed(2) : ''); setConfirm(true); setExempt(registration.paymentStatus === 'Isento'); } }, [isOpen, registration?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = parseFloat(received.replace(',', '.'));
  const error = exempt ? '' : !(value > 0) ? 'Informe o valor recebido.' : value > remaining + 0.001 ? `O valor passa do que falta pagar (${money(remaining)}).` : '';

  const save = async () => {
    if (!registration || error || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const paid = exempt ? 0 : registration.amountPaid + value;
      const fullyPaid = exempt || paid + 0.001 >= registration.amountDue;
      const updated: EventRegistration = await api.updateEventRegistration(registration.id, {
        amountPaid: paid, paymentStatus: exempt ? 'Isento' : fullyPaid ? 'Pago' : 'Parcial',
        status: confirm && fullyPaid && registration.status !== 'Cancelado' ? 'Confirmado' : registration.status,
      });
      toast.success(exempt ? 'Marcado como isento.' : `${money(value)} recebido de ${registration.name}.`);
      onSaved(updated);
      onClose();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o pagamento.'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  const close = () => { if (!saving) onClose(); };

  return <Modal isOpen={isOpen && !!registration} onClose={close} title="Receber pagamento" size="sm"
    footer={<ModalFooter><Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancelar</Button><Button size="sm" variant="success" loading={saving} disabled={!!error} onClick={save}>{exempt ? 'Marcar isento' : value > 0 ? `Receber ${money(value)}` : 'Receber'}</Button></ModalFooter>}>
    {registration && <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 p-3 text-xs">
        <p className="text-[13px] font-medium text-slate-900 break-words">{registration.name}{registration.guests > 0 ? ` + ${registration.guests}` : ''}</p>
        <dl className="mt-2 grid grid-cols-3 gap-2"><div><dt className="text-slate-500">Devido</dt><dd className="font-semibold tabular-nums">{money(registration.amountDue)}</dd></div>
          <div><dt className="text-slate-500">Já pago</dt><dd className="font-semibold tabular-nums text-emerald-700">{money(registration.amountPaid)}</dd></div>
          <div><dt className="text-slate-500">Falta</dt><dd className="font-semibold tabular-nums text-amber-700">{money(remaining)}</dd></div></dl>
      </div>
      <label className="flex cursor-pointer items-center gap-3"><Switch checked={exempt} onCheckedChange={setExempt} size="sm" /><span className="text-xs text-slate-700">Isento (não paga a taxa)</span></label>
      {!exempt && <>
        <div><Input label="Valor recebido agora" type="number" min={0} step="0.01" addonLeft="R$" value={received} onChange={event => setReceived(event.target.value)} />{error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}</div>
        <label className="flex cursor-pointer items-center gap-3"><Switch checked={confirm} onCheckedChange={setConfirm} size="sm" /><span className="text-xs text-slate-700">Confirmar a inscrição quando estiver quitada</span></label>
      </>}
    </div>}
  </Modal>;
};
