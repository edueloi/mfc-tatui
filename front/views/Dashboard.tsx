import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Layers, BarChart3, TrendingUp, Cake, Heart, Wallet, ArrowUpRight, ArrowDownRight, Home, MessageCircle, Loader2, PartyPopper, LayoutDashboard, CircleDollarSign, History,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { api } from '../api';
import { BaseTeam, Member } from '../types';
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard, PanelCard, Tabs, Button, Badge, Select, Combobox, EmptyState,
  FilterLine, FilterLineSection, FilterLineItem, FilterLineSegmented,
} from '../components/ui';
import { maskPhone } from '../utils/masks';
import { dateLabel } from '../utils/dates';
import { whatsappUrl } from '../utils/whatsapp';
import { ageDistribution } from '../utils/ageRanges';
import { BIRTHDAY_GROUP_LABEL, BirthdayGroup, birthdayGroup, birthdayMessage, weddingMessage } from '../utils/birthdayMessages';

interface Summary {
  stats: { totalMembers?: number; teamsCount?: number; male?: number; female?: number; activeMembers?: number; children?: number; youth?: number; adult?: number; elderly?: number };
  barData: { id: string; name: string; paid: number; pending: number; total: number }[];
  trendData: { month: string; value: number }[];
}
interface LedgerEntry { id?: string; type: 'IN' | 'OUT'; amount: number; description: string; date: string; }
interface Celebration {
  key: string; kind: 'birthday' | 'wedding'; day: number; title: string; subtitle: string; detail: string; phone: string; message: string;
  group?: BirthdayGroup; memberId?: string; isToday: boolean; inNextDays: boolean;
}

const GOAL = 70;
const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const shortMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const tabs = [
  { id: 'geral', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'aniversarios', label: 'Aniversários', icon: Cake },
  { id: 'financeiro', label: 'Financeiro', icon: CircleDollarSign },
] as const;

const emptySummary: Summary = { stats: {}, barData: [], trendData: [] };

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [activeTab, setActiveTab] = useState<typeof tabs[number]['id']>('geral');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [when, setWhen] = useState('month');
  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => Promise.all([api.getTeams(), api.getMembers(), api.getLedger().catch(() => []), api.getDashboardSummary(month, year)])
      .then(([teamItems, memberItems, ledgerItems, summaryData]) => {
        if (cancelled) return;
        setTeams(teamItems); setMembers(memberItems); setLedger(ledgerItems); setSummary({ ...emptySummary, ...summaryData }); setError(false);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    load();
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.removeEventListener('focus', load); };
  }, [month, year, retry]);

  const isCurrentPeriod = Number(month) === now.getMonth() + 1 && Number(year) === now.getFullYear();
  const today = now.getDate();
  const teamName = (id?: string | null) => teams.find(team => team.id === id)?.name || 'Sem equipe';
  const inScope = (member: Member) => teamIds.length === 0 || (!!member.teamId && teamIds.includes(member.teamId));

  const celebrations = useMemo(() => {
    const targetMonth = Number(month);
    const targetYear = Number(year);
    const list: Celebration[] = [];
    const seenWeddings = new Set<string>();
    members.filter(member => inScope(member) && member.status !== 'Inativo').forEach(member => {
      const [bYear, bMonth, bDay] = (member.dob || '').slice(0, 10).split('-').map(Number);
      if (bMonth === targetMonth && bDay) {
        const age = bYear ? targetYear - bYear : null;
        const group = birthdayGroup(age, member.gender);
        list.push({
          key: `b-${member.id}`, kind: 'birthday', day: bDay, title: member.name, group, memberId: member.id,
          subtitle: [teamName(member.teamId), age ? `${age} anos` : ''].filter(Boolean).join(' · '),
          detail: BIRTHDAY_GROUP_LABEL[group], phone: member.phone || '', message: birthdayMessage(group, member.nickname || member.name, member.gender, age),
          isToday: isCurrentPeriod && bDay === today, inNextDays: isCurrentPeriod && bDay >= today && bDay < today + 7,
        });
      }
      const [mYear, mMonth, mDay] = (member.marriageDate || '').slice(0, 10).split('-').map(Number);
      if (mMonth === targetMonth && mDay) {
        const coupleKey = `${member.familyName || member.name}-${member.marriageDate}`;
        if (seenWeddings.has(coupleKey)) return;
        seenWeddings.add(coupleKey);
        const years = mYear ? targetYear - mYear : 0;
        const spouse = member.spouseName ? ` & ${member.spouseName}` : '';
        const family = members.filter(other => other.familyName && other.familyName === member.familyName);
        const phone = [member, ...family].find(other => other.phone)?.phone || '';
        list.push({
          key: `w-${coupleKey}`, kind: 'wedding', day: mDay, title: `${member.name}${spouse}`, memberId: member.id,
          subtitle: [teamName(member.teamId), years > 0 ? `${years} ${years === 1 ? 'ano' : 'anos'} de união` : ''].filter(Boolean).join(' · '),
          detail: 'Casamento', phone, message: weddingMessage(`${member.nickname || member.name.split(' ')[0]}${member.spouseName ? ` e ${member.spouseName.split(' ')[0]}` : ''}`, years),
          isToday: isCurrentPeriod && mDay === today, inNextDays: isCurrentPeriod && mDay >= today && mDay < today + 7,
        });
      }
    });
    return list.sort((a, b) => a.day - b.day || a.title.localeCompare(b.title, 'pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, teams, month, year, teamIds, isCurrentPeriod, today]);

  const visibleCelebrations = celebrations.filter(item => when === 'today' ? item.isToday : when === 'week' ? item.inNextDays : true);
  const todayCount = celebrations.filter(item => item.isToday).length;

  const teamResults = useMemo(() => summary.barData
    .filter(team => team.total > 0 && (teamIds.length === 0 || teamIds.includes(team.id)))
    .map(team => ({ ...team, percent: Math.round((team.paid / team.total) * 100) }))
    .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name, 'pt-BR')), [summary.barData, teamIds]);
  const totalPaid = teamResults.reduce((sum, team) => sum + team.paid, 0);
  const totalCharged = teamResults.reduce((sum, team) => sum + team.total, 0);
  const averagePercent = totalCharged ? Math.round((totalPaid / totalCharged) * 100) : 0;

  const finance = useMemo(() => {
    const prefix = `${year}-${month}`;
    const monthEntries = ledger.filter(entry => entry.date?.startsWith(prefix));
    return {
      balance: ledger.reduce((sum, entry) => sum + (entry.type === 'IN' ? entry.amount : -entry.amount), 0),
      income: monthEntries.filter(entry => entry.type === 'IN').reduce((sum, entry) => sum + entry.amount, 0),
      expenses: monthEntries.filter(entry => entry.type === 'OUT').reduce((sum, entry) => sum + entry.amount, 0),
      recent: [...ledger].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    };
  }, [ledger, month, year]);

  const trend = summary.trendData.map(point => ({ label: shortMonths[Number(point.month.slice(0, 2)) - 1] || point.month, total: point.value }));
  const stats = summary.stats;
  const families = new Set(members.filter(member => member.familyName?.trim()).map(member => member.familyName)).size;
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 3 + i)).map(value => ({ value, label: value }));
  const periodLabel = `${monthNames[Number(month) - 1]} de ${year}`;

  if (loading) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando painel…</div></PageWrapper>;
  if (error && !members.length) return <PageWrapper><ContentCard><EmptyState icon={BarChart3} title="Não foi possível carregar o painel" description="Confira a conexão e tente novamente."
    action={<Button onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Tentar novamente</Button>} /></ContentCard></PageWrapper>;

  const profileMembers = members.filter(inScope);
  const { rows: ageRows, unknown: ageUnknown } = ageDistribution(profileMembers);
  const ageTotal = Math.max(1, ...ageRows.map(row => row.value));
  const female = profileMembers.filter(member => member.gender === 'Feminino').length;
  const male = profileMembers.filter(member => member.gender === 'Masculino').length;
  const sexTotal = female + male || 1;
  const celebrationTabs = tabs.map(tab => tab.id === 'aniversarios' && celebrations.length ? { ...tab, label: `Aniversários (${celebrations.length})` } : tab);

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle title="Painel" icon={BarChart3} description={`Resumo do movimento em ${periodLabel}.`}
          action={<Button variant="outline" size="sm" iconLeft={<TrendingUp size={14} />} onClick={() => navigate('/relatorios')}>Abrir relatórios</Button>} />

        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem><Select aria-label="Mês" size="sm" value={month} onChange={event => setMonth(event.target.value)} options={monthNames.map((label, index) => ({ value: String(index + 1).padStart(2, '0'), label }))} /></FilterLineItem>
            <FilterLineItem><Select aria-label="Ano" size="sm" value={year} onChange={event => setYear(event.target.value)} options={yearOptions} /></FilterLineItem>
            <FilterLineItem grow minWidth={220}>
              <Combobox multiple placeholder="Todas as equipes" searchPlaceholder="Buscar equipe…" value={teamIds} onChange={ids => setTeamIds(ids as string[])}
                options={teams.map(team => ({ value: team.id, label: team.name, subtitle: `${team.city} / ${team.state}` }))} />
            </FilterLineItem>
          </FilterLineSection>
          {teamIds.length > 0 && <FilterLineSection align="right"><Button variant="ghost" size="sm" onClick={() => setTeamIds([])}>Limpar equipes ({teamIds.length})</Button></FilterLineSection>}
        </FilterLine>

        {todayCount > 0 && <ContentCard padding="md" className="border-blue-100 bg-blue-50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm text-blue-900"><PartyPopper size={16} className="shrink-0" />{todayCount === 1 ? '1 celebração hoje' : `${todayCount} celebrações hoje`}: envie os parabéns pelo WhatsApp.</p>
            <Button size="xs" onClick={() => { setActiveTab('aniversarios'); setWhen('today'); }}>Ver aniversariantes de hoje</Button>
          </div>
        </ContentCard>}

        <Tabs<typeof tabs[number]['id']> items={celebrationTabs} value={activeTab} onChange={setActiveTab} label="Seções do painel">
          {activeTab === 'geral' && <div className="space-y-3">
            <StatGrid cols={4}>
              <StatCard title="MFCistas ativos" value={stats.activeMembers || 0} icon={Users} color="info" description={`${stats.totalMembers || 0} cadastrados`} />
              <StatCard title="Equipes base" value={stats.teamsCount || teams.length} icon={Layers} color="warning" />
              <StatCard title="Famílias" value={families} icon={Home} color="success" description="Núcleos familiares" />
              <StatCard title="Adimplência" value={`${averagePercent}%`} icon={TrendingUp} color={averagePercent >= GOAL ? 'success' : 'danger'} description={`${totalPaid} de ${totalCharged} pagaram`} />
            </StatGrid>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <PanelCard title="Adimplência por equipe" description={`Quem pagou a mensalidade de ${periodLabel}.`}>
                {teamResults.length ? <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}><BarChart data={teamResults} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} unit="%" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={92} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`${value}%`, 'Adimplência']} />
                    <Bar dataKey="percent" radius={[0, 3, 3, 0]} barSize={14}>{teamResults.map(team => <Cell key={team.id} fill={team.percent >= GOAL ? '#10b981' : '#f59e0b'} />)}</Bar>
                  </BarChart></ResponsiveContainer>
                </div> : <EmptyState icon={Layers} title="Sem equipes com cobrança" description="Nenhuma equipe tem contribuintes neste período." />}
              </PanelCard>
              <PanelCard title="Perfil dos MFCistas" description={`${profileMembers.length} cadastrados${teamIds.length ? ' nas equipes filtradas' : ''}.`} className="self-start">
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-slate-600"><span>Mulheres · {female}</span><span>Homens · {male}</span></div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${female} mulheres e ${male} homens`}>
                      <div className="bg-pink-400" style={{ width: `${(female / sexTotal) * 100}%` }} /><div className="bg-blue-500" style={{ width: `${(male / sexTotal) * 100}%` }} />
                    </div>
                  </div>
                  <ul className="space-y-2.5">{ageRows.map(row => <li key={row.label}>
                    <div className="mb-1 flex justify-between text-xs text-slate-600"><span>{row.label}</span><span className="tabular-nums">{row.value}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${(row.value / ageTotal) * 100}%` }} /></div>
                  </li>)}</ul>
                  {ageUnknown > 0 && <p className="text-[11px] text-slate-500">{ageUnknown} sem data de nascimento não entram nas faixas.</p>}
                </div>
              </PanelCard>
            </div>
          </div>}

          {activeTab === 'aniversarios' && <div className="space-y-3">
            <FilterLine>
              <FilterLineSection grow>
                {isCurrentPeriod
                  ? <FilterLineSegmented value={when} onChange={value => setWhen(String(value))} options={[{ value: 'month', label: 'Mês todo' }, { value: 'week', label: 'Próximos 7 dias' }, { value: 'today', label: 'Hoje' }]} />
                  : <span className="text-xs text-slate-500">Celebrações de {periodLabel}</span>}
              </FilterLineSection>
              <FilterLineSection align="right"><span className="text-xs text-slate-500">{visibleCelebrations.length} {visibleCelebrations.length === 1 ? 'celebração' : 'celebrações'}</span></FilterLineSection>
            </FilterLine>
            <ContentCard padding="none">
              {visibleCelebrations.length ? <ul className="divide-y divide-slate-100">
                {visibleCelebrations.map(item => {
                  const url = whatsappUrl(item.phone, item.message);
                  return <li key={item.key} className="flex flex-wrap items-center gap-3 p-3">
                    <div className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border text-[10px] leading-none ${item.isToday ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                      <span className="text-sm font-semibold">{item.day}</span><span className="mt-0.5 uppercase">{shortMonths[Number(month) - 1]}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.kind === 'birthday' && item.memberId
                          ? <button type="button" className="text-left text-[13px] font-medium text-slate-900 break-words hover:text-blue-600 focus-visible:outline-blue-500" onClick={() => navigate(`/mfcistas/${item.memberId}`)}>{item.title}</button>
                          : <span className="text-[13px] font-medium text-slate-900 break-words">{item.title}</span>}
                        {item.isToday && <Badge size="sm" color="success" dot>Hoje</Badge>}
                        <Badge size="sm" color={item.kind === 'wedding' ? 'danger' : 'default'} icon={item.kind === 'wedding' ? <Heart size={10} /> : <Cake size={10} />}>{item.detail}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 break-words">{item.subtitle}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{item.phone ? maskPhone(item.phone) : 'Telefone não informado'}</p>
                    </div>
                    <Button size="xs" variant="success" disabled={!url} iconLeft={<MessageCircle size={12} />} title={url ? 'Abrir o WhatsApp com a mensagem pronta' : 'Telefone não informado ou incompleto'}
                      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>Parabenizar</Button>
                  </li>;
                })}
              </ul> : <EmptyState icon={Cake} title="Nenhuma celebração" description={when === 'month' ? `Ninguém faz aniversário ou comemora casamento em ${periodLabel}.` : 'Nada neste período. Veja o mês todo.'} />}
            </ContentCard>
            <p className="text-xs text-slate-500">A mensagem muda conforme o grupo: jovens (menores de 18), mulheres e homens do MFC e terceira idade (60+). O WhatsApp abre com o texto pronto para você revisar e enviar.</p>
          </div>}

          {activeTab === 'financeiro' && <div className="space-y-3">
            <StatGrid cols={3}>
              <StatCard title="Saldo em caixa" value={formatCurrency(finance.balance)} icon={Wallet} color={finance.balance >= 0 ? 'success' : 'danger'} description="Todo o período" />
              <StatCard title="Receitas do mês" value={formatCurrency(finance.income)} icon={ArrowUpRight} color="info" description={periodLabel} />
              <StatCard title="Despesas do mês" value={formatCurrency(finance.expenses)} icon={ArrowDownRight} color="danger" description={periodLabel} />
            </StatGrid>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <PanelCard title="Arrecadação dos últimos 6 meses" description="Valores recebidos em cada mês.">
                <div className="h-60 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}><BarChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Recebido']} />
                    <Bar dataKey="total" fill="#2563eb" radius={[3, 3, 0, 0]} barSize={26} />
                  </BarChart></ResponsiveContainer>
                </div>
              </PanelCard>
              <PanelCard title="Últimas movimentações" description="Livro caixa." icon={History}
                action={<Button variant="ghost" size="xs" onClick={() => navigate('/livro-caixa')}>Ver livro caixa</Button>}>
                {finance.recent.length ? <ul className="divide-y divide-slate-100">{finance.recent.map((entry, index) => <li key={entry.id || index} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0"><p className="text-[13px] text-slate-800 break-words">{entry.description || 'Sem descrição'}</p><p className="text-[11px] text-slate-500">{dateLabel(entry.date)}</p></div>
                  <span className={`shrink-0 text-xs font-semibold tabular-nums ${entry.type === 'IN' ? 'text-emerald-700' : 'text-red-600'}`}>{entry.type === 'IN' ? '+' : '−'} {formatCurrency(entry.amount)}</span>
                </li>)}</ul> : <EmptyState icon={Wallet} title="Sem movimentações" description="Os lançamentos do livro caixa aparecem aqui." />}
              </PanelCard>
            </div>
          </div>}
        </Tabs>
      </div>
    </PageWrapper>
  );
};

export default Dashboard;
