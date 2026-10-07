
import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Trash2, 
  Calendar,
  Layers,
  Search,
  AlertCircle,
  CalendarDays,
  Plus
} from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';
import { PageWrapper, SectionTitle, StatGrid, ContentCard, PanelCard, Button, GridTable, usePagination, EmptyState, FilterLine, FilterLineSection, FilterLineSearch, ConfirmModal, Tabs, Badge } from '../components/ui';
import { StatCard } from '../components/ui/StatCard';
import { formatPaymentDate } from '../utils/paymentAccounting';
import { normalizeDirectoryText } from '../utils/memberDirectory';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

interface DailyEntry {
  id: string;
  date: string;
  cost_center: string;
  synthetic: string;
  analytic: string;
  amount: number;
  account: string;
  observation: string;
}

interface Stats {
  summary: {
    total_income: number;
    total_expenses: number;
    balance: number;
  };
  byCostCenter: { cost_center: string; total: number }[];
  byMonth: { month: string; total: number }[];
}

const DailyEntries: React.FC = () => {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'entries' | 'summary'>('entries');
  const [showClear, setShowClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [entriesData, statsData] = await Promise.all([
        api.getDailyEntries(),
        api.getDailyStats()
      ]);
      setEntries(entriesData);
      setStats(statsData);
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || importing) return;

    setImporting(true);
    try {
      await api.importDailyEntries(file);
      toast.success('Planilha importada com sucesso!');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao importar: ' + error.message);
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const handleClear = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      await api.clearDailyEntries();
      toast.success('Lançamentos removidos.');
      setShowClear(false);
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao limpar dados: ' + error.message);
    } finally { setClearing(false); }
  };

  const filteredEntries = entries.filter(entry => normalizeDirectoryText([entry.cost_center, entry.synthetic, entry.observation, entry.account, entry.analytic].filter(Boolean).join(' ')).includes(normalizeDirectoryText(searchTerm)));
  const { page, pageSize, paginatedData, setPage, setPageSize } = usePagination(filteredEntries, 15);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle title="Lançamentos" description="Importação e consulta dos lançamentos financeiros." icon={FileSpreadsheet}
          action={<div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={loading || importing || !entries.length} iconLeft={<Trash2 size={14} />} onClick={() => setShowClear(true)}>Limpar dados</Button>
            <Button size="sm" loading={importing} disabled={clearing} iconLeft={<Upload size={14} />} onClick={() => document.getElementById('import-file')?.click()}>Importar planilha</Button>
          </div>} />
        <input id="import-file" type="file" aria-label="Selecionar planilha" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={importing || clearing} />
        <StatGrid cols={3}>
          <StatCard title="Total de entradas" value={formatCurrency(stats?.summary.total_income || 0)} icon={TrendingUp} color="success" />
          <StatCard title="Total de saídas" value={formatCurrency(Math.abs(stats?.summary.total_expenses || 0))} icon={TrendingDown} color="danger" />
          <StatCard title="Saldo" value={formatCurrency(stats?.summary.balance || 0)} icon={DollarSign} color={(stats?.summary.balance || 0) >= 0 ? 'info' : 'danger'} />
        </StatGrid>
        <Tabs<'entries' | 'summary'> items={[{ id: 'entries', label: 'Lançamentos', icon: FileSpreadsheet }, { id: 'summary', label: 'Resumo', icon: TrendingUp }]} value={activeTab} onChange={setActiveTab} label="Visualização dos lançamentos">
          {activeTab === 'entries' ? <div className="space-y-3">
            <FilterLine>
              <FilterLineSection grow><FilterLineSearch aria-label="Buscar lançamentos" value={searchTerm} onChange={setSearchTerm} placeholder="Descrição, conta ou centro de custo…" /></FilterLineSection>
              <FilterLineSection><span className="text-xs text-slate-500">{filteredEntries.length} registros</span>{searchTerm && <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')}>Limpar busca</Button>}</FilterLineSection>
            </FilterLine>
            <ContentCard padding="none">
              <GridTable<DailyEntry> data={paginatedData} keyExtractor={entry => entry.id} isLoading={loading} noDesktopCard
                columns={[
                  { header: 'Data', render: entry => <span className="text-xs whitespace-nowrap">{formatPaymentDate(entry.date)}</span> },
                  { header: 'Centro de custo', render: entry => <div><p className="text-xs font-medium text-slate-800">{entry.cost_center || 'Não informado'}</p><p className="text-[11px] text-slate-500 mt-0.5">{entry.synthetic}</p></div> },
                  { header: 'Descrição', render: entry => <div className="max-w-sm break-words"><p className="text-xs text-slate-800">{entry.analytic || '—'}</p><p className="text-[11px] text-slate-500 mt-0.5">{entry.observation}</p></div> },
                  { header: 'Conta', render: entry => <Badge>{entry.account || 'Não informada'}</Badge> },
                  { header: 'Valor', render: entry => <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${entry.amount >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(entry.amount)}</span> },
                ]}
                emptyMessage={<EmptyState icon={FileSpreadsheet} title="Nenhum lançamento encontrado" description={searchTerm ? 'Ajuste a busca para encontrar os lançamentos.' : 'Importe uma planilha para começar.'} />}
                pagination={{ total: filteredEntries.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }} />
            </ContentCard>
          </div> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PanelCard title="Por centro de custo" description="Resumo de todos os lançamentos importados.">
              <div className="h-64 min-w-0">
                <ResponsiveContainer width="100%" height="100%"><PieChart>
                  <Pie data={stats?.byCostCenter || []} innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="total" nameKey="cost_center">
                    {(stats?.byCostCenter || []).map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart></ResponsiveContainer>
              </div>
            </PanelCard>
            <PanelCard title="Evolução mensal" description="Valores consolidados por mês.">
              <div className="h-64 min-w-0">
                <ResponsiveContainer width="100%" height="100%"><BarChart data={stats?.byMonth || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="total" radius={[3, 3, 0, 0]} barSize={26}>
                    {(stats?.byMonth || []).map((entry, index) => <Cell key={index} fill={entry.total >= 0 ? '#2563eb' : '#ef4444'} />)}
                  </Bar>
                </BarChart></ResponsiveContainer>
              </div>
            </PanelCard>
          </div>}
        </Tabs>
      </div>
      <ConfirmModal isOpen={showClear} onClose={() => setShowClear(false)} onConfirm={handleClear} loading={clearing} title="Limpar lançamentos?"
        message="Todos os lançamentos importados serão apagados. Esta ação não pode ser desfeita." confirmLabel="Apagar lançamentos" variant="danger" />
    </PageWrapper>
  );
};

export default DailyEntries;
