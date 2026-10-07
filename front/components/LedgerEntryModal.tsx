import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '../api';
import { FinancialEntity } from '../types';
import { Button, Combobox, DatePicker, FilterLineSegmented, Input, Modal, ModalFooter, Switch } from './ui';
import { LEDGER_ACCOUNTS, LedgerEntry, lastDayOfMonth, shortMonths } from '../utils/ledger';
import { localDateToday } from '../utils/paymentAccounting';

interface LedgerEntryModalProps {
  isOpen: boolean;
  book: FinancialEntity;
  userId?: string;
  onClose: () => void;
  onSaved: (entries: LedgerEntry[]) => void;
}

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const LedgerEntryModal: React.FC<LedgerEntryModalProps> = ({ isOpen, book, userId, onClose, onSaved }) => {
  const [type, setType] = useState<LedgerEntry['type']>('IN');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [months, setMonths] = useState<number[]>([]);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const today = localDateToday();
    setType('IN'); setCategory(''); setAmount(''); setDescription(''); setRepeat(false); setMonths([]); setTouched(false);
    setDate(today.startsWith(String(book.year)) ? today : `${book.year}-01-01`);
  }, [isOpen, book.id, book.year]);

  const value = parseFloat(amount.replace(',', '.'));
  const baseMonth = date ? Number(date.slice(5, 7)) : 0;
  const targetMonths = repeat ? Array.from(new Set([baseMonth, ...months])).filter(Boolean).sort((a, b) => a - b) : [baseMonth].filter(Boolean);
  const errors = {
    category: !category.trim() ? 'Escolha ou digite a conta.' : '',
    amount: !(value > 0) ? 'Informe um valor maior que zero.' : '',
    date: !date ? 'Informe a data.' : Number(date.slice(0, 4)) !== book.year ? `A data precisa estar em ${book.year}, o exercício deste livro.` : '',
  };
  const invalid = Object.values(errors).some(Boolean);
  const err = (message: string) => touched && message ? <p role="alert" className="mt-1 text-xs text-red-600">{message}</p> : null;

  const save = async () => {
    setTouched(true);
    if (invalid || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    const day = Number(date.slice(8, 10));
    const requests = targetMonths.map(month => ({
      entityId: book.id, type, category: category.trim(), amount: value, description: description.trim(), createdBy: userId,
      date: `${book.year}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDayOfMonth(book.year, month))).padStart(2, '0')}`,
    }));
    const results = await Promise.allSettled(requests.map(request => api.createLedger(request)));
    const created = results.flatMap(result => result.status === 'fulfilled' ? [result.value as LedgerEntry] : []);
    const failed = results.length - created.length;
    if (created.length) onSaved(created);
    if (!failed) {
      toast.success(created.length === 1 ? 'Lançamento registrado.' : `${created.length} lançamentos registrados.`);
      onClose();
    } else {
      const reason = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')?.reason;
      toast.error(`${failed} de ${results.length} lançamentos falharam${reason instanceof Error ? `: ${reason.message}` : '.'}`);
    }
    savingRef.current = false; setSaving(false);
  };

  const close = () => { if (!saving) onClose(); };

  return <Modal isOpen={isOpen} onClose={close} title="Novo lançamento" size="md"
    footer={<ModalFooter>
      <Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancelar</Button>
      <Button size="sm" variant={type === 'IN' ? 'success' : 'danger'} loading={saving} onClick={save}>
        {!(value > 0) ? 'Registrar' : targetMonths.length > 1 ? `Registrar ${targetMonths.length} lançamentos` : 'Registrar'}
      </Button>
    </ModalFooter>}>
    <div className="space-y-3">
      <FilterLineSegmented<string> value={type} onChange={next => { setType(next as LedgerEntry['type']); setCategory(''); }}
        options={[{ value: 'IN', label: 'Entrada', icon: <TrendingUp className="h-3.5 w-3.5" /> }, { value: 'OUT', label: 'Saída', icon: <TrendingDown className="h-3.5 w-3.5" /> }]} />
      <div>
        <label className="ds-label mb-1 block">Conta</label>
        <Combobox value={category} onChange={next => setCategory(String(next || ''))} allowCustom placeholder="Selecione ou digite a conta" searchPlaceholder="Buscar conta…"
          options={LEDGER_ACCOUNTS[type].map(label => ({ value: label, label }))} />
        {err(errors.category)}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><Input label="Valor" type="number" min={0} step="0.01" addonLeft="R$" placeholder="0,00" value={amount} onChange={event => setAmount(event.target.value)} />{err(errors.amount)}</div>
        <div><DatePicker label="Data" value={date} onChange={next => setDate(next || '')} />{err(errors.date)}</div>
      </div>
      <Input label="Descrição" placeholder="Opcional" value={description} onChange={event => setDescription(event.target.value)} />

      <div className="rounded-lg border border-slate-200 p-3">
        <label className="flex cursor-pointer items-center gap-3">
          <Switch checked={repeat} onCheckedChange={setRepeat} size="sm" />
          <span><span className="block text-xs font-semibold text-slate-800">Repetir em outros meses</span><span className="block text-[11px] text-slate-500">Cria o mesmo lançamento, no mesmo dia, nos meses marcados.</span></span>
        </label>
        {repeat && <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {shortMonths.map((label, index) => { const month = index + 1; const selected = targetMonths.includes(month); const base = month === baseMonth;
            return <button key={label} type="button" aria-pressed={selected} disabled={base} onClick={() => setMonths(prev => prev.includes(month) ? prev.filter(item => item !== month) : [...prev, month])}
              className={`rounded-lg border py-2 text-xs font-semibold transition-colors focus-visible:outline-blue-500 ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'} ${base ? 'opacity-80' : ''}`}>{label}</button>; })}
        </div>}
      </div>

      {value > 0 && targetMonths.length > 0 && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600" aria-live="polite">
        {targetMonths.length === 1 ? `${type === 'IN' ? 'Entrada' : 'Saída'} de ${money(value)}.` : `${targetMonths.length} lançamentos de ${money(value)} · total ${money(value * targetMonths.length)}.`}
      </p>}
    </div>
  </Modal>;
};
