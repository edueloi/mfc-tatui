import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { FinancialEntity } from '../types';
import { Button, Combobox, DatePicker, Input, Modal, ModalFooter, Select, Switch } from './ui';
import { LEDGER_ACCOUNTS, LEDGER_FINANCIAL_ACCOUNTS, CostCenter, LedgerEntry, lastDayOfMonth, shortMonths } from '../utils/ledger';
import { localDateToday } from '../utils/paymentAccounting';

interface Props {
  isOpen: boolean; book: FinancialEntity; entry?: LedgerEntry | null; defaultType?: 'IN' | 'OUT';
  defaultPending?: boolean; readOnly?: boolean; settle?: boolean; userId?: string;
  onClose: () => void; onSaved: (entries: LedgerEntry[]) => void;
}
const initialForm = { type: 'IN', category: '', amount: '', expectedAmount: '', date: '', dueDate: '', description: '', status: 'SETTLED', valueKind: 'VARIABLE', counterparty: '', paymentMethod: '', notes: '', costCenter: '', analytic: '', financialAccount: '' };
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;

export const LedgerEntryModal: React.FC<Props> = ({ isOpen, book, entry, defaultType = 'IN', defaultPending = false, readOnly = false, settle = false, userId, onClose, onSaved }) => {
  const [form, setForm] = useState(initialForm);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  useEffect(() => { if (isOpen) api.getCostCenters().then(setCenters).catch(() => toast.error('Não foi possível carregar os centros. Você pode digitar o nome ou tentar abrir novamente.')); }, [isOpen]);
  const [repeat, setRepeat] = useState(false);
  const [months, setMonths] = useState<number[]>([]);
  const [variations, setVariations] = useState<Record<number, string>>({});
  const completed = useRef(new Set<number>());
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => {
    if (!isOpen) return;
    const today = localDateToday();
    const date = today.startsWith(String(book.year)) ? today : book.year + '-01-01';
    setForm(entry ? {
      type: entry.type, category: entry.category || '', amount: String(entry.amount), expectedAmount: String(entry.expectedAmount ?? entry.amount),
      date: settle && today.startsWith(String(book.year)) ? today : entry.date.slice(0, 10), dueDate: (entry.dueDate || entry.date).slice(0, 10), description: entry.description,
      status: settle ? 'SETTLED' : entry.status || 'SETTLED', valueKind: entry.valueKind || 'VARIABLE', counterparty: entry.counterparty || '', paymentMethod: entry.paymentMethod || '', notes: entry.notes || '',
      costCenter: entry.costCenter || '', analytic: entry.analytic || '', financialAccount: entry.financialAccount || '',
    } : { ...initialForm, type: defaultType, status: defaultPending ? 'PENDING' : 'SETTLED', date, dueDate: date });
    setRepeat(false); setMonths([]); setVariations({}); completed.current.clear();
  }, [isOpen, entry, book.id, book.year, defaultType, defaultPending, settle]);
  const update = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const baseMonth = Number(form.date.slice(5, 7));
  const targets = repeat ? [...new Set([baseMonth, ...months])].sort((a, b) => a - b) : [baseMonth];
  const monthValue = (month: number) => Number(repeat && form.valueKind === 'VARIABLE' && variations[month] !== undefined ? variations[month] : form.amount);
  const save = async () => {
    if (savingRef.current || readOnly) return;
    if (!form.category.trim()) return toast.error('Escolha ou digite a conta.');
    if (!validDate(form.date) || Number(form.date.slice(0, 4)) !== Number(book.year)) return toast.error('Informe uma data válida em ' + book.year + '.');
    if (!validDate(form.dueDate)) return toast.error('Informe um vencimento válido.');
    if (targets.some(month => !Number.isFinite(monthValue(month)) || monthValue(month) <= 0)) return toast.error('Todos os valores precisam ser maiores que zero.');
    if (form.expectedAmount && (!Number.isFinite(Number(form.expectedAmount)) || Number(form.expectedAmount) <= 0)) return toast.error('Informe um valor previsto válido.');
    savingRef.current = true; setSaving(true);
    try {
      const payload = { ...form, costCenterId: centers.find(center => center.name === form.costCenter)?.id || null, type: form.type as LedgerEntry['type'], amount: Number(form.amount), expectedAmount: Number(form.expectedAmount || form.amount), entityId: book.id, createdBy: userId };
      if (entry) {
        onSaved([await api.updateLedger(entry.id, payload)]);
      } else {
        // Uma nova tentativa grava apenas os meses ainda não confirmados.
        for (const month of targets.filter(month => !completed.current.has(month))) {
          const day = Math.min(Number(form.date.slice(8, 10)), lastDayOfMonth(book.year, month));
          const date = book.year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
          const value = monthValue(month);
          const saved = await api.createLedger({ ...payload, date, dueDate: repeat ? date : form.dueDate, status: repeat ? 'PENDING' : form.status, amount: value, expectedAmount: repeat ? value : payload.expectedAmount });
          completed.current.add(month); onSaved([saved]);
        }
      }
      toast.success(entry ? 'Lançamento atualizado.' : targets.length + ' lançamento(s) registrado(s).'); onClose();
    } catch (error) { toast.error((error instanceof Error ? error.message : 'Não foi possível salvar.') + (completed.current.size ? ' Meses já salvos serão ignorados na próxima tentativa.' : '')); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const close = () => { if (!saving) onClose(); };
  return <Modal isOpen={isOpen} onClose={close} size="lg" title={readOnly ? 'Detalhes do lançamento' : settle ? (form.type === 'IN' ? 'Receber conta' : 'Pagar conta') : entry ? 'Editar lançamento' : 'Novo lançamento'} footer={<ModalFooter>
    <Button variant="ghost" size="sm" disabled={saving} onClick={close}>{readOnly ? 'Fechar' : 'Cancelar'}</Button>
    {!readOnly && <Button size="sm" loading={saving} onClick={save}>{settle ? 'Confirmar baixa' : entry ? 'Salvar alterações' : 'Registrar'}</Button>}
  </ModalFooter>}>
    <fieldset disabled={readOnly || saving} className="space-y-3 min-w-0">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Movimento" value={form.type} onChange={e => update('type', e.target.value)} options={[{ value: 'IN', label: 'Entrada / conta a receber' }, { value: 'OUT', label: 'Saída / conta a pagar' }]} />
        <Select label="Situação" value={repeat ? 'PENDING' : form.status} disabled={repeat} onChange={e => update('status', e.target.value)} options={[{ value: 'PENDING', label: form.type === 'IN' ? 'A receber' : 'A pagar' }, { value: 'SETTLED', label: form.type === 'IN' ? 'Recebido' : 'Pago' }, { value: 'CANCELLED', label: 'Cancelado' }]} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="ds-label mb-1 block">Centro de custo</label><Combobox disabled={readOnly || saving} value={form.costCenter} onChange={value => update('costCenter', String(value || ''))} allowCustom options={centers.map(center => ({ value: center.name, label: center.name }))} placeholder="Selecione ou crie digitando o nome" /></div>
        <div><label className="ds-label mb-1 block">Sintético / categoria</label><Combobox disabled={readOnly || saving} value={form.category} onChange={value => update('category', String(value || ''))} allowCustom options={LEDGER_ACCOUNTS[form.type as LedgerEntry['type']].map(label => ({ value: label, label }))} placeholder="Ex.: ReceitasLivraria" /></div>
        <Input label="Analítico" maxLength={160} value={form.analytic} onChange={e => update('analytic', e.target.value)} placeholder="Ex.: Aluguel, Energia, Taxa de inscrição" />
        <div><label className="ds-label mb-1 block">Conta financeira</label><Combobox disabled={readOnly || saving} value={form.financialAccount} onChange={value => update('financialAccount', String(value || ''))} allowCustom options={LEDGER_FINANCIAL_ACCOUNTS.map(label => ({ value: label, label }))} placeholder="Ex.: BB c/c, Caixa, Poupança" /></div>
      </div>
      <Input label="Descrição" maxLength={255} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Ex.: Internet da sede — outubro" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label={form.status === 'SETTLED' ? 'Valor realizado' : 'Valor da conta'} type="number" min="0.01" step="0.01" addonLeft="R$" value={form.amount} onChange={e => update('amount', e.target.value)} />
        <Input label="Valor previsto" type="number" min="0.01" step="0.01" addonLeft="R$" placeholder="Igual ao valor da conta" value={form.expectedAmount} onChange={e => update('expectedAmount', e.target.value)} />
        <DatePicker disabled={readOnly || saving} label={form.status === 'SETTLED' ? 'Data do pagamento / recebimento' : 'Data no exercício'} value={form.date} onChange={value => update('date', value || '')} />
        <DatePicker disabled={readOnly || saving} label="Vencimento" value={form.dueDate} onChange={value => update('dueDate', value || '')} />
        <Select label="Classificação" value={form.valueKind} onChange={e => update('valueKind', e.target.value)} options={[{ value: 'VARIABLE', label: 'Valor variável' }, { value: 'FIXED', label: 'Valor fixo' }]} />
        <Select label="Forma de pagamento" value={form.paymentMethod} onChange={e => update('paymentMethod', e.target.value)} options={['', 'PIX', 'Dinheiro', 'Transferência', 'Boleto', 'Cartão', 'Outro'].map(value => ({ value, label: value || 'Não informada' }))} />
      </div>
      <Input label={form.type === 'IN' ? 'Receber de' : 'Pagar para'} maxLength={160} placeholder="Pessoa, fornecedor ou instituição" value={form.counterparty} onChange={e => update('counterparty', e.target.value)} />
      <Input label="Observações / documento de referência" maxLength={5000} value={form.notes} onChange={e => update('notes', e.target.value)} />
      {form.expectedAmount && form.status === 'SETTLED' && <p className="text-xs text-slate-500">Variação em relação ao previsto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(form.amount || 0) - Number(form.expectedAmount))}.</p>}
      {!entry && !readOnly && <div className="rounded-lg border border-slate-200 p-3 space-y-3">
        <label className="flex items-center gap-3 text-xs"><Switch checked={repeat} onCheckedChange={next => { setRepeat(next); if (next) update('status', 'PENDING'); }} disabled={saving || completed.current.size > 0} size="sm" />Repetir em outros meses deste ano</label>
        {repeat && <><p className="text-xs text-slate-500">Repetições são contas pendentes. O vencimento usa o dia da data no exercício, ajustado ao último dia do mês. Dê baixa quando o dinheiro entrar ou sair.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{shortMonths.map((label, index) => { const month = index + 1; const selected = targets.includes(month); return <div key={month} className="space-y-1">
            <Button size="xs" className="w-full" variant={selected ? 'primary' : 'outline'} disabled={month === baseMonth || completed.current.has(month)} aria-pressed={selected} onClick={() => setMonths(prev => prev.includes(month) ? prev.filter(value => value !== month) : [...prev, month])}>{label}{completed.current.has(month) ? ' ✓' : ''}</Button>
            {selected && form.valueKind === 'VARIABLE' && <Input aria-label={'Valor de ' + label} disabled={completed.current.has(month)} type="number" min="0.01" step="0.01" value={variations[month] ?? form.amount} onChange={e => setVariations(prev => ({ ...prev, [month]: e.target.value }))} />}
          </div>; })}</div></>}
      </div>}
      <p className="text-xs text-slate-500">Somente valores pagos ou recebidos compõem o saldo do caixa. Pendências e cancelamentos ficam registrados separadamente.</p>
    </fieldset>
  </Modal>;
};
