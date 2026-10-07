import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock, Check, AlertCircle, Wallet } from 'lucide-react';
import { api } from '../api';
import { Payment } from '../types';
import { Button, Input, Modal, ModalFooter, Select } from './ui';
import { BillingUnit, unpaidForMonth } from '../utils/billingUnits';
import { formatPaymentDate, localDateToday, monthlySettlement } from '../utils/paymentAccounting';
import { cn } from '../src/lib/utils';

interface FamilyPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit: BillingUnit | null;
  teamId: string;
  userId: string;
  /** Todos os recebimentos da equipe (para saber o que já foi quitado). */
  payments: Payment[];
  /** Mês/ano de referência sugerido ao abrir. */
  defaultMonth: number;
  defaultYear: number;
  onSaved: (created: Payment[]) => void;
}

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const shortMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const FamilyPaymentModal: React.FC<FamilyPaymentModalProps> = ({ isOpen, onClose, unit, teamId, userId, payments, defaultMonth, defaultYear, onSaved }) => {
  const [year, setYear] = useState(defaultYear);
  const [months, setMonths] = useState<number[]>([]);
  const [date, setDate] = useState(localDateToday);
  const [method, setMethod] = useState('pix');
  const [observation, setObservation] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const today = localDateToday();

  useEffect(() => {
    if (!isOpen || !unit) return;
    setYear(defaultYear);
    setMonths(unpaidForMonth(unit, payments, defaultMonth, defaultYear).length ? [defaultMonth] : []);
    setDate(localDateToday());
    setMethod('pix');
    setObservation('');
    // Só reinicia ao abrir para outra unidade; recebimentos novos não devem limpar a seleção.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, unit?.key]);

  // O dinheiro entra no caixa do mês da data de recebimento; a referência só diz qual mensalidade foi quitada.
  const receivedPeriod = date.slice(0, 7);
  const isOverdue = (month: number) => `${year}-${String(month).padStart(2, '0')}` < receivedPeriod;

  const lines = useMemo(() => {
    if (!unit) return [];
    return months.slice().sort((a, b) => a - b).map(month => {
      const payers = unpaidForMonth(unit, payments, month, year);
      return { month, payers, amount: payers.length * unit.amountPerPerson, overdue: isOverdue(month) };
    }).filter(line => line.payers.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, months, payments, year, receivedPeriod]);

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const overdueLines = lines.filter(line => line.overdue);
  const receivedLabel = date ? `${monthNames[Number(date.slice(5, 7)) - 1]}/${date.slice(0, 4)}` : '';
  const overdueSelectable = unit ? Array.from({ length: 12 }, (_, i) => i + 1).filter(month => isOverdue(month) && unpaidForMonth(unit, payments, month, year).length > 0) : [];
  const dateInvalid = !date || date > today;
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - 3 + i)).map(value => ({ value, label: value }));

  const toggleMonth = (month: number) => {
    if (!unit || !unpaidForMonth(unit, payments, month, year).length) return;
    setMonths(prev => prev.includes(month) ? prev.filter(item => item !== month) : [...prev, month]);
  };

  const confirm = async () => {
    if (!unit || !lines.length || dateInvalid || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const requests = lines.flatMap(line => line.payers.map(member => ({
      id: '', memberId: member.id, teamId, amount: unit.amountPerPerson, date,
      referenceMonth: `${line.month}/${year}`, status: 'Pago' as const, launchedBy: userId, observation, method,
    })));
    const results = await Promise.allSettled(requests.map(request => api.createPayment(request)));
    const created = results.flatMap(result => result.status === 'fulfilled' ? [result.value as Payment] : []);
    const failed = results.length - created.length;
    if (created.length) onSaved(created);
    if (failed === 0) {
      toast.success(`Recebimento de ${formatCurrency(total)} confirmado.`);
      onClose();
    } else {
      const firstError = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')?.reason;
      toast.error(`${failed} de ${results.length} lançamentos falharam${firstError instanceof Error ? `: ${firstError.message}` : '.'} Confira o que foi registrado e tente de novo.`);
    }
    savingRef.current = false;
    setSaving(false);
  };

  if (!unit) return null;

  return <Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} title="Confirmar recebimento" size="md"
    footer={<ModalFooter>
      <Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>Cancelar</Button>
      <Button size="sm" loading={saving} disabled={!lines.length || dateInvalid} iconLeft={<Wallet size={14} />} onClick={confirm}>
        {lines.length ? `Confirmar ${formatCurrency(total)}` : 'Confirmar recebimento'}
      </Button>
    </ModalFooter>}>
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{unit.type === 'couple' ? 'Casal responsável' : 'Responsável'}</p>
          <h4 className="text-sm font-semibold text-slate-900 break-words">{unit.displayName}</h4>
          <ul className="mt-1.5 space-y-0.5">
            {unit.payingMembers.map(member => <li key={member.id} className="flex items-center justify-between gap-4 text-xs text-slate-600"><span className="break-words">{member.name}</span><span className="shrink-0 tabular-nums">{formatCurrency(unit.amountPerPerson)}/mês</span></li>)}
          </ul>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-slate-500">Mensalidade</p>
          <p className="text-sm font-semibold text-slate-900">{formatCurrency(unit.monthlyTotal)}</p>
        </div>
      </div>

      {unit.exemptMembers.length > 0 && <p className="text-[11px] leading-relaxed text-slate-500">Sem cobrança, não entram no valor: {unit.exemptMembers.map(member => member.nickname || member.name.split(' ')[0]).join(', ')}.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Data do recebimento" type="date" size="sm" max={today} value={date} onChange={event => setDate(event.target.value)}
          hint={date > today ? 'A data não pode ser futura.' : 'O dinheiro entra no caixa deste mês.'} />
        <Select label="Forma" size="sm" value={method} onChange={event => setMethod(event.target.value)}
          options={[{ value: 'pix', label: 'Pix' }, { value: 'cash', label: 'Dinheiro' }, { value: 'card', label: 'Cartão' }, { value: 'transfer', label: 'Transferência' }]} />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-700">Mensalidades que estão sendo pagas</p>
          <div className="flex items-center gap-2">
            {overdueSelectable.length > 0 && <Button variant="ghost" size="xs" onClick={() => setMonths(prev => Array.from(new Set([...prev, ...overdueSelectable])))}>Selecionar atrasadas ({overdueSelectable.length})</Button>}
            <Select aria-label="Ano da referência" size="sm" wrapperClassName="w-24" value={String(year)} onChange={event => { setYear(Number(event.target.value)); setMonths([]); }} options={yearOptions} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {shortMonths.map((label, index) => {
            const month = index + 1;
            const pending = unpaidForMonth(unit, payments, month, year).length;
            const paid = pending === 0;
            const partial = pending > 0 && pending < unit.payingMembers.length;
            const settlement = monthlySettlement(unit.payingMembers.map(member => member.id), payments, month, year);
            const selected = months.includes(month);
            const overdue = !paid && isOverdue(month);
            return <button key={month} type="button" disabled={paid} aria-pressed={selected} title={settlement.description} onClick={() => toggleMonth(month)}
              className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border text-[11px] font-semibold transition-all focus-visible:outline-blue-500',
                paid ? (settlement.status === 'late' ? 'cursor-not-allowed border-amber-200 bg-amber-50 text-amber-800' : 'cursor-not-allowed border-emerald-100 bg-emerald-50 text-emerald-700 opacity-70')
                  : selected ? 'border-blue-600 bg-blue-600 text-white'
                  : partial ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : overdue ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-300'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300')}>
              {label}
              <span className="text-[10px] font-normal">{paid ? settlement.label : partial ? 'Parcial' : overdue ? 'Em atraso' : 'Em aberto'}</span>
              {paid ? <CheckCircle2 size={12} /> : partial ? <Clock size={12} /> : selected ? <Check size={12} /> : null}
            </button>;
          })}
        </div>
      </div>

      <Input label="Observação" size="sm" placeholder="Opcional" value={observation} onChange={event => setObservation(event.target.value)} />

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3" aria-live="polite">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-blue-700">Valor que está sendo recebido</p>
            <p className="text-lg font-semibold text-blue-900 tabular-nums">{formatCurrency(total)}</p>
          </div>
          <p className="text-right text-xs text-blue-700">{lines.length} {lines.length === 1 ? 'mês' : 'meses'}</p>
        </div>
        {lines.length > 0 && <dl className="mt-2 space-y-1 border-t border-blue-100 pt-2 text-xs text-blue-900">
          <div className="flex justify-between gap-3"><dt>Entra no caixa em</dt><dd className="font-semibold">{receivedLabel} ({formatPaymentDate(date)})</dd></div>
          <div className="flex justify-between gap-3"><dt>Mensalidades quitadas</dt><dd className="text-right font-semibold">{lines.map(line => `${shortMonths[line.month - 1]}/${String(year).slice(2)}`).join(', ')}</dd></div>
        </dl>}
        {overdueLines.length > 0 && <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-blue-800"><AlertCircle size={13} className="mt-0.5 shrink-0" />
          {overdueLines.map(line => shortMonths[line.month - 1]).join(', ')} {overdueLines.length === 1 ? 'fica quitado' : 'ficam quitados'} como pago em atraso, mas o valor entra no caixa de {receivedLabel}, não nos meses anteriores.</p>}
        {!lines.length && <p className="mt-2 text-[11px] text-blue-800">Selecione ao menos uma mensalidade em aberto.</p>}
      </div>
    </div>
  </Modal>;
};
