import React, { useEffect, useMemo, useState } from 'react';
import { Download, TrendingUp, Users, Wallet, Layers, Target, BarChart3, AreaChart as AreaIcon } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { api } from '../api';
import { BaseTeam } from '../types';
import {
  PageWrapper,
  SectionTitle,
  StatGrid,
  StatCard,
  ContentCard,
  FilterLine,
  FilterLineSection,
  FilterLineItem,
  FilterLineSearch,
  FilterLineSegmented,
  Select,
  Button,
  Input,
  Divider,
} from '../components/ui';

const monthOptions = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' }, { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' }, { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
];

const yearOptions = [
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
  { value: '2022', label: '2022' },
];

const Reports: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('06');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [summary, setSummary] = useState<any>({ stats: {}, barData: [], trendData: [], pieData: [] });
  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [minimumGoal, setMinimumGoal] = useState(0);
  const [searchTeam, setSearchTeam] = useState('');
  const [viewType, setViewType] = useState<'bar' | 'trend'>('bar');

  useEffect(() => {
    api.getDashboardSummary(selectedMonth, selectedYear)
      .then(setSummary)
      .catch(() => setSummary({ stats: {}, barData: [], trendData: [], pieData: [] }));
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    api.getTeams().then(setTeams).catch(() => setTeams([]));
  }, []);

  const teamPerformanceData = useMemo(() => {
    const source = summary.barData || [];
    return source
      .filter((team: any) => selectedTeamId === 'all' || team.id === selectedTeamId)
      .filter((team: any) => (team.value || 0) >= minimumGoal)
      .filter((team: any) => {
        if (statusFilter === 'high') return (team.value || 0) >= 70;
        if (statusFilter === 'risk') return (team.value || 0) < 70;
        return true;
      })
      .filter((team: any) => team.name?.toLowerCase().includes(searchTeam.toLowerCase()));
  }, [summary, selectedTeamId, minimumGoal, statusFilter, searchTeam]);

  const topTeams = useMemo(() => {
    return [...teamPerformanceData]
      .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
      .slice(0, 5);
  }, [teamPerformanceData]);

  const trendData = useMemo(() => {
    return (summary.trendData || []).map((point: any, index: number) => ({
      ...point,
      meta: Math.min(100, (point.value || 0) + (index % 2 === 0 ? 5 : 2)),
    }));
  }, [summary]);

  const performanceAvg = Math.round(
    teamPerformanceData.reduce((acc: number, item: any) => acc + (item.value || 0), 0) /
    Math.max(teamPerformanceData.length, 1)
  );

  const teamSelectOptions = [
    { value: 'all', label: 'Todas as equipes' },
    ...teams.map(t => ({ value: t.id, label: t.name })),
  ];

  const statusOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'high', label: 'Meta atingida (70%+)' },
    { value: 'risk', label: 'Em risco (<70%)' },
  ];

  const exportCsv = () => {
    const rows = [
      ['Equipe', 'Arrecadacao(%)', 'Status'],
      ...teamPerformanceData.map((team: any) => [
        team.name,
        String(team.value || 0),
        (team.value || 0) >= 70 ? 'Meta atingida' : 'Em risco',
      ]),
    ];
    const csvContent = rows.map(row => row.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-mfc-${selectedMonth}-${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <PageWrapper>
      <div className="space-y-6">

        {/* Header */}
        <SectionTitle
          title="Central de Relatórios"
          icon={BarChart3}
          action={
            <Button variant="primary" size="sm" iconLeft={<Download className="w-4 h-4" />} onClick={exportCsv}>
              Exportar CSV
            </Button>
          }
        />

        {/* Period filters */}
        <ContentCard padding="md">
          <FilterLine>
            <FilterLineSection>
              <FilterLineItem>
                <Select
                  label="Mês"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  options={monthOptions}
                />
              </FilterLineItem>
              <FilterLineItem>
                <Select
                  label="Ano"
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  options={yearOptions}
                />
              </FilterLineItem>
              <FilterLineItem>
                <Select
                  label="Equipe"
                  value={selectedTeamId}
                  onChange={e => setSelectedTeamId(e.target.value)}
                  options={teamSelectOptions}
                />
              </FilterLineItem>
              <FilterLineItem>
                <Select
                  label="Status"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  options={statusOptions}
                />
              </FilterLineItem>
            </FilterLineSection>
            <FilterLineSection>
              <FilterLineSearch
                value={searchTeam}
                onChange={setSearchTeam}
                placeholder="Buscar equipe..."
              />
            </FilterLineSection>
          </FilterLine>

          <div className="mt-4 space-y-1">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Meta mínima: {minimumGoal}%
            </p>
            <input
              type="range"
              min={0}
              max={100}
              value={minimumGoal}
              onChange={e => setMinimumGoal(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
        </ContentCard>

        {/* Stats */}
        <StatGrid cols={4}>
          <StatCard
            title="Membros ativos"
            value={summary?.stats?.activeMembers || 0}
            icon={Users}
            color="info"
            delay={0}
          />
          <StatCard
            title="Equipes analisadas"
            value={teamPerformanceData.length}
            icon={Layers}
            color="success"
            delay={0.05}
          />
          <StatCard
            title="Performance média"
            value={`${performanceAvg}%`}
            icon={Wallet}
            color="purple"
            delay={0.1}
          />
          <StatCard
            title="Acima da meta (70%)"
            value={teamPerformanceData.filter((t: any) => (t.value || 0) >= 70).length}
            icon={TrendingUp}
            color="default"
            delay={0.15}
          />
        </StatGrid>

        {/* Charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Main chart */}
          <ContentCard padding="lg" className="xl:col-span-2">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
              <div>
                <h3 className="text-sm font-black text-zinc-800 uppercase tracking-widest">Performance financeira</h3>
                <p className="text-xs text-zinc-400 font-semibold mt-0.5">Visão comparativa e tendência</p>
              </div>
              <FilterLineSegmented
                value={viewType}
                onChange={v => setViewType(v as 'bar' | 'trend')}
                options={[
                  { value: 'bar', label: <BarChart3 className="w-4 h-4" /> },
                  { value: 'trend', label: <AreaIcon className="w-4 h-4" /> },
                ]}
              />
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {viewType === 'bar' ? (
                  <BarChart data={teamPerformanceData} margin={{ top: 8, left: -10, right: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Arrecadação']} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {teamPerformanceData.map((item: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={(item.value || 0) >= 70 ? '#16a34a' : '#f59e0b'} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="reportTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={3} fill="url(#reportTrend)" />
                    <Area type="monotone" dataKey="meta" stroke="#22c55e" strokeWidth={2} fillOpacity={0} strokeDasharray="6 4" />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </ContentCard>

          {/* Pie chart */}
          <ContentCard padding="lg">
            <h3 className="text-sm font-black text-zinc-800 uppercase tracking-widest">Distribuição geral</h3>
            <p className="text-xs text-zinc-400 font-semibold mt-0.5">Status por equipe</p>
            <div className="h-52 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary.pieData || []} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={5}>
                    {(summary.pieData || []).map((slice: any, index: number) => (
                      <Cell key={`slice-${index}`} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <Divider />
            <div className="space-y-2">
              {(summary.pieData || []).map((item: any) => (
                <div key={item.name} className="flex items-center justify-between text-xs bg-zinc-50 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-bold text-zinc-600 uppercase tracking-wider">{item.name}</span>
                  </div>
                  <span className="font-black text-zinc-900">{item.value}</span>
                </div>
              ))}
            </div>
          </ContentCard>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Top teams bar chart */}
          <ContentCard padding="lg">
            <h3 className="text-sm font-black text-zinc-800 uppercase tracking-widest">Top equipes por resultado</h3>
            <p className="text-xs text-zinc-400 font-semibold mt-0.5">Ranking de arrecadação</p>
            <div className="h-64 mt-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTeams} margin={{ top: 8, left: -10, right: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Arrecadação']} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ContentCard>

          {/* Operational list */}
          <ContentCard padding="lg">
            <h3 className="text-sm font-black text-zinc-800 uppercase tracking-widest">Lista operacional</h3>
            <p className="text-xs text-zinc-400 font-semibold mt-0.5">Para ação rápida da coordenação</p>
            <div className="mt-4 max-h-64 overflow-y-auto space-y-0 divide-y divide-zinc-100">
              {teamPerformanceData.map((team: any, index: number) => (
                <div key={team.id || `${team.name}-${index}`} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-zinc-900">{team.name}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${(team.value || 0) >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {(team.value || 0) >= 70 ? 'Meta atingida' : 'Precisa de apoio'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-zinc-900">{team.value || 0}%</p>
                    <p className="text-[10px] text-zinc-400 font-bold">arrecadação</p>
                  </div>
                </div>
              ))}
              {teamPerformanceData.length === 0 && (
                <div className="py-10 text-center text-zinc-400 text-sm font-semibold">
                  Nenhuma equipe encontrada com os filtros selecionados.
                </div>
              )}
            </div>
          </ContentCard>
        </div>

      </div>
    </PageWrapper>
  );
};

export default Reports;
