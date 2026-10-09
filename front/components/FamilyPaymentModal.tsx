import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Check, AlertCircle, Wallet } from 'lucide-react';
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

  return <Modal isOpen={isOpen} onClose={saving ? () => {} : onClose}
    title={<span className="flex items-center gap-2"><Wallet size={17} className="text-blue-600" />Confirmar recebimento</span>}
    size="lg" className="family-payment-modal"
    footer={<ModalFooter>
      <Button variant="outline" size="sm" disabled={saving} onClick={onClose}>Cancelar</Button>
      <Button size="sm" loading={saving} disabled={!lines.length || dateInvalid} iconLeft={<Check size={15} />} onClick={confirm}>
        {lines.length ? `Confirmar ${formatCurrency(total)}` : 'Confirmar recebimento'}
      </Button>
    </ModalFooter>}>
    <fieldset disabled={saving} className="min-w-0 space-y-4" aria-busy={saving}>
      <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3" aria-label="Responsáveis pelo pagamento">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500">{unit.type === 'couple' ? 'Casal responsável' : 'Responsável'}</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">{unit.displayName}</h3>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-500">Mensalidade da família</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(unit.monthlyTotal)}</p>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 border-t border-slate-200/70 pt-2">
          {unit.payingMembers.map(member => <li key={member.id} className="flex justify-between gap-3 text-xs text-slate-600">
            <span className="min-w-0 [overflow-wrap:anywhere]">{member.name}</span>
            <span className="shrink-0 tabular-nums">{formatCurrency(unit.amountPerPerson)}/mês</span>
          </li>)}
        </ul>
        {unit.exemptMembers.length > 0 && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Sem cobrança: {unit.exemptMembers.map(member => member.nickname || member.name.split(' ')[0]).join(', ')}.</p>}
      </section>

      <section aria-label="Dados do recebimento" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Data do recebimento" type="date" max={today} value={date} onChange={event => setDate(event.target.value)}
          error={dateInvalid ? (!date ? 'Informe a data do recebimento.' : 'A data não pode ser futura.') : undefined}
          hint="Define o mês de entrada no livro caixa." />
        <Select label="Forma de pagamento" value={method} onChange={event => setMethod(event.target.value)}
          options={[{ value: 'pix', label: 'Pix' }, { value: 'cash', label: 'Dinheiro' }, { value: 'card', label: 'Cartão' }, { value: 'transfer', label: 'Transferência' }]} />
      </section>

      <section className="space-y-3" aria-label="Mensalidades a receber">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-slate-800">Selecione as mensalidades</h3>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">Cada mês mostra o valor que ainda falta receber.</p>
          </div>
          <Select label="Ano" wrapperClassName="w-24 shrink-0" aria-label="Ano da referência" value={String(year)}
            onChange={event => { setYear(Number(event.target.value)); setMonths([]); }} options={yearOptions} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="xs" disabled={!overdueSelectable.length} onClick={() => setMonths(prev => Array.from(new Set([...prev, ...overdueSelectable])))}>
            Selecionar atrasadas ({overdueSelectable.length})
          </Button>
          <Button variant="ghost" size="xs" disabled={!months.length} onClick={() => setMonths([])}>Limpar seleção</Button>
        </div>
        <div className="receipt-months">
          {shortMonths.map((label, index) => {
            const month = index + 1;
            const pending = unpaidForMonth(unit, payments, month, year).length;
            const paid = pending === 0;
            const partial = pending > 0 && pending < unit.payingMembers.length;
            const settlement = monthlySettlement(unit.payingMembers.map(member => member.id), payments, month, year);
            const selected = !paid && months.includes(month);
            const overdue = !paid && isOverdue(month);
            const status = paid ? settlement.label : partial ? 'Parcial' : overdue ? 'Em atraso' : 'Em aberto';
            return <button key={month} type="button" disabled={paid} aria-pressed={selected}
              aria-label={`${monthNames[index]} de ${year}: ${status}${paid ? '' : ', ' + formatCurrency(pending * unit.amountPerPerson)}`}
              title={settlement.description} onClick={() => toggleMonth(month)}
              className={cn('receipt-month', selected && 'receipt-month--selected', paid && 'receipt-month--paid')}>
              <span className="flex w-full items-center justify-between gap-1">
                <span className="text-xs font-semibold">{label}</span>
                {selected ? <Check size={14} aria-hidden="true" /> : paid ? <CheckCircle2 size={14} className="text-emerald-600" aria-hidden="true" /> : <span className="h-3.5 w-3.5 rounded border border-slate-300" aria-hidden="true" />}
              </span>
              <span className={cn('text-[10px] leading-4', paid ? 'text-slate-500' : partial ? 'text-amber-700' : overdue ? 'text-red-600' : 'text-slate-500')}>{status}</span>
              <span className="text-xs font-medium tabular-nums">{paid ? 'Quitado' : formatCurrency(pending * unit.amountPerPerson)}</span>
            </button>;
          })}
        </div>
      </section>

      <Input label="Observação (opcional)" placeholder="Ex.: recebido pelo responsável da equipe" value={observation} onChange={event => setObservation(event.target.value)} />

      <section className="receipt-summary" aria-label="Resumo do recebimento" aria-live="polite">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-600">Total a receber</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-blue-700">{formatCurrency(total)}</p>
          </div>
          <p className="text-xs text-slate-500">{lines.length} {lines.length === 1 ? 'mensalidade selecionada' : 'mensalidades selecionadas'}</p>
        </div>
        {lines.length > 0 && <dl className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-xs">
          <div className="receipt-summary-row"><dt>Entrada no caixa</dt><dd>{dateInvalid ? 'Confira a data acima' : `${receivedLabel} · ${formatPaymentDate(date)}`}</dd></div>
          <div className="receipt-summary-row"><dt>Referências</dt><dd>{lines.map(line => `${shortMonths[line.month - 1]}/${String(year).slice(2)}`).join(', ')}</dd></div>
        </dl>}
        {overdueLines.length > 0 && !dateInvalid && <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-600"><AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          Mensalidades anteriores serão quitadas em atraso. O valor entra no caixa de {receivedLabel}, não nos meses anteriores.</p>}
        {!lines.length && <p className="mt-2 text-xs text-slate-500">Selecione ao menos uma mensalidade em aberto para continuar.</p>}
      </section>
    </fieldset>
  </Modal>;
};
