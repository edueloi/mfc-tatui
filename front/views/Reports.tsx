import React, { useEffect, useMemo, useState } from 'react';
import { Download, TrendingUp, Users, Layers, Target, BarChart3, Loader2, Table2 } from 'lucide-react';
import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { api } from '../api';
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard, PanelCard, FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch,
  Select, Button, Badge, EmptyState, Tabs, GridTable, usePagination,
} from '../components/ui';
import { normalizeDirectoryText } from '../utils/memberDirectory';

interface TeamResult { id: string; name: string; paid: number; pending: number; total: number; }
interface Summary {
  stats: { activeMembers?: number; children?: number; youth?: number; adult?: number; elderly?: number };
  barData: TeamResult[];
  trendData: { month: string; value: number }[];
  pieData: { name: string; value: number }[];
}

const GOAL = 70;
const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const shortMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const monthOptions = monthNames.map((label, index) => ({ value: String(index + 1).padStart(2, '0'), label }));
const statusOptions = [
  { value: 'all', label: 'Todas as situações' },
  { value: 'goal', label: `Meta atingida (${GOAL}%+)` },
  { value: 'risk', label: `Precisa de apoio (<${GOAL}%)` },
  { value: 'none', label: 'Sem cobrança' },
];
const PIE_COLORS = ['#2563eb', '#ec4899', '#94a3b8'];
const tabs = [
  { id: 'geral', label: 'Visão geral', icon: BarChart3 },
  { id: 'equipes', label: 'Equipes', icon: Table2 },
] as const;

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const percent = (team: TeamResult) => team.total > 0 ? Math.round((team.paid / team.total) * 100) : null;
const situation = (team: TeamResult) => { const value = percent(team); return value === null ? 'none' : value >= GOAL ? 'goal' : 'risk'; };
const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

const Reports: React.FC = () => {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [activeTab, setActiveTab] = useState<typeof tabs[number]['id']>('geral');
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const yearOptions = Array.from({ length: 4 }, (_, index) => String(now.getFullYear() - index)).map(value => ({ value, label: value }));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getDashboardSummary(month, year)
      .then((data: Summary) => { if (!cancelled) { setSummary(data); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, year, retry]);

  const allTeams = summary?.barData || [];
  const teamOptions = [{ value: 'all', label: 'Todas as equipes' }, ...[...allTeams].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(team => ({ value: team.id, label: team.name }))];

  const teams = useMemo(() => {
    const query = normalizeDirectoryText(search);
    return allTeams
      .filter(team => (teamFilter === 'all' || team.id === teamFilter) && (statusFilter === 'all' || situation(team) === statusFilter) && (!query || normalizeDirectoryText(team.name).includes(query)))
      .sort((a, b) => (percent(b) ?? -1) - (percent(a) ?? -1) || a.name.localeCompare(b.name, 'pt-BR'));
  }, [allTeams, teamFilter, statusFilter, search]);

  const charged = teams.filter(team => team.total > 0);
  const totalPaid = charged.reduce((sum, team) => sum + team.paid, 0);
  const totalCharged = charged.reduce((sum, team) => sum + team.total, 0);
  const average = totalCharged ? Math.round((totalPaid / totalCharged) * 100) : 0;
  const onGoal = charged.filter(team => (percent(team) || 0) >= GOAL).length;
  const hasFilter = teamFilter !== 'all' || statusFilter !== 'all' || !!search;
  const periodLabel = `${monthNames[Number(month) - 1]} de ${year}`;
  const { page, pageSize, paginatedData, setPage, setPageSize } = usePagination(teams, 15);

  const chartTeams = charged.map(team => ({ name: team.name, adimplencia: percent(team) || 0 }));
  const trend = (summary?.trendData || []).map(point => ({ label: shortMonths[Number(point.month.slice(0, 2)) - 1] || point.month, total: point.value }));
  const sexPie = (summary?.pieData || []).filter(item => item.value > 0);
  const ageBars = [
    { name: 'Até 12 anos', total: summary?.stats.children || 0 }, { name: '13 a 18', total: summary?.stats.youth || 0 },
    { name: '19 a 59', total: summary?.stats.adult || 0 }, { name: '60+', total: summary?.stats.elderly || 0 },
  ];

  const exportCsv = () => {
    const rows = [['Equipe', 'Pagos', 'Pendentes', 'Cobráveis', 'Adimplência (%)', 'Situação'],
      ...teams.map(team => [team.name, team.paid, team.pending, team.total, percent(team) ?? '', statusOptions.find(option => option.value === situation(team))?.label.replace(/ \(.*\)/, '') || ''])];
    const csv = '﻿' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `relatorio-mfc-${year}-${month}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  if (loading && !summary) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando relatórios…</div></PageWrapper>;

  if (error && !summary) return <PageWrapper><ContentCard><EmptyState icon={BarChart3} title="Não foi possível carregar os relatórios" description="Confira a conexão e tente novamente."
    action={<Button onClick={() => setRetry(value => value + 1)}>Tentar novamente</Button>} /></ContentCard></PageWrapper>;

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle title="Relatórios" icon={BarChart3} description={`Adimplência das equipes em ${periodLabel}.`}
          action={<Button variant="outline" size="sm" disabled={!teams.length} iconLeft={<Download size={14} />} onClick={exportCsv}>Exportar CSV</Button>} />

        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem><Select aria-label="Mês" value={month} onChange={event => setMonth(event.target.value)} options={monthOptions} /></FilterLineItem>
            <FilterLineItem><Select aria-label="Ano" value={year} onChange={event => setYear(event.target.value)} options={yearOptions} /></FilterLineItem>
            <FilterLineItem><Select aria-label="Equipe" value={teamFilter} onChange={event => setTeamFilter(event.target.value)} options={teamOptions} /></FilterLineItem>
            <FilterLineItem><Select aria-label="Situação" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} options={statusOptions} /></FilterLineItem>
            <FilterLineItem grow><FilterLineSearch aria-label="Buscar equipe" value={search} onChange={setSearch} placeholder="Buscar equipe…" /></FilterLineItem>
          </FilterLineSection>
          <FilterLineSection align="right">
            {loading && <Loader2 size={14} className="animate-spin text-slate-400" aria-label="Atualizando" />}
            <span className="text-xs text-slate-500">{teams.length} {teams.length === 1 ? 'equipe' : 'equipes'}</span>
            {hasFilter && <Button variant="ghost" size="sm" onClick={() => { setTeamFilter('all'); setStatusFilter('all'); setSearch(''); }}>Limpar filtros</Button>}
          </FilterLineSection>
        </FilterLine>

        <StatGrid cols={4}>
          <StatCard title="Membros ativos" value={summary?.stats.activeMembers || 0} icon={Users} color="info" />
          <StatCard title="Equipes com cobrança" value={charged.length} icon={Layers} color="success" description={`${teams.length - charged.length} sem cobrança`} />
          <StatCard title="Adimplência média" value={`${average}%`} icon={Target} color="purple" description={`${totalPaid} de ${totalCharged} pagaram`} />
          <StatCard title={`Equipes na meta (${GOAL}%)`} value={onGoal} icon={TrendingUp} color={onGoal ? 'success' : 'warning'} />
        </StatGrid>

        <Tabs<typeof tabs[number]['id']> items={tabs} value={activeTab} onChange={setActiveTab} label="Visualização dos relatórios">
          {activeTab === 'geral' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PanelCard title="Adimplência por equipe" description={`Percentual de contribuintes que pagaram em ${periodLabel}.`} className="lg:col-span-2">
              {chartTeams.length ? <div className="h-72 min-w-0">
                <ResponsiveContainer width="100%" height="100%"><BarChart data={chartTeams}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} interval={0} />
                  <YAxis domain={[0, 100]} unit="%" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Adimplência']} />
                  <Bar dataKey="adimplencia" radius={[3, 3, 0, 0]} barSize={26}>
                    {chartTeams.map(team => <Cell key={team.name} fill={team.adimplencia >= GOAL ? '#10b981' : '#f59e0b'} />)}
                  </Bar>
                </BarChart></ResponsiveContainer>
              </div> : <EmptyState icon={BarChart3} title="Nenhuma equipe encontrada" description={hasFilter ? 'Ajuste os filtros para ver o gráfico.' : 'Nenhuma equipe tem contribuintes neste período.'} />}
            </PanelCard>
            <PanelCard title="Arrecadação dos últimos 6 meses" description="Valores recebidos em cada mês, pela data do recebimento.">
              <div className="h-64 min-w-0">
                <ResponsiveContainer width="100%" height="100%"><BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Recebido']} />
                  <Bar dataKey="total" fill="#2563eb" radius={[3, 3, 0, 0]} barSize={26} />
                </BarChart></ResponsiveContainer>
              </div>
            </PanelCard>
            <PanelCard title="Membros por sexo" description="Todos os MFCistas cadastrados.">
              {sexPie.length ? <div className="h-64 min-w-0">
                <ResponsiveContainer width="100%" height="100%"><PieChart>
                  <Pie data={sexPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={75} paddingAngle={3}>
                    {sexPie.map((item, index) => <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart></ResponsiveContainer>
              </div> : <EmptyState icon={Users} title="Sem dados" description="Informe o sexo dos MFCistas para ver o gráfico." />}
            </PanelCard>
            <PanelCard title="Faixa etária" description="Todos os MFCistas cadastrados." className="lg:col-span-2">
              <div className="h-56 min-w-0">
                <ResponsiveContainer width="100%" height="100%"><BarChart data={ageBars}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [value, 'Membros']} />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[3, 3, 0, 0]} barSize={40} />
                </BarChart></ResponsiveContainer>
              </div>
            </PanelCard>
          </div>}

          {activeTab === 'equipes' && <ContentCard padding="none">
            <GridTable<TeamResult> data={paginatedData} keyExtractor={team => team.id} noDesktopCard isLoading={loading}
              columns={[
                { header: 'Equipe', render: team => <span className="text-xs font-medium text-slate-800 break-words">{team.name}</span> },
                { header: 'Pagaram', render: team => <span className="text-xs tabular-nums text-emerald-700">{team.paid}</span> },
                { header: 'Pendentes', render: team => <span className="text-xs tabular-nums text-red-600">{team.pending}</span> },
                { header: 'Contribuintes', render: team => <span className="text-xs tabular-nums text-slate-700">{team.total}</span> },
                { header: 'Adimplência', render: team => { const value = percent(team); return <div className="flex min-w-[110px] items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${(value || 0) >= GOAL ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${value || 0}%` }} /></div>
                  <span className="w-9 text-right text-xs font-semibold tabular-nums text-slate-800">{value === null ? '—' : `${value}%`}</span></div>; } },
                { header: 'Situação', render: team => { const value = situation(team); return <Badge size="sm" dot color={value === 'goal' ? 'success' : value === 'risk' ? 'warning' : 'default'}>{value === 'goal' ? 'Meta atingida' : value === 'risk' ? 'Precisa de apoio' : 'Sem cobrança'}</Badge>; } },
              ]}
              emptyMessage={<EmptyState icon={Layers} title="Nenhuma equipe encontrada" description={hasFilter ? 'Ajuste os filtros para encontrar a equipe.' : 'Não há equipes cadastradas.'} />}
              pagination={{ total: teams.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }} />
          </ContentCard>}
        </Tabs>
      </div>
    </PageWrapper>
  );
};

export default Reports;
