import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Layers,
  Baby,
  PersonStanding,
  BarChart3,
  TrendingUp,
  Check,
  X,
  Sparkles,
  SlidersHorizontal,
  CircleDollarSign,
  ChevronDown,
  Search,
  Cake,
  TrendingDown,
  Activity,
  Heart,
  Baby as BabyIcon,
  Crown,
  History,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Calendar as CalendarIcon,
  ChevronRight
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from 'recharts';
import { api } from '../api';
import { BaseTeam } from '../types';
import {
  PageWrapper,
  SectionTitle,
  StatCard,
  ContentCard,
  Button,
  FilterLineSegmented,
  Select,
  Badge,
  FilterLine,
  FilterLineSection,
  Combobox,
} from '../components/ui';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [chartType, setChartType] = useState<'bar' | 'trend'>('bar');
  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    stats: { totalMembers: 0, teamsCount: 0, male: 0, female: 0, activeMembers: 0, children: 0, youth: 0, adult: 0, elderly: 0 },
    barData: [],
    trendData: [],
    pieData: []
  });

  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [isTeamFilterOpen, setIsTeamFilterOpen] = useState(false);
  const [minimumPerformance, setMinimumPerformance] = useState(0);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const teamFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (teamFilterRef.current && !teamFilterRef.current.contains(event.target as Node)) {
        setIsTeamFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const loadData = () => {
      api.getTeams().then(setTeams).catch(() => setTeams([]));
      api.getMembers().then(setMembers).catch(() => setMembers([]));
      api.getLedger().then(setLedger).catch(() => setLedger([]));
      api.getDashboardSummary(selectedMonth, selectedYear).then(setSummary).catch(() =>
        setSummary({
          stats: { totalMembers: 0, teamsCount: 0, male: 0, female: 0, activeMembers: 0, children: 0, youth: 0, adult: 0, elderly: 0 },
          barData: [],
          trendData: [],
          pieData: []
        })
      );
    };
    loadData();
    window.addEventListener('focus', loadData);
    const interval = setInterval(loadData, 30000);
    return () => {
      window.removeEventListener('focus', loadData);
      clearInterval(interval);
    };
  }, [selectedMonth, selectedYear]);

  const filteredTeamsForSelect = useMemo(
    () => teams.filter((team) => team.name.toLowerCase().includes(teamSearch.toLowerCase())),
    [teamSearch, teams]
  );

  const barData = useMemo(() => {
    const allData = summary.barData || [];
    const byTeam = selectedTeamIds.length === 0 ? allData : allData.filter((d: any) => selectedTeamIds.includes(d.id));
    return byTeam.filter((d: any) => (d.value || 0) >= minimumPerformance);
  }, [selectedTeamIds, summary, minimumPerformance]);

  const trendData = useMemo(() => {
    const raw = summary.trendData || [];
    return raw.map((item: any, index: number) => ({ ...item, projecao: Math.min(100, (item.value || 0) + (index % 2 === 0 ? 5 : 2)) }));
  }, [summary]);

  const pieData = summary.pieData || [];

  // Cálculos Financeiros
  const financialStats = useMemo(() => {
    const balance = ledger.reduce((acc, curr) => acc + (curr.type === 'IN' ? curr.amount : -curr.amount), 0);
    const monthRevenue = ledger
      .filter(l => l.type === 'IN' && l.date.includes(`${selectedYear}-${selectedMonth}`))
      .reduce((acc, curr) => acc + curr.amount, 0);
    const monthExpenses = ledger
      .filter(l => l.type === 'OUT' && l.date.includes(`${selectedYear}-${selectedMonth}`))
      .reduce((acc, curr) => acc + curr.amount, 0);
    return { balance, monthRevenue, monthExpenses };
  }, [ledger, selectedMonth, selectedYear]);

  // Aniversariantes do mês selecionado
  const anniversaries = useMemo(() => {
    const targetMonth = parseInt(selectedMonth) - 1; // 0-indexed
    const targetYear = parseInt(selectedYear);
    const list: any[] = [];

    members.forEach(m => {
      if (!m.dob) return;
      // Usando split para evitar problemas de timezone com ISO strings
      const dobParts = m.dob.split('T')[0].split('-');
      const mBirth = parseInt(dobParts[1]) - 1;
      const dBirth = parseInt(dobParts[2]);
      
      if (mBirth === targetMonth) {
        list.push({ 
          name: m.name, 
          day: dBirth, 
          type: 'MFCista', 
          team: teams.find(t => t.id === m.teamId)?.name || 'Sem Equipe',
          age: targetYear - parseInt(dobParts[0])
        });
      }
      
      if (m.marriageDate) {
        const marParts = m.marriageDate.split('T')[0].split('-');
        const mMar = parseInt(marParts[1]) - 1;
        const dMar = parseInt(marParts[2]);
        if (mMar === targetMonth) {
          list.push({ 
            name: `${m.name} & ${m.spouseName}`, 
            day: dMar, 
            type: 'Casamento', 
            team: teams.find(t => t.id === m.teamId)?.name || 'Sem Equipe',
            years: targetYear - parseInt(marParts[0])
          });
        }
      }
    });
    return list.sort((a, b) => a.day - b.day);
  }, [members, teams, selectedMonth, selectedYear]);

  const months = [
    { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' }, { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' }, { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
  ];

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear + 1; y >= currentYear - 4; y--) {
      years.push({ value: y.toString(), label: y.toString() });
    }
    return years;
  }, []);

  const toggleTeamSelection = (id: string) => {
    setSelectedTeamIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const removeTeamTag = (id: string) => {
    setSelectedTeamIds((prev) => prev.filter((item) => item !== id));
  };

  return (
    <PageWrapper>
      <div className="space-y-3 sm:space-y-4">
        {/* Header */}
        <SectionTitle
          title="Dashboard Inteligente da Unidade"
          description="Visão executiva com filtros avançados, tendências e alertas de performance."
          icon={BarChart3}
          action={
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Sparkles className="w-3.5 h-3.5" />}
              onClick={() => navigate('/relatorios')}
            >
              Abrir relatórios
            </Button>
          }
        />
        {/* Filtros Analíticos Globais */}
        <FilterLine>
          <FilterLineSection grow>
            <div className="flex flex-col xl:flex-row xl:items-center gap-4 w-full">
              {/* Team filter dropdown */}
              <div className="flex-1 relative" ref={teamFilterRef}>
                <div
                  className="flex flex-wrap items-center gap-2 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl min-h-[44px] cursor-text focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all"
                  onClick={() => setIsTeamFilterOpen(true)}
                >
                  <Search className="w-4 h-4 text-zinc-400 ml-1 shrink-0" />
                  {selectedTeamIds.length === 0 ? (
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Filtrar por equipes específicas...</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTeamIds.map((id) => {
                        const team = teams.find((t) => t.id === id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1 bg-blue-600 text-white px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest">
                            {team?.name}
                            <button onClick={(e) => { e.stopPropagation(); removeTeamTag(id); }} className="hover:bg-white/20 rounded-full p-0.5 transition-colors">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="ml-auto pr-1">
                    <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ${isTeamFilterOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {isTeamFilterOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 p-3 animate-in fade-in duration-200">
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Pesquisar equipe..."
                        className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 focus:bg-white transition-all"
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-0.5 no-scrollbar">
                      <button
                        onClick={() => setSelectedTeamIds([])}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-between"
                      >
                        Mostrar todas as equipes
                        {selectedTeamIds.length === 0 && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <div className="h-px bg-zinc-100 my-1.5" />
                      {filteredTeamsForSelect.map((team) => (
                        <button
                          key={team.id}
                          onClick={() => toggleTeamSelection(team.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${selectedTeamIds.includes(team.id) ? 'bg-blue-50 text-blue-700' : 'text-zinc-600 hover:bg-zinc-50'}`}
                        >
                          {team.name}
                          {selectedTeamIds.includes(team.id) && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Performance Slider */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-2.5 flex items-center gap-4 min-w-[280px]">
                <div className="p-2 bg-slate-50 rounded-xl">
                  <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Meta Mínima</span>
                    <span className="text-[10px] font-black text-blue-600">{minimumPerformance}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={minimumPerformance}
                    onChange={(e) => setMinimumPerformance(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            </div>
          </FilterLineSection>

          <FilterLineSection align="right">
            <div className="flex items-center gap-2">
              <Combobox
                value={selectedMonth}
                onChange={(val) => { if (val) setSelectedMonth(val as string); }}
                options={months}
                size="sm"
                className="w-36"
                placeholder="Mês"
                allowDeselect={false}
              />

              <Combobox
                value={selectedYear}
                onChange={(val) => { if (val) setSelectedYear(val as string); }}
                options={yearOptions}
                size="sm"
                className="w-28"
                placeholder="Ano"
                allowDeselect={false}
              />
            </div>
          </FilterLineSection>
        </FilterLine>
        {/* Stat Cards - Executive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-3">
          <StatCard
            title="Saldo em Caixa"
            value={financialStats.balance}
            icon={Wallet}
            color="success"
            description="Saldo total consolidado"
            isCurrency
            delay={0}
          />
          <StatCard
            title="Receita do Mês"
            value={financialStats.monthRevenue}
            icon={ArrowUpRight}
            color="info"
            description={`Total em ${months.find(m => m.value === selectedMonth)?.label}`}
            isCurrency
            delay={0.03}
          />
          <StatCard
            title="Despesas do Mês"
            value={financialStats.monthExpenses}
            icon={ArrowDownRight}
            color="danger"
            description="Saídas registradas"
            isCurrency
            delay={0.06}
          />
          <StatCard
            title="Equipes Base"
            value={summary.stats.teamsCount || 0}
            icon={Layers}
            color="warning"
            description="Equipes ativas"
            delay={0.09}
          />
          <StatCard
            title="Total MFCistas"
            value={summary.stats.totalMembers || 0}
            icon={Users}
            color="info"
            variant="flat"
            description="Membros totais"
            delay={0.12}
          />
          <StatCard
            title="Jovens e Crianças"
            value={(summary.stats.children || 0) + (summary.stats.youth || 0)}
            icon={BabyIcon}
            color="purple"
            variant="flat"
            description="Base do Movimento"
            delay={0.15}
          />
          <StatCard
            title="3ª Idade"
            value={summary.stats.elderly || 0}
            icon={PersonStanding}
            color="danger"
            variant="flat"
            description="Nossa Fortaleza"
            delay={0.18}
          />
          <StatCard
            title="Famílias"
            value={new Set(members.map(m => m.familyName)).size}
            icon={Heart}
            color="success"
            variant="flat"
            description="Núcleos familiares"
            delay={0.21}
          />
        </div>

        {/* Main Sections Grid */}
        <div className="grid grid-cols-1 2xl:grid-cols-4 gap-3 sm:gap-4">

          {/* Financial Health & Trends */}
          <div className="2xl:col-span-3 space-y-3 sm:space-y-4">
            <ContentCard padding="md" className="min-h-[340px] border-none shadow-xl shadow-slate-200/50 sm:rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                 <div>
                   <h3 className="text-base font-black text-zinc-800 tracking-tight">Fluxo de Caixa e Tendências</h3>
                   <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Análise comparativa de entradas e saídas</p>
                 </div>
                 <div className="flex gap-2">
                    <Button variant="ghost" size="xs" onClick={() => setChartType('bar')} className={chartType === 'bar' ? 'bg-blue-50 text-blue-600' : ''}>Barras</Button>
                    <Button variant="ghost" size="xs" onClick={() => setChartType('trend')} className={chartType === 'trend' ? 'bg-blue-50 text-blue-600' : ''}>Tendência</Button>
                 </div>
              </div>
              
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                    <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 700 }} dy={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 700 }} domain={[0, 100]} />
                      <Tooltip
                        cursor={{ fill: '#fafafa' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontWeight: 'bold', fontSize: '12px' }}
                        formatter={(value: number) => [`${value}%`, 'Arrecadação']}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={22}>
                        {barData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.value >= 100 ? '#10b981' : entry.value >= 70 ? '#2563eb' : '#f87171'} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 700 }} dy={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 700 }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontWeight: 'bold', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" name="Atual" />
                      <Area type="monotone" dataKey="projecao" stroke="#10b981" strokeWidth={2} strokeDasharray="6 4" fillOpacity={1} fill="url(#colorProj)" name="Projeção" />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </ContentCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
               <ContentCard padding="md" className="border-none shadow-xl shadow-slate-200/50 sm:rounded-2xl">
                  <div className="flex items-center gap-2 mb-3">
                     <History className="w-5 h-5 text-blue-500" />
                     <h3 className="text-base font-black text-zinc-800 tracking-tight">Atividades Recentes</h3>
                  </div>
                  <div className="space-y-3">
                     {ledger.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                           <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl ${item.type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                 {item.type === 'IN' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                              </div>
                              <div>
                                 <p className="text-xs font-black text-zinc-800">{item.description}</p>
                                 <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{new Date(item.date).toLocaleDateString()}</p>
                              </div>
                           </div>
                           <span className={`text-sm font-black ${item.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {item.type === 'IN' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}
                           </span>
                        </div>
                     ))}
                  </div>
               </ContentCard>

               <ContentCard padding="md" className="border-none shadow-xl shadow-slate-200/50 sm:rounded-2xl">
                  <div className="flex items-center gap-2 mb-3">
                     <Activity className="w-5 h-5 text-blue-500" />
                     <h3 className="text-base font-black text-zinc-800 tracking-tight">Ações do Movimento</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="p-4 rounded-[2rem] bg-blue-50 border border-blue-100 flex flex-col items-center text-center">
                        <Users className="w-6 h-6 text-blue-600 mb-2" />
                        <span className="text-lg font-black text-blue-900">{summary.stats.activeMembers}</span>
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Membros Ativos</span>
                     </div>
                     <div className="p-4 rounded-[2rem] bg-blue-50 border border-blue-100 flex flex-col items-center text-center">
                        <Layers className="w-6 h-6 text-blue-600 mb-2" />
                        <span className="text-lg font-black text-blue-900">{summary.stats.teamsCount}</span>
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Equipes Base</span>
                     </div>
                     <div className="p-4 rounded-[2rem] bg-emerald-50 border border-emerald-100 flex flex-col items-center text-center">
                        <TrendingUp className="w-6 h-6 text-emerald-600 mb-2" />
                        <span className="text-lg font-black text-emerald-900">{Math.round(barData.reduce((acc: number, curr: any) => acc + curr.value, 0) / (barData.length || 1))}%</span>
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Arrecadação Média</span>
                     </div>
                     <div className="p-4 rounded-[2rem] bg-rose-50 border border-rose-100 flex flex-col items-center text-center">
                        <ArrowDownRight className="w-6 h-6 text-rose-600 mb-2" />
                        <span className="text-lg font-black text-rose-900">{financialStats.monthExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Gasto Mensal</span>
                     </div>
                  </div>
               </ContentCard>
            </div>
          </div>

          {/* Side Panels - Anniversaries & Insights */}
          <div className="space-y-3 sm:space-y-4">
            <ContentCard padding="md" className="border-none shadow-xl shadow-slate-200/50 sm:rounded-2xl bg-white">
               <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                     <Crown className="w-5 h-5 text-blue-500" />
                     <h3 className="text-base font-black text-zinc-800 tracking-tight">Aniversariantes</h3>
                  </div>
                  <Badge color="warning" size="sm">{months.find(m => m.value === selectedMonth)?.label}</Badge>
               </div>
               
               <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                  {anniversaries.length > 0 ? anniversaries.map((ann, idx) => (
                     <div key={idx} className="group p-3 rounded-2xl bg-zinc-50 border border-zinc-100 hover:border-blue-300 hover:bg-blue-50 transition-all">
                        <div className="flex items-center justify-between mb-1">
                           <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                              {ann.type === 'MFCista' ? <Cake className="w-3 h-3" /> : <Heart className="w-3 h-3" />}
                              Dia {ann.day}
                           </span>
                           <span className="text-[10px] font-bold text-zinc-400">{ann.type}</span>
                        </div>
                        <p className="text-sm font-black text-zinc-900 group-hover:text-blue-900">{ann.name}</p>
                        <p className="text-[10px] font-bold text-zinc-500 mt-0.5">{ann.team}</p>
                        {ann.age && <p className="text-[9px] font-black text-blue-500 mt-1 uppercase tracking-widest">{ann.age} anos</p>}
                        {ann.years && <p className="text-[9px] font-black text-rose-500 mt-1 uppercase tracking-widest">{ann.years} anos de união</p>}
                     </div>
                  )) : (
                     <div className="text-center py-10">
                        <CalendarIcon className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                        <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Nenhum evento este mês</p>
                     </div>
                  )}
               </div>
            </ContentCard>

            <ContentCard padding="md" className="bg-slate-900 border-none shadow-2xl shadow-slate-900/40 sm:rounded-2xl overflow-hidden relative group">
               <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/30 transition-all duration-700" />
               <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl group-hover:bg-blue-400/20 transition-all duration-700" />
               
               <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                        <TrendingUp className="w-5 h-5 text-blue-400" />
                     </div>
                     <div>
                        <h3 className="text-[10px] font-black text-white tracking-widest uppercase">Conselho Estratégico</h3>
                        <div className="h-1 w-8 bg-blue-500 rounded-full mt-1" />
                     </div>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed font-medium italic">
                    {barData.length > 0
                      ? (
                        <>
                          Atualmente, <span className="text-blue-400 font-bold">{Math.round((barData.filter((item: any) => item.value >= 70).length / barData.length) * 100)}%</span> das suas equipes estão com saúde financeira saudável.
                          Focar esforços nas equipes com arrecadação abaixo de 50% pode aumentar o caixa em aproximadamente <span className="text-emerald-400 font-bold">15%</span>.
                        </>
                      )
                      : 'O desempenho das equipes é a base para o crescimento do movimento. Use os filtros acima para detalhar por região.'}
                  </p>
                  
                  <Button variant="ghost" size="xs" className="mt-6 text-blue-400 hover:text-blue-300 hover:bg-white/5 font-black uppercase tracking-widest p-0">
                     Ver Detalhes do Plano <ChevronRight size={14} className="ml-1" />
                  </Button>
               </div>
            </ContentCard>


            <ContentCard padding="md" className="border-none shadow-xl shadow-slate-200/50 sm:rounded-2xl">
               <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Distribuição de Recursos</h3>
               <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} innerRadius={35} outerRadius={55} paddingAngle={8} dataKey="value" stroke="none">
                        {pieData.map((entry: any, index: number) => (
                          <Cell key={`slice-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                    </PieChart>
                  </ResponsiveContainer>
               </div>
               <div className="space-y-2 mt-4">
                  {pieData.map((item: any) => (
                    <div key={item.name} className="flex items-center justify-between group">
                       <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{item.name}</span>
                       </div>
                       <span className="text-xs font-black text-zinc-800">{item.value}%</span>
                    </div>
                  ))}
               </div>
            </ContentCard>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default Dashboard;
