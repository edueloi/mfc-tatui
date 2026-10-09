import React, { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { BaseTeam, Member, Payment } from '../types';
import { BillingUnit, buildBillingUnits } from '../utils/billingUnits';
import { formatPaymentDate, isPaidPayment, matchesReference, receivedInPeriod } from '../utils/paymentAccounting';
import { monthNames, shortMonths } from '../utils/ledger';
import { normalizeDirectoryText } from '../utils/memberDirectory';
import { familyPaymentHistory } from '../utils/familyPaymentHistory';
import { Button, FilterLine, FilterLineSearch, Select, Pagination, usePagination, Modal, ModalFooter, GridTable } from './ui';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const familyName = (unit: BillingUnit) => unit.payingMembers.map(member => member.name.trim().split(/\s+/)[0]).join(' e ');
const tones = [
  ['#dbeafe', '#1e40af'], ['#ede9fe', '#5b21b6'], ['#cffafe', '#155e75'], ['#d1fae5', '#065f46'],
  ['#ecfccb', '#3f6212'], ['#fef3c7', '#92400e'], ['#ffedd5', '#9a3412'], ['#fee2e2', '#991b1b'],
  ['#fae8ff', '#86198f'], ['#fce7f3', '#9d174d'], ['#e0e7ff', '#3730a3'], ['#ccfbf1', '#115e59'],
];
interface Props { members: Member[]; teams: BaseTeam[]; payments: Payment[]; year: number; teamId: string; monthlyAmount: number; onReceive?: (unit: BillingUnit, teamId: string, month: number) => void; }
export function LedgerMemberMatrix({ members, payments, year, teamId, monthlyAmount, onReceive }: Props) {
  const [mode, setMode] = useState('reference');
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<BillingUnit | null>(null);
  const query = normalizeDirectoryText(search);
  const rows = useMemo(() => {
    const paid = payments.filter(payment => isPaidPayment(payment) && payment.teamId === teamId);
    return buildBillingUnits(members.filter(member => member.teamId === teamId), monthlyAmount)
      .filter(unit => unit.payingMembers.length > 0)
      .map(unit => {
        const ids = unit.payingMembers.map(member => member.id);
        const receipts = paid.filter(payment => ids.includes(payment.memberId));
        const cells = shortMonths.map((_, i) => {
          const items = receipts.filter(payment => mode === 'cash' ? receivedInPeriod(payment, year, i + 1) : matchesReference(payment, i + 1, year));
          const value = items.reduce((sum, payment) => sum + payment.amount, 0);
          const partial = mode === 'reference' && items.length > 0 && !ids.every(id => items.some(payment => payment.memberId === id));
          const groups = [...new Set(items.map(payment => payment.date.slice(0, 7)))].sort().map(period => ({
            period, month: Number(period.slice(5, 7)) - 1, value: items.filter(payment => payment.date.startsWith(period)).reduce((sum, payment) => sum + payment.amount, 0),
          }));
          return { items, value, partial, groups };
        });
        return { unit, name: familyName(unit), cells, total: cells.reduce((sum, cell) => sum + cell.value, 0) };
      }).filter(row => !query || normalizeDirectoryText(row.unit.payingMembers.map(member => member.name).join(' ')).includes(query));
  }, [members, payments, year, teamId, monthlyAmount, mode, query]);
  const pagination = usePagination(rows, 15);
  React.useEffect(() => { pagination.setPage(1); setHistory(null); }, [teamId, year, mode, search]);
  const historyItems = familyPaymentHistory(payments, teamId, history?.payingMembers.map(member => member.id) || []);
  const cellContent = (row: typeof rows[number], i: number) => {
    const cell = row.cells[i];
    const canPay = mode === 'reference' && (!cell.items.length || cell.partial) && onReceive;
    const label = cell.partial ? 'Parcial' : cell.items.length ? 'Pago' : mode === 'cash' ? 'Sem entrada' : 'Em aberto';
    return <button type="button" className={`ledger-payment-cell ${cell.partial ? 'ledger-payment-cell--partial' : ''} ${!cell.items.length ? 'ledger-payment-cell--open' : ''}`}
      aria-label={`${canPay ? 'Receber' : 'Histórico de'} ${monthNames[i]} de ${row.name}: ${label}`} title={`${monthNames[i]}: ${label}`}
      onClick={() => canPay ? onReceive(row.unit, teamId, i + 1) : setHistory(row.unit)}>
      {cell.groups.length ? cell.groups.map(group => <span key={group.period} className="ledger-payment-value" style={{ backgroundColor: tones[group.month][0], color: tones[group.month][1] }}
        title={`Recebido em ${monthNames[group.month]}/${group.period.slice(0, 4)}`} aria-label={`${money(group.value)}, recebido em ${monthNames[group.month]}/${group.period.slice(0, 4)}`}>{money(group.value)}{cell.partial && <span aria-hidden="true"> ◐</span>}</span>)
        : <span className="ledger-payment-value">{money(mode === 'reference' ? row.unit.monthlyTotal : 0)}</span>}
    </button>;
  };
  const historyButton = (unit: BillingUnit) => <Button variant="ghost" size="xs" iconLeft={<History size={14} />} onClick={() => setHistory(unit)}>Histórico</Button>;
  return <div className="min-w-0 space-y-3 ledger-family-matrix">
    <FilterLine><FilterLineSearch aria-label="Buscar família nas mensalidades" value={search} onChange={setSearch} placeholder="Buscar família…" /><Select aria-label="Organização dos meses" value={mode} onChange={event => setMode(event.target.value)} options={[{ value: 'reference', label: 'Mensalidades quitadas' }, { value: 'cash', label: 'Entradas no caixa' }]} /></FilterLine>
    <div className="space-y-2">
      <p className="text-xs text-slate-500">A cor indica o mês do recebimento. {mode === 'reference' ? 'Mensalidades antigas quitadas em outubro ficam rosa.' : 'Os valores seguem a data de entrada no caixa.'}</p>
      <div className="flex flex-wrap gap-1.5" aria-label="Legenda dos meses de recebimento">{shortMonths.map((label, i) => <span key={label} className="rounded px-2 py-1 text-[11px] font-medium" style={{ backgroundColor: tones[i][0], color: tones[i][1] }}>{label}</span>)}
        <span className="rounded border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-500">Em aberto</span><span className="px-2 py-1 text-[11px] text-slate-500">◐ Parcial</span>
      </div>
    </div>
    <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white xl:block" tabIndex={0} role="region" aria-label="Mensalidades por família">
      <table className="w-full min-w-[1250px] border-collapse text-xs">
        <thead><tr className="bg-slate-50 text-slate-500"><th scope="col" className="sticky left-0 z-10 min-w-[150px] max-w-[200px] bg-slate-50 px-3 py-3 text-left">Família</th>{shortMonths.map(label => <th scope="col" key={label} className="min-w-[74px] px-2 py-3 text-right">{label}</th>)}<th scope="col" className="px-3 py-3 text-right">{mode === 'cash' ? 'Recebido' : 'Quitado'}</th><th scope="col" className="px-3 py-3">Histórico</th></tr></thead>
        <tbody>{pagination.paginatedData.map(row => <tr key={row.unit.key} className="border-t border-slate-100">
          <th scope="row" className="sticky left-0 z-10 max-w-[200px] bg-white px-3 py-3 text-left font-medium [overflow-wrap:anywhere]">{row.name}</th>
          {row.cells.map((_, i) => <td key={i} className="px-1 py-2">{cellContent(row, i)}</td>)}
          <td className="px-3 py-3 text-right font-semibold tabular-nums">{money(row.total)}</td><td className="px-2 py-2">{historyButton(row.unit)}</td>
        </tr>)}</tbody>
        <tfoot><tr className="border-t border-slate-200 bg-slate-50 font-semibold"><th className="sticky left-0 bg-slate-50 px-3 py-3 text-left">Total do filtro</th>{shortMonths.map((_, i) => <td key={i} className="px-2 py-3 text-right tabular-nums">{money(rows.reduce((sum, row) => sum + row.cells[i].value, 0))}</td>)}<td className="px-3 py-3 text-right tabular-nums">{money(rows.reduce((sum, row) => sum + row.total, 0))}</td><td /></tr></tfoot>
      </table>
    </div>
    <div className="space-y-3 xl:hidden">{pagination.paginatedData.map(row => <section key={row.unit.key} className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium [overflow-wrap:anywhere]">{row.name}</h4>{historyButton(row.unit)}</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{row.cells.map((_, i) => <div key={i} className="min-w-0"><p className="mb-1 text-[11px] text-slate-500">{shortMonths[i]}</p>{cellContent(row, i)}</div>)}</div>
      <p className="mt-3 border-t border-slate-100 pt-2 text-right text-xs text-slate-500">{mode === 'cash' ? 'Recebido' : 'Quitado'}: <strong className="text-slate-800">{money(row.total)}</strong></p>
    </section>)}</div>
    {!rows.length && <p className="p-4 text-sm text-slate-500">Nenhuma família pagante encontrada.</p>}
    <Pagination total={rows.length} page={pagination.page} pageSize={pagination.pageSize} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
    <Modal isOpen={!!history} onClose={() => setHistory(null)} title={`Histórico · ${history ? familyName(history) : ''}`} size="xl" footer={<ModalFooter><Button variant="outline" onClick={() => setHistory(null)}>Fechar</Button></ModalFooter>}>
      <p className="mb-3 text-xs text-slate-500">Valores do casal somados por mensalidade e data de recebimento, em todos os anos. Pagamentos em datas diferentes aparecem separados.</p>
      <GridTable data={historyItems} keyExtractor={payment => payment.id} columns={[
        { header: 'Família', render: () => history ? familyName(history) : '' },
        { header: 'Referência', render: payment => payment.referenceMonth },
        { header: 'Recebido em', render: payment => formatPaymentDate(payment.date) },
        { header: 'Valor', render: payment => money(payment.amount) },
      ]} emptyMessage="Nenhum recebimento registrado para esta família." />
    </Modal>
  </div>;
}
