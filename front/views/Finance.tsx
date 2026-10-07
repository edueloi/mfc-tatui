import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Wallet, Clock, CheckCircle2, ArrowLeft, Layers, Users, Loader2, ArrowRight, HandCoins, ListChecks, ReceiptText, Baby } from 'lucide-react';
import { api } from '../api';
import { Member, BaseTeam, Payment } from '../types';
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard, FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch, FilterLineSegmented,
  Select, Button, Badge, EmptyState, Tabs, GridTable, usePagination,
} from '../components/ui';
import { FamilyPaymentModal } from '../components/FamilyPaymentModal';
import { BillingUnit, buildBillingUnits, overdueMonths } from '../utils/billingUnits';
import { monthlyContributors } from '../utils/paymentRules';
import { isPaidPayment, matchesReference, receivedInPeriod, paidLate, formatPaymentDate, monthlySettlement } from '../utils/paymentAccounting';
import { normalizeDirectoryText } from '../utils/memberDirectory';
import { findTeamByParam, teamPath } from '../utils/teamSlug';

interface FinanceViewProps { cityId: string; userId: string; }

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const shortMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface Period { month: number; year: number; }

/** Resumo de uma equipe na referência escolhida. Recebimentos de meses antigos não abatem a referência; só entram no caixa. */
function teamSummary(team: BaseTeam, members: Member[], payments: Payment[], period: Period, monthlyAmount: number) {
  const teamMembers = members.filter(member => member.teamId === team.id);
  const units = buildBillingUnits(teamMembers, monthlyAmount);
  const contributors = units.flatMap(unit => unit.payingMembers);
  const refPayments = payments.filter(payment => payment.teamId === team.id && isPaidPayment(payment) && matchesReference(payment, period.month, period.year));
  const paid = contributors.filter(member => refPayments.some(payment => payment.memberId === member.id)).length;
  const open = units.reduce((sum, unit) => sum + unit.payingMembers.reduce((total, member) => {
    const received = refPayments.filter(payment => payment.memberId === member.id).reduce((acc, payment) => acc + payment.amount, 0);
    return total + Math.max(0, unit.amountPerPerson - received);
  }, 0), 0);
  const cash = payments.filter(payment => payment.teamId === team.id && receivedInPeriod(payment, period.year, period.month)).reduce((sum, payment) => sum + payment.amount, 0);
  return { units, total: contributors.length, paid, open, cash, percent: contributors.length ? (paid / contributors.length) * 100 : 0 };
}

const FinanceView: React.FC<FinanceViewProps> = ({ userId }) => {
  const navigate = useNavigate();
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();
  const month = Math.min(12, Math.max(1, Number(searchParams.get('mes')) || now.getMonth() + 1));
  const year = Number(searchParams.get('ano')) || now.getFullYear();
  const period: Period = { month, year };

  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [monthlyAmount, setMonthlyAmount] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [teamItems, memberItems, paymentItems, config] = await Promise.all([api.getTeams(), api.getMembers(), api.getPayments(), api.getFinancialConfig().catch(() => null)]);
        if (cancelled) return;
        setTeams(teamItems); setMembers(memberItems); setPayments(paymentItems);
        const amount = parseFloat(config?.monthlyPaymentAmount);
        if (!Number.isNaN(amount) && amount > 0) setMonthlyAmount(amount);
        setError(false);
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.removeEventListener('focus', load); };
  }, [retry]);

  const team = useMemo(() => findTeamByParam(teams, teamSlug), [teams, teamSlug]);

  // Link por id (ou nome antigo) passa a mostrar o nome da equipe na URL.
  useEffect(() => {
    if (!team || !teamSlug) return;
    const path = teamPath(team, teams, '/financeiro');
    if (path !== `/financeiro/${teamSlug}`) navigate({ pathname: path, search: window.location.search }, { replace: true });
  }, [team, teams, teamSlug, navigate]);

  const setPeriod = (next: Partial<Period>) => setSearchParams(prev => {
    const params = new URLSearchParams(prev);
    params.set('mes', String(next.month ?? month));
    params.set('ano', String(next.year ?? year));
    return params;
  }, { replace: true });

  const summaryLabel = `${monthNames[month - 1]} de ${year}`;
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 3 + i)).map(value => ({ value, label: value }));
  const selector = <div className="flex w-full items-center gap-2 sm:w-auto">
    <Select aria-label="Mês de referência" size="sm" wrapperClassName="w-36" value={String(month)} onChange={event => setPeriod({ month: Number(event.target.value) })} options={monthNames.map((label, index) => ({ value: String(index + 1), label }))} />
    <Select aria-label="Ano de referência" size="sm" wrapperClassName="w-24" value={String(year)} onChange={event => setPeriod({ year: Number(event.target.value) })} options={yearOptions} />
  </div>;

  if (loading) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando tesouraria…</div></PageWrapper>;

  if (error) return <PageWrapper><ContentCard><EmptyState icon={Wallet} title="Não foi possível carregar a tesouraria" description="Confira a conexão e tente novamente."
    action={<Button onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Tentar novamente</Button>} /></ContentCard></PageWrapper>;

  if (teamSlug && !team) return <PageWrapper><ContentCard><EmptyState icon={Layers} title="Equipe não encontrada" description="A equipe pode ter sido removida ou o endereço está incorreto."
    action={<Button variant="outline" onClick={() => navigate({ pathname: '/financeiro', search: window.location.search })}>Voltar para a tesouraria</Button>} /></ContentCard></PageWrapper>;

  const common = { teams, members, payments, period, monthlyAmount, periodLabel: summaryLabel };

  return (
    <PageWrapper>
      <div className="space-y-4">
        {team
          ? <TeamTreasury {...common} team={team} userId={userId} selector={selector} onBack={() => navigate({ pathname: '/financeiro', search: window.location.search })}
              onSaved={created => setPayments(prev => [...created, ...prev])} reload={() => setRetry(value => value + 1)} />
          : <TeamsOverview {...common} selector={selector} onOpen={item => navigate({ pathname: teamPath(item, teams, '/financeiro'), search: window.location.search })} />}
      </div>
    </PageWrapper>
  );
};

interface CommonProps { teams: BaseTeam[]; members: Member[]; payments: Payment[]; period: Period; monthlyAmount: number; periodLabel: string; selector: React.ReactNode; }

/* ───────────────────────────── Lista de equipes ───────────────────────────── */

const TeamsOverview: React.FC<CommonProps & { onOpen: (team: BaseTeam) => void }> = ({ teams, members, payments, period, monthlyAmount, periodLabel, selector, onOpen }) => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'equipes' | 'recebimentos'>('equipes');
  const rows = useMemo(() => teams.map(team => ({ team, ...teamSummary(team, members, payments, period, monthlyAmount) })), [teams, members, payments, period, monthlyAmount]);
  const query = normalizeDirectoryText(search);
  const filtered = rows.filter(row => !query || normalizeDirectoryText(`${row.team.name} ${row.team.city}`).includes(query)).sort((a, b) => a.team.name.localeCompare(b.team.name, 'pt-BR'));
  const { page, pageSize, paginatedData, setPage, setPageSize } = usePagination(filtered, 15);

  const cash = rows.reduce((sum, row) => sum + row.cash, 0);
  const open = rows.reduce((sum, row) => sum + row.open, 0);
  const upToDate = rows.filter(row => row.total > 0 && row.paid === row.total).length;
  const withCharge = rows.filter(row => row.total > 0).length;
  const paidResponsible = rows.reduce((sum, row) => sum + row.paid, 0);
  const tabs = [{ id: 'equipes', label: 'Equipes', icon: Layers }, { id: 'recebimentos', label: 'Recebimentos', icon: ReceiptText }] as const;

  return <>
    <SectionTitle title="Tesouraria" icon={Wallet} description={`Mensalidades das equipes base · referência ${periodLabel}.`} action={selector} />
    <StatGrid cols={3}>
      <StatCard title="Recebido no mês" value={formatCurrency(cash)} icon={Wallet} color="info" description="Caixa do mês, incluindo mensalidades atrasadas" />
      <StatCard title="Em aberto da referência" value={formatCurrency(open)} icon={Clock} color="warning" description={`Mensalidades de ${periodLabel}`} />
      <StatCard title="Equipes em dia" value={`${upToDate} / ${withCharge}`} icon={CheckCircle2} color="success" description={`${paidResponsible} responsáveis pagaram a referência`} />
    </StatGrid>
    <Tabs<typeof tabs[number]['id']> items={tabs} value={tab} onChange={setTab} label="Seções da tesouraria">
      {tab === 'equipes' && <div className="space-y-3">
        <FilterLine>
          <FilterLineSection grow><FilterLineSearch aria-label="Buscar equipe" value={search} onChange={setSearch} placeholder="Nome da equipe ou cidade…" /></FilterLineSection>
          <FilterLineSection><span className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'equipe' : 'equipes'}</span>{search && <Button variant="ghost" size="sm" onClick={() => setSearch('')}>Limpar busca</Button>}</FilterLineSection>
        </FilterLine>
        <ContentCard padding="none">
          <GridTable<typeof rows[number]> data={paginatedData} keyExtractor={row => row.team.id} noDesktopCard onRowClick={row => onOpen(row.team)}
            columns={[
              { header: 'Equipe', render: row => <div className="flex items-center gap-2"><div><p className="text-xs font-medium text-slate-800 break-words">{row.team.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{row.team.city} / {row.team.state}</p></div>{row.team.isYouth && <Badge size="sm" color="purple" icon={<Baby size={10} />}>Jovem</Badge>}</div> },
              { header: 'Responsáveis', render: row => <span className="inline-flex items-center gap-1 text-xs text-slate-700"><Users size={12} className="text-slate-400" />{row.total}</span> },
              { header: 'Arrecadação', render: row => row.total ? <div className="min-w-[120px]"><div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>{row.paid} / {row.total}</span><span>{Math.round(row.percent)}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${row.percent === 100 ? 'bg-emerald-500' : row.percent > 50 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${row.percent}%` }} /></div></div> : <span className="text-xs text-slate-400">—</span> },
              { header: 'Situação', render: row => <Badge size="sm" dot color={!row.total ? 'default' : row.percent === 100 ? 'success' : 'warning'}>{!row.total ? 'Sem cobrança' : row.percent === 100 ? 'Em dia' : 'Pendente'}</Badge> },
              { header: 'Recebido no mês', render: row => <span className="text-xs font-semibold tabular-nums text-slate-800 whitespace-nowrap">{formatCurrency(row.cash)}</span> },
              { header: '', render: () => <ArrowRight size={14} className="text-slate-300" /> },
            ]}
            emptyMessage={<EmptyState icon={Layers} title="Nenhuma equipe encontrada" description={search ? 'Ajuste a busca para encontrar a equipe.' : 'Cadastre equipes para acompanhar a tesouraria.'} />}
            pagination={{ total: filtered.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }} />
        </ContentCard>
      </div>}
      {tab === 'recebimentos' && <ReceiptsTable payments={payments.filter(payment => receivedInPeriod(payment, period.year, period.month))} members={members} teams={teams} showTeam periodLabel={periodLabel} />}
    </Tabs>
  </>;
};

/* ───────────────────────────── Tesouraria da equipe ───────────────────────────── */

const TeamTreasury: React.FC<CommonProps & { team: BaseTeam; userId: string; onBack: () => void; onSaved: (created: Payment[]) => void; reload: () => void }> = ({
  team, userId, members, payments, period, monthlyAmount, periodLabel, selector, onBack, onSaved, reload,
}) => {
  const [tab, setTab] = useState<'familias' | 'recebimentos'>('familias');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [payUnit, setPayUnit] = useState<BillingUnit | null>(null);

  const teamPayments = useMemo(() => payments.filter(payment => payment.teamId === team.id), [payments, team.id]);
  const summary = useMemo(() => teamSummary(team, members, payments, period, monthlyAmount), [team, members, payments, period, monthlyAmount]);
  const rows = useMemo(() => summary.units.map(unit => {
    const ids = unit.payingMembers.map(member => member.id);
    const settlement = monthlySettlement(ids, teamPayments, period.month, period.year);
    const overdue = overdueMonths(unit, teamPayments, period.year, period.month);
    const settled = settlement.status === 'paid' || settlement.status === 'late';
    return { unit, settlement, overdue, settled, charged: ids.length > 0 };
  }), [summary.units, teamPayments, period]);

  const query = normalizeDirectoryText(search);
  const filtered = rows.filter(row => (filter === 'all' || (filter === 'pending' ? row.charged && (!row.settled || row.overdue.length > 0) : row.charged && row.settled && !row.overdue.length))
    && (!query || normalizeDirectoryText(`${row.unit.displayName} ${row.unit.familyName || ''} ${[...row.unit.payingMembers, ...row.unit.exemptMembers].map(member => member.name).join(' ')}`).includes(query)));
  const { page, pageSize, paginatedData, setPage, setPageSize } = usePagination(filtered, 15);

  const chargedRows = rows.filter(row => row.charged);
  const settledCount = chargedRows.filter(row => row.settled).length;
  const tabs = [{ id: 'familias', label: 'Famílias', icon: ListChecks }, { id: 'recebimentos', label: 'Recebimentos', icon: ReceiptText }] as const;

  return <>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={onBack}>Voltar para a tesouraria</Button>
      {selector}
    </div>

    <ContentCard padding="md">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600"><Wallet size={24} /></div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 break-words">{team.name}</h1>
          <p className="mt-1 text-xs text-slate-500">{team.city} / {team.state} · Referência {periodLabel}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge color={team.isYouth ? 'purple' : 'info'} dot>{team.isYouth ? 'MFC Jovem' : 'Equipe base'}</Badge>
            <span className="text-xs text-slate-500">Mensalidade {formatCurrency(monthlyAmount)} por família (casal divide entre os dois)</span>
          </div>
        </div>
      </div>
    </ContentCard>

    <StatGrid cols={3}>
      <StatCard title="Recebido no mês" value={formatCurrency(summary.cash)} icon={Wallet} color="info" description={`Caixa de ${periodLabel}`} />
      <StatCard title="Em aberto da referência" value={formatCurrency(summary.open)} icon={Clock} color="warning" description={`Mensalidades de ${periodLabel}`} />
      <StatCard title="Famílias em dia" value={`${settledCount} / ${chargedRows.length}`} icon={CheckCircle2} color="success" description={`${rows.length - chargedRows.length} sem cobrança`} />
    </StatGrid>

    <Tabs<typeof tabs[number]['id']> items={tabs} value={tab} onChange={setTab} label="Tesouraria da equipe">
      {tab === 'familias' && <div className="space-y-3">
        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem grow><FilterLineSearch aria-label="Buscar família ou membro" value={search} onChange={setSearch} placeholder="Família ou membro…" /></FilterLineItem>
            <FilterLineItem><FilterLineSegmented value={filter} onChange={value => setFilter(String(value))} options={[{ value: 'all', label: 'Todas' }, { value: 'pending', label: 'Pendentes' }, { value: 'ok', label: 'Em dia' }]} /></FilterLineItem>
          </FilterLineSection>
          <FilterLineSection><span className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'família' : 'famílias'}</span></FilterLineSection>
        </FilterLine>
        <ContentCard padding="none">
          <GridTable<typeof rows[number]> data={paginatedData} keyExtractor={row => row.unit.key} noDesktopCard
            columns={[
              { header: 'Família / responsável', render: ({ unit }) => <div className="min-w-0"><p className="text-xs font-medium text-slate-800 break-words">{unit.displayName}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{unit.type === 'couple' ? 'Casal · paga junto' : unit.payingMembers.length ? 'Individual' : 'Sem cobrança'}</p>
                {unit.exemptMembers.length > 0 && <p className="mt-0.5 text-[11px] text-slate-400 break-words">Isentos: {unit.exemptMembers.map(member => member.nickname || member.name.split(' ')[0]).join(', ')}</p>}</div> },
              { header: 'Contribuintes', render: ({ unit }) => unit.payingMembers.length ? <ul className="space-y-0.5">{unit.payingMembers.map(member => <li key={member.id} className="flex justify-between gap-3 text-xs text-slate-700"><span className="break-words">{member.nickname || member.name.split(' ')[0]}</span><span className="tabular-nums text-slate-500">{formatCurrency(unit.amountPerPerson)}</span></li>)}</ul> : <span className="text-xs text-slate-400">Nenhum</span> },
              { header: `Referência ${shortMonths[period.month - 1]}`, render: ({ unit, settlement, charged }) => charged ? <div><Badge size="sm" dot color={settlement.status === 'paid' ? 'success' : settlement.status === 'late' ? 'warning' : settlement.status === 'partial' ? 'purple' : 'danger'}>{settlement.label}</Badge><p className="mt-1 text-[11px] tabular-nums text-slate-500">{formatCurrency(unit.monthlyTotal)}</p></div> : <Badge size="sm">Sem cobrança</Badge> },
              { header: 'Atrasos', render: ({ overdue, charged }) => !charged ? <span className="text-xs text-slate-400">—</span> : overdue.length ? <span title={overdue.map(month => monthNames[month - 1]).join(', ')}><Badge size="sm" color="danger">{overdue.length} {overdue.length === 1 ? 'mês' : 'meses'}</Badge></span> : <span className="text-xs text-emerald-700">Nenhum</span> },
              { header: 'Ação', render: ({ unit, settled, overdue, charged }) => !charged ? <span className="text-[11px] text-slate-400">Isento</span>
                : <Button size="xs" variant={settled && !overdue.length ? 'outline' : 'primary'} iconLeft={<HandCoins size={12} />} onClick={() => setPayUnit(unit)}>{settled && !overdue.length ? 'Antecipar' : 'Receber'}</Button> },
            ]}
            emptyMessage={<EmptyState icon={Users} title="Nenhuma família encontrada" description={search || filter !== 'all' ? 'Ajuste a busca ou o filtro.' : 'Esta equipe ainda não tem membros ativos.'} />}
            pagination={{ total: filtered.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }} />
        </ContentCard>
      </div>}
      {tab === 'recebimentos' && <ReceiptsTable payments={teamPayments.filter(payment => receivedInPeriod(payment, period.year, period.month))} members={members} periodLabel={periodLabel} />}
    </Tabs>

    <FamilyPaymentModal isOpen={!!payUnit} onClose={() => { setPayUnit(null); reload(); }} unit={payUnit} teamId={team.id} userId={userId}
      payments={teamPayments} defaultMonth={period.month} defaultYear={period.year} onSaved={onSaved} />
  </>;
};

/* ───────────────────────────── Recebimentos do mês ───────────────────────────── */

const ReceiptsTable: React.FC<{ payments: Payment[]; members: Member[]; teams?: BaseTeam[]; showTeam?: boolean; periodLabel: string }> = ({ payments, members, teams = [], showTeam, periodLabel }) => {
  const sorted = useMemo(() => [...payments].sort((a, b) => b.date.localeCompare(a.date)), [payments]);
  const { page, pageSize, paginatedData, setPage, setPageSize } = usePagination(sorted, 15);
  const total = sorted.reduce((sum, payment) => sum + payment.amount, 0);
  return <div className="space-y-3">
    <p className="text-xs text-slate-500">Valores que entraram no caixa em {periodLabel}: <strong className="text-slate-800">{formatCurrency(total)}</strong>. A referência informa qual mensalidade foi quitada; mensalidades atrasadas contam no mês do recebimento.</p>
    <ContentCard padding="none">
      <GridTable<Payment> data={paginatedData} keyExtractor={payment => payment.id} noDesktopCard
        columns={[
          { header: 'Responsável', render: payment => <div><p className="text-xs font-medium text-slate-800 break-words">{payment.memberName || members.find(member => member.id === payment.memberId)?.name || 'Membro'}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{showTeam ? teams.find(team => team.id === payment.teamId)?.name : payment.familyName}</p></div> },
          { header: 'Mensalidade', render: payment => { const [m, y] = payment.referenceMonth.split('/').map(Number); return <span className="text-xs whitespace-nowrap text-slate-700">{shortMonths[m - 1] || m}/{y}</span>; } },
          { header: 'Recebido em', render: payment => <span className="text-xs whitespace-nowrap text-slate-700">{formatPaymentDate(payment.date)}</span> },
          { header: 'Situação', render: payment => <Badge size="sm" dot color={paidLate(payment) ? 'warning' : 'success'}>{paidLate(payment) ? 'Pago em atraso' : 'Pago'}</Badge> },
          { header: 'Valor', render: payment => <span className="text-xs font-semibold tabular-nums whitespace-nowrap text-slate-800">{formatCurrency(payment.amount)}</span> },
        ]}
        emptyMessage={<EmptyState icon={ReceiptText} title="Nenhum recebimento neste período" description="Os recebimentos lançados neste mês aparecem aqui." />}
        pagination={{ total: sorted.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }} />
    </ContentCard>
  </div>;
};

export default FinanceView;
