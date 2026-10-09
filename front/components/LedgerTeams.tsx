import React, { useEffect, useMemo, useState } from 'react';
import { Users, Wallet, CalendarDays, HandCoins, ReceiptText, Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { BaseTeam, Member, Payment, FinancialEntity } from '../types';
import { BillingUnit, buildBillingUnits } from '../utils/billingUnits';
import { isPaidPayment, receivedInPeriod, paidLate, monthlySettlement, formatPaymentDate } from '../utils/paymentAccounting';
import { monthNames, shortMonths, LedgerEntry } from '../utils/ledger';
import { printLedger } from '../utils/ledgerExport';
import { familyPaymentHistory } from '../utils/familyPaymentHistory';
import { usePermission } from '../src/hooks/usePermission';
import { FamilyPaymentModal } from './FamilyPaymentModal';
import { LedgerMemberMatrix } from './LedgerMemberMatrix';
import { Badge, Button, ContentCard, EmptyState, GridTable, Select, StatCard, StatGrid, Tabs, usePagination, Modal, ModalFooter } from './ui';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
interface Props { year?: number; userId?: string; onChanged: () => void; }

export function LedgerTeams({ year: bookYear, userId, onChanged }: Props) {
  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [monthlyAmount, setMonthlyAmount] = useState(0);
  const [year, setYear] = useState(bookYear || new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [teamId, setTeamId] = useState('');
  const [tab, setTab] = useState('meses');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [payUnit, setPayUnit] = useState<BillingUnit | null>(null);
  const [paymentTeamId, setPaymentTeamId] = useState('');
  const [paymentMonth, setPaymentMonth] = useState(month);
  const [exportData, setExportData] = useState<{ book: FinancialEntity; entries: LedgerEntry[] } | null>(null);
  const [exporting, setExporting] = useState(false);
  const prepareExport = async () => {
    setExporting(true);
    try {
      const [books, ledger] = await Promise.all([api.getLedgerEntities(), api.getLedger()]);
      const book = books.find((item: FinancialEntity) => item.id === `mfc-team-payments-${year}`);
      if (!book) throw new Error('O livro de mensalidades deste ano ainda não está disponível.');
      setExportData({ book, entries: ledger.filter((entry: LedgerEntry) => entry.entityId === book.id && !!entry.paymentId) });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível preparar a exportação.'); }
    finally { setExporting(false); }
  };
  const exportFile = async (format: 'excel' | 'pdf') => {
    if (!exportData || exporting) return;
    setExporting(true);
    try {
      if (format === 'pdf') await printLedger(exportData.book, exportData.entries, '', 'all', 'teams');
      else {
        const { blob, filename } = await api.exportLedgerWorkbook(exportData.book.id, 'all', {}, 'teams');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível exportar.'); }
    finally { setExporting(false); }
  };
  const canReceive = usePermission('livro-caixa', 'create');
  useEffect(() => { if (bookYear) setYear(bookYear); }, [bookYear]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [t, m, p, config] = await Promise.all([api.getTeams(), api.getMembers(), api.getPayments(), api.getFinancialConfig()]);
        const amount = Number(config?.monthlyPaymentAmount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Mensalidade não configurada');
        if (active) { setTeams(t); setTeamId(current => t.some((team: BaseTeam) => team.id === current) ? current : t[0]?.id || ''); setMembers(m); setPayments(p); setMonthlyAmount(amount); setError(false); }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    };
    load(); window.addEventListener('focus', load);
    return () => { active = false; window.removeEventListener('focus', load); };
  }, [retry]);

  const scoped = payments.filter(payment => !teamId || payment.teamId === teamId);
  const received = scoped.filter(payment => receivedInPeriod(payment, year, month)).sort((a, b) => b.date.localeCompare(a.date));
  const annual = scoped.filter(payment => receivedInPeriod(payment, year));
  const total = received.reduce((sum, payment) => sum + payment.amount, 0);
  const lateTotal = received.filter(paidLate).reduce((sum, payment) => sum + payment.amount, 0);
  const units = useMemo(() => teamId ? buildBillingUnits(members.filter(member => member.teamId === teamId), monthlyAmount) : [], [members, teamId, monthlyAmount]);
  const receiptFamilies = units.filter(unit => unit.payingMembers.length).map(unit => ({ key: unit.key, name: unit.payingMembers.map(member => member.name.trim().split(/\s+/)[0]).join(' e '), ids: unit.payingMembers.map(member => member.id) }));
  for (const payment of received) if (!receiptFamilies.some(family => family.ids.includes(payment.memberId))) receiptFamilies.push({ key: payment.memberId, name: (payment.memberName || members.find(member => member.id === payment.memberId)?.name || 'MFCista').trim().split(/\s+/)[0], ids: [payment.memberId] });
  const familyReceipts = receiptFamilies.flatMap(family => familyPaymentHistory(received, teamId, family.ids).map(payment => ({ ...payment, id: `${family.key}:${payment.id}`, familyName: family.name }))).sort((a, b) => b.date.localeCompare(a.date));
  const receiptsPage = usePagination(familyReceipts, 15);
  const unitsPage = usePagination(units, 15);
  useEffect(() => { receiptsPage.setPage(1); unitsPage.setPage(1); }, [year, month, teamId, tab]);
  const years = [...new Set([new Date().getFullYear(), year, ...payments.filter(isPaidPayment).map(payment => Number(payment.date.slice(0, 4)))])].filter(Number.isFinite).sort((a, b) => b - a);
  const teamName = (id: string) => teams.find(team => team.id === id)?.name || 'Equipe não encontrada';
  const saved = (created: Payment[]) => {
    setPayments(previous => [...created, ...previous.filter(payment => !created.some(item => item.id === payment.id))]);
    onChanged();
  };
  const receiveButton = (unit: BillingUnit) => canReceive && userId && unit.payingMembers.length > 0
    ? <Button size="sm" iconLeft={<HandCoins size={14} />} onClick={() => { setPaymentTeamId(teamId); setPaymentMonth(month); setPayUnit(unit); }}>Receber</Button>
    : <span className="text-xs text-slate-500">{unit.payingMembers.length ? 'Somente consulta' : 'Sem cobrança'}</span>;
  const settlement = (unit: BillingUnit) => monthlySettlement(unit.payingMembers.map(member => member.id), payments.filter(payment => payment.teamId === teamId), month, year);

  if (loading) return <ContentCard><p role="status" className="text-sm text-slate-500">Carregando mensalidades das equipes…</p></ContentCard>;
  if (error) return <ContentCard><EmptyState icon={Users} title="Não foi possível carregar as mensalidades" description="Confira a conexão e a configuração do valor mensal antes de receber." action={<Button onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Tentar novamente</Button>} /></ContentCard>;

  return <div className="space-y-4 min-w-0">
    <ContentCard>
      <h2 className="text-sm font-semibold text-slate-900">Mensalidades das equipes base</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">Cada ano possui um livro próprio, atualizado automaticamente pela Tesouraria. Se janeiro a setembro forem pagos em outubro, toda a entrada aparece em outubro. As referências continuam identificando os meses quitados.</p>
      <p className="mt-2 text-xs text-amber-700">Não relance esses recebimentos manualmente. Valores antigos já digitados à mão precisam ser conferidos para não contar em dobro.</p>
    </ContentCard>
    <div className="flex flex-wrap items-end gap-3">
      {!bookYear && <Select label="Ano do recebimento" value={String(year)} onChange={event => setYear(Number(event.target.value))} options={years.map(value => ({ value: String(value), label: String(value) }))} />}
      <Select label="Mês do recebimento" value={String(month)} onChange={event => setMonth(Number(event.target.value))} options={monthNames.map((label, i) => ({ label, value: String(i + 1) }))} />
      <Button variant="outline" iconLeft={<Download size={14} />} loading={exporting} onClick={prepareExport}>Exportar equipes · {year}</Button>
    </div>
    {!teams.length && <EmptyState icon={Users} title="Nenhuma equipe cadastrada" description="Cadastre uma equipe base para acompanhar as mensalidades." />}
    <Tabs value={teamId} onChange={setTeamId} label="Equipes base" items={teams.map(team => ({ id: team.id, label: team.name, icon: Users }))}>
    <div className="space-y-4 min-w-0">
    <h3 className="text-sm font-semibold text-slate-800">{teamId ? teamName(teamId) : 'Todas as equipes'} · {year}</h3>
    <StatGrid cols={3}>
      <StatCard title={`Entradas de ${shortMonths[month - 1]}/${year}`} value={money(total)} icon={Wallet} color="success" description="Pela data real do recebimento" />
      <StatCard title="Deste valor, mensalidades atrasadas" value={money(lateTotal)} icon={CalendarDays} color="warning" description="Já incluído nas entradas, não é um valor adicional" />
      <StatCard title={`Recebido em ${year}`} value={money(annual.reduce((sum, payment) => sum + payment.amount, 0))} icon={ReceiptText} color="info" description="Todas as entradas do ano no filtro de equipe" />
    </StatGrid>
    <Tabs value={tab} onChange={setTab} label="Mensalidades no Livro Caixa" items={[{ id: 'meses', label: 'Mês a mês', icon: CalendarDays }, { id: 'recebimentos', label: 'Recebimentos', icon: ReceiptText }, { id: 'quitar', label: 'Receber mensalidades', icon: HandCoins }]}>
      {tab === 'meses' && <LedgerMemberMatrix members={members} teams={teams} payments={payments} year={year} teamId={teamId} monthlyAmount={monthlyAmount} onReceive={canReceive && userId ? (unit, id, selectedMonth) => { setPaymentTeamId(id); setPaymentMonth(selectedMonth); setPayUnit(unit); } : undefined} />}
      {tab === 'recebimentos' && <GridTable data={receiptsPage.paginatedData} keyExtractor={payment => payment.id} mobileBreakpoint="lg" columns={[
        { header: 'Família / casal', render: payment => <span className="font-medium">{payment.familyName}</span> },
        { header: 'Referência quitada', render: payment => payment.referenceMonth },
        { header: 'Entrada no caixa', render: payment => formatPaymentDate(payment.date) },
        { header: 'Valor', render: payment => <span className="tabular-nums font-semibold">{money(payment.amount)}</span> },
      ]} emptyMessage="Nenhum recebimento neste mês." pagination={{ total: familyReceipts.length, page: receiptsPage.page, pageSize: receiptsPage.pageSize, onPageChange: receiptsPage.setPage, onPageSizeChange: receiptsPage.setPageSize }} />}
      {tab === 'quitar' && <div className="space-y-3">
        <p className="text-xs text-slate-500">Referência sugerida: {monthNames[month - 1]}/{year}. No modal você pode selecionar outras mensalidades; a data do recebimento define em qual livro e mês a entrada será contabilizada.</p>
        {!teamId ? <EmptyState icon={Users} title="Abra a aba de uma equipe acima" description="Depois, selecione a família para receber as mensalidades em aberto, parciais ou antecipadas." /> : <GridTable data={unitsPage.paginatedData} keyExtractor={unit => unit.key} mobileBreakpoint="lg" columns={[
          { header: 'Família / responsável', render: unit => <span className="font-medium">{unit.displayName}</span> },
          { header: 'Mensalidade', render: unit => money(unit.monthlyTotal) },
          { header: `Referência ${shortMonths[month - 1]}`, render: unit => <Badge color={settlement(unit).status === 'paid' ? 'success' : 'default'}>{settlement(unit).label}</Badge> },
          { header: 'Ação', render: receiveButton },
        ]} emptyMessage="Nenhuma família encontrada nesta equipe." pagination={{ total: units.length, page: unitsPage.page, pageSize: unitsPage.pageSize, onPageChange: unitsPage.setPage, onPageSizeChange: unitsPage.setPageSize }} />}
      </div>}
    </Tabs>
    </div></Tabs>
    <Modal isOpen={!!exportData} onClose={() => { if (!exporting) setExportData(null); }} title={`Exportar equipes · ${exportData?.book.year || year}`} size="md" footer={<ModalFooter>
      <Button variant="outline" disabled={exporting} iconLeft={<Printer size={14} />} onClick={() => exportFile('pdf')}>Imprimir / salvar PDF</Button>
      <Button disabled={exporting} iconLeft={<Download size={14} />} onClick={() => exportFile('excel')}>Baixar Excel</Button>
    </ModalFooter>}><p className="text-sm text-slate-600">Todas as equipes do ano, com resumo geral e gráficos. No Excel, cada equipe tem sua aba, cabeçalho, filtros e valores por casal. No PDF, cada equipe inicia uma nova página.</p><p className="mt-3 text-xs text-slate-500">A exportação inclui o ano completo, independentemente do mês selecionado acima. Cores identificam o mês do recebimento; o histórico soma as parcelas do casal pela referência e data.</p></Modal>
    <FamilyPaymentModal isOpen={!!payUnit} unit={payUnit} teamId={paymentTeamId} userId={userId || ''} payments={payments.filter(payment => payment.teamId === paymentTeamId)} defaultMonth={paymentMonth} defaultYear={year} onSaved={saved} onClose={() => { setPayUnit(null); setRetry(value => value + 1); onChanged(); }} />
  </div>;
}
