
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  ArrowLeft, 
  Download, 
  Printer, 
  Calendar, 
  User, 
  FileText, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Save,
  X,
  Check,
  ChevronDown,
  Info,
  Layers,
  MoreVertical,
  Briefcase,
  ArrowRightLeft
} from 'lucide-react';
import { api } from '../api';
import { FinancialEntity } from '../types';
import { 
  PageWrapper, 
  SectionTitle, 
  StatGrid, 
  ContentCard, 
  Button, 
  IconButton, 
  Input, 
  Select, 
  Modal, 
  ModalFooter 
} from '../components/ui';
import { StatCard } from '../components/ui/StatCard';
import { cn } from '../src/lib/utils';

const GeneralLedger: React.FC = () => {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [entitySearch, setEntitySearch] = useState('');
  const [entityYearFilter, setEntityYearFilter] = useState<'all' | number>('all');

  const [entities, setEntities] = useState<FinancialEntity[]>([]);

  useEffect(() => {
    api.getLedgerEntities()
      .then(setEntities)
      .catch(() => setEntities([]));
  }, []);

  const [newEntity, setNewEntity] = useState({
    name: '',
    year: new Date().getFullYear(),
    observations: '',
    initialBalance: ''
  });

  const [launchForm, setLaunchForm] = useState({
    type: 'Receita' as 'Receita' | 'Despesa',
    category: '',
    amount: '',
    description: '',
    months: [] as number[]
  });

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const categories = {
    Receita: [
      { id: '1.1.1', label: 'Receitas de Vendas - Dinheiro' },
      { id: '1.1.2', label: 'Receitas de Vendas - PIX' },
      { id: '1.1.3', label: 'Receitas de Vendas - Cartão' },
      { id: '1.1.4', label: 'Outros' },
    ],
    Despesa: [
      { id: '2.1.1', label: 'Ajuda de Custos a Colaboradores' },
      { id: '2.1.2', label: 'Material Acervo Literário' },
      { id: '2.1.3', label: 'Telefone / Internet' },
      { id: '2.1.7', label: 'INSS / DARF' },
      { id: '2.1.11', label: 'Salário / M.O' },
      { id: '2.1.15', label: 'Tarifa Maquininha' },
    ]
  };

  const filteredEntities = useMemo(() => {
    return entities
      .filter((entity) =>
        entity.name.toLowerCase().includes(entitySearch.toLowerCase()) ||
        String(entity.year).includes(entitySearch)
      )
      .filter((entity) => (entityYearFilter === 'all' ? true : entity.year === entityYearFilter))
      .sort((a, b) => b.year - a.year);
  }, [entities, entitySearch, entityYearFilter]);

  const listStats = useMemo(() => {
    return filteredEntities.reduce((acc, entity) => {
      acc.total += 1;
      acc.balance += Number(entity.initialBalance) || 0;
      return acc;
    }, { total: 0, balance: 0 });
  }, [filteredEntities]);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCreateEntity = () => {
    if (!newEntity.name || !newEntity.initialBalance) {
      alert("Por favor, preencha o nome e o saldo inicial.");
      return;
    }

    api.createLedgerEntity({
      name: newEntity.name,
      year: newEntity.year,
      createdBy: 'Admin',
      observations: newEntity.observations,
      initialBalance: parseFloat(newEntity.initialBalance)
    })
      .then((entity: FinancialEntity) => {
        setEntities([entity, ...entities]);
        setShowEntityModal(false);
        setNewEntity({ name: '', year: new Date().getFullYear(), observations: '', initialBalance: '' });
        notify("Novo Livro Caixa criado com sucesso!");
      })
      .catch(() => {
        setShowEntityModal(false);
      });
  };

  const toggleMonthSelection = (idx: number) => {
    setLaunchForm(prev => ({
      ...prev,
      months: prev.months.includes(idx) 
        ? prev.months.filter(m => m !== idx) 
        : [...prev.months, idx]
    }));
  };

  const handleLaunchSubmit = () => {
    if (launchForm.months.length === 0 || !launchForm.amount || !launchForm.category) {
      alert("Por favor, preencha o valor, categoria e selecione ao menos um mês.");
      return;
    }
    notify(`Lançamentos de ${launchForm.type} realizados com sucesso!`);
    setShowLaunchModal(false);
    setLaunchForm({ type: 'Receita', category: '', amount: '', description: '', months: [] });
  };

  const selectedEntity = entities.find(e => e.id === selectedEntityId);
  const monthlyRevenueValue = 7100;
  const monthlyExpenseValue = 850;
  const annualRevenueTotal = categories.Receita.length * monthlyRevenueValue * 12;
  const annualExpenseTotal = categories.Despesa.length * monthlyExpenseValue * 12;
  const estimatedResult = annualRevenueTotal - annualExpenseTotal + Number(selectedEntity?.initialBalance || 0);

  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const spreadsheetScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [focusedMonthIndex, setFocusedMonthIndex] = useState<number | null>(null);

  const updateScrollHints = () => {
    const el = spreadsheetScrollRef.current;
    if (!el) return;
    const maxScrollLeft = Math.max(el.scrollWidth - el.clientWidth, 1);
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    setScrollProgress(Math.min(100, Math.max(0, (el.scrollLeft / maxScrollLeft) * 100)));
  };

  const handleLedgerHorizontalScroll = (direction: 'left' | 'right') => {
    const el = spreadsheetScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'right' ? 380 : -380, behavior: 'smooth' });
  };

  const handleLedgerScrollToEdge = (direction: 'start' | 'end') => {
    const el = spreadsheetScrollRef.current;
    if (!el) return;
    el.scrollTo({ left: direction === 'end' ? el.scrollWidth : 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (view !== 'detail') return;
    const el = spreadsheetScrollRef.current;
    if (!el) return;
    updateScrollHints();
    el.addEventListener('scroll', updateScrollHints);
    window.addEventListener('resize', updateScrollHints);
    return () => {
      el.removeEventListener('scroll', updateScrollHints);
      window.removeEventListener('resize', updateScrollHints);
    };
  }, [view, selectedEntityId]);

  const handleExportSpreadsheetCsv = () => {
    if (!selectedEntity) return;

    const headers = ['Item de Controle', ...monthNames, 'Total Anual'];
    const rows: string[][] = [];

    rows.push(['1. RECEITAS', ...Array(12).fill(''), '']);
    categories.Receita.forEach((acc) => {
      const monthlyValues = Array(12).fill(monthlyRevenueValue);
      rows.push([`${acc.id} ${acc.label}`, ...monthlyValues.map((value) => formatCurrency(value)), formatCurrency(monthlyValues.reduce((a, b) => a + b, 0))]);
    });

    rows.push(['2. DESPESAS', ...Array(12).fill(''), '']);
    categories.Despesa.forEach((acc) => {
      const monthlyValues = Array(12).fill(monthlyExpenseValue);
      rows.push([`${acc.id} ${acc.label}`, ...monthlyValues.map((value) => formatCurrency(value)), formatCurrency(monthlyValues.reduce((a, b) => a + b, 0))]);
    });

    rows.push(['Saldo Final', ...Array(12).fill(''), formatCurrency(estimatedResult)]);

    const csv = [headers, ...rows]
      .map((cols) => cols.map((col) => `"${String(col).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `livro-caixa-${selectedEntity.name.toLowerCase().replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    notify('CSV do Livro Caixa exportado com sucesso!');
  };

  const renderList = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <SectionTitle 
        title="Gestão de Livro Caixa"
        description="Controle financeiro detalhado de entradas e saídas da unidade."
        icon={Layers}
        action={
          <Button 
            onClick={() => setShowEntityModal(true)}
            iconLeft={<Plus className="w-5 h-5" />}
          >
            Novo Livro Caixa
          </Button>
        }
      />

      <StatGrid cols={3}>
        <StatCard 
          title="Livros filtrados"
          value={listStats.total}
          icon={Layers}
          color="info"
        />
        <StatCard 
          title="Saldo inicial consolidado"
          value={`R$ ${listStats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          color="info"
        />
        <StatCard 
          title="Média por livro"
          value={`R$ ${(listStats.balance / Math.max(listStats.total, 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          color="success"
        />
      </StatGrid>

      <ContentCard padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input 
            value={entitySearch}
            onChange={(e) => setEntitySearch(e.target.value)}
            placeholder="Buscar por nome ou exercício..."
            iconLeft={<FileText className="w-4 h-4 text-slate-400" />}
            wrapperClassName="sm:col-span-2"
          />
          <Select
            value={entityYearFilter}
            onChange={(e) => setEntityYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            options={[
              { value: 'all', label: 'Todos os anos' },
              ...Array.from(new Set(entities.map((entity) => entity.year))).sort((a, b) => b - a).map((year) => ({ value: year, label: year.toString() }))
            ]}
          />
        </div>
      </ContentCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredEntities.map(entity => (
          <div 
            key={entity.id} 
            onClick={() => { setSelectedEntityId(entity.id); setView('detail'); }}
            className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer group flex flex-col overflow-hidden relative"
          >
            <div className="p-10 flex-1 relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                  <Briefcase className="w-7 h-7" />
                </div>
                <div className="flex flex-col items-end">
                   <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg uppercase tracking-widest border border-blue-100">{entity.year}</span>
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3 group-hover:text-blue-600 transition-colors leading-tight">{entity.name}</h3>
              <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed mb-8 font-bold italic">
                {entity.observations || 'Sem observações.'}
              </p>
              <div className="flex items-center gap-6 pt-6 border-t border-slate-50">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Saldo Inicial</p>
                  <p className="text-sm font-black text-blue-600">R$ {entity.initialBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
            <div className="px-10 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-blue-600 font-black text-[10px] uppercase tracking-widest group-hover:bg-blue-50 transition-colors">
              Explorar Balancete
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>

      {filteredEntities.length === 0 && (
        <div className="bg-white border border-slate-100 rounded-3xl p-10 text-center">
          <p className="text-sm font-black text-slate-300 uppercase tracking-widest italic">Nenhum livro encontrado com os filtros atuais.</p>
        </div>
      )}
    </div>
  );

  const renderSpreadsheet = () => (
    <div className="space-y-6 animate-in slide-in-from-right duration-500 flex flex-col h-full">
      <SectionTitle 
        title={selectedEntity?.name || ""}
        description="Unidade Tatuí/SP • Movimento Familiar Cristão"
        icon={Briefcase}
        action={
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setView('list')}
              iconLeft={<ArrowLeft className="w-4 h-4" />}
            >
              Voltar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSpreadsheetCsv}
              iconLeft={<Download className="w-4 h-4" />}
              className="hidden sm:flex"
            >
              CSV
            </Button>
            <Button 
              onClick={() => setShowLaunchModal(true)}
              iconLeft={<DollarSign className="w-4 h-4" />}
            >
              Novo Lançamento
            </Button>
          </div>
        }
      />

      <StatGrid cols={4}>
        <StatCard 
          title="Saldo inicial"
          value={`R$ ${Number(selectedEntity?.initialBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          color="info"
        />
        <StatCard 
          title="Receita projetada"
          value={`R$ ${formatCurrency(annualRevenueTotal)}`}
          icon={TrendingUp}
          color="success"
        />
        <StatCard 
          title="Despesa projetada"
          value={`R$ ${formatCurrency(annualExpenseTotal)}`}
          icon={TrendingDown}
          color="danger"
        />
        <StatCard 
          title="Resultado estimado"
          value={`R$ ${formatCurrency(estimatedResult)}`}
          icon={Layers}
          color="purple"
        />
      </StatGrid>

      <ContentCard padding="none" className="flex-1 overflow-hidden flex flex-col">

        <div className="px-6 py-5 border-b border-slate-100 bg-white">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Evolução mensal (visual rápido)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {[42, 58, 51, 64, 60, 74, 68, 80, 73, 88, 91, 95].map((value, idx) => (
              <div key={monthNames[idx]} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{monthNames[idx].slice(0, 3)}</p>
                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all duration-700" style={{ width: `${value}%` }} />
                </div>
                <p className="mt-1.5 text-[10px] font-black text-slate-600">{value}%</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/50 via-white to-blue-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
              Arraste para os lados para ver todos os meses
            </div>
            <div className="w-56 h-1.5 rounded-full bg-blue-100 overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${scrollProgress}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleLedgerScrollToEdge('start')}
            >
              Jan
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleLedgerHorizontalScroll('left')}
              disabled={!canScrollLeft}
            >
              ←
            </Button>
            <Button
              variant="primary"
              size="xs"
              onClick={() => handleLedgerHorizontalScroll('right')}
              disabled={!canScrollRight}
            >
              →
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleLedgerScrollToEdge('end')}
            >
              Dez
            </Button>
          </div>
        </div>

        <div ref={spreadsheetScrollRef} tabIndex={0} onKeyDown={(e) => { if (e.key === 'ArrowRight') handleLedgerHorizontalScroll('right'); if (e.key === 'ArrowLeft') handleLedgerHorizontalScroll('left'); }} className="overflow-x-auto overflow-y-auto relative flex-1 scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-blue-50 focus:outline-none">
          {canScrollRight && (
            <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-10 bg-gradient-to-l from-white via-white/80 to-transparent" />
          )}
          {canScrollLeft && (
            <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-10 bg-gradient-to-r from-white via-white/80 to-transparent" />
          )}
          <table className="w-full text-left border-separate border-spacing-0 min-w-[1760px]">
            <thead className="sticky top-0 z-30">
              <tr className="bg-slate-50">
                <th className="sticky left-0 top-0 z-40 bg-slate-50 px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-b border-slate-100 min-w-[320px] shadow-[2px_0_5px_rgba(0,0,0,0.01)]">
                  Item de Controle
                </th>
                {monthNames.map((m, monthIdx) => (
                  <th
                    key={m}
                    onClick={() => setFocusedMonthIndex(monthIdx)}
                    className={cn(
                      "px-4 py-5 text-[10px] font-black uppercase text-center border-r border-b border-slate-100 min-w-[120px] cursor-pointer transition-colors",
                      focusedMonthIndex === monthIdx ? "bg-blue-100 text-blue-700" : "bg-slate-50 text-slate-400 hover:bg-blue-50"
                    )}
                  >
                    {m}
                  </th>
                ))}
                <th className="px-6 py-5 text-[10px] font-black text-blue-600 uppercase text-center bg-blue-50/30 border-b border-slate-100 min-w-[140px]">Total Anual</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="bg-blue-600 text-white">
                <td colSpan={14} className="sticky left-0 z-20 bg-blue-600 px-8 py-3 font-black uppercase tracking-widest text-[9px]">1. RECEITAS</td>
              </tr>
              {categories.Receita.map((acc, idx) => (
                <tr key={acc.id} className="hover:bg-blue-50/10">
                  <td className="sticky left-0 z-10 bg-white px-8 py-4 border-r border-b border-slate-50 font-bold text-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.01)]">
                    <span className="text-blue-500 mr-2 font-black">{acc.id}</span> {acc.label}
                  </td>
                  {monthNames.map((_, i) => (
                    <td key={i} className={cn(
                      "px-4 py-4 text-right border-r border-b border-slate-50 font-black tabular-nums",
                      focusedMonthIndex === i ? "bg-blue-50/60 text-blue-700" : "text-emerald-600"
                    )}>{formatCurrency(monthlyRevenueValue)}</td>
                  ))}
                  <td className="px-6 py-4 text-right bg-blue-50/10 border-b border-slate-50 font-black text-blue-700 tabular-nums">{formatCurrency(monthlyRevenueValue * 12)}</td>
                </tr>
              ))}
              <tr className="bg-slate-800 text-white">
                <td colSpan={14} className="sticky left-0 z-20 bg-slate-800 px-8 py-3 font-black uppercase tracking-widest text-[9px]">2. DESPESAS</td>
              </tr>
              {categories.Despesa.map((acc, idx) => (
                <tr key={acc.id} className="hover:bg-red-50/10">
                  <td className="sticky left-0 z-10 bg-white px-8 py-4 border-r border-b border-slate-50 font-bold text-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.01)]">
                    <span className="text-red-500 mr-2 font-black">{acc.id}</span> {acc.label}
                  </td>
                  {monthNames.map((_, i) => (
                    <td key={i} className={cn(
                      "px-4 py-4 text-right border-r border-b border-slate-50 font-black tabular-nums",
                      focusedMonthIndex === i ? "bg-rose-50/60 text-rose-700" : "text-rose-500"
                    )}>{formatCurrency(monthlyExpenseValue)}</td>
                  ))}
                  <td className="px-6 py-4 text-right bg-slate-50/50 border-b border-slate-50 font-black text-rose-700 tabular-nums">{formatCurrency(monthlyExpenseValue * 12)}</td>
                </tr>
              ))}
              <tr className="bg-blue-700 text-white">
                <td className="sticky left-0 z-20 bg-blue-800 px-8 py-6 border-r border-blue-900 font-black uppercase text-[10px] tracking-widest shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Saldo Final</td>
                <td colSpan={13} className="px-10 py-6 text-right font-black text-2xl tracking-tight pr-16 italic">R$ {formatCurrency(estimatedResult)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ContentCard>
    </div>
  );

  return (
    <PageWrapper>
      {notification && (
        <div className="fixed top-24 right-10 z-[300] bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-right duration-500 border border-emerald-500">
          <div className="bg-white/20 p-1.5 rounded-lg"><Check className="w-4 h-4" /></div>
          <span className="font-black text-[10px] uppercase tracking-widest">{notification}</span>
        </div>
      )}

      {view === 'list' ? renderList() : renderSpreadsheet()}

      {/* MODAL NOVO LIVRO CAIXA */}
      <Modal
        isOpen={showEntityModal}
        onClose={() => setShowEntityModal(false)}
        title="Novo Livro Caixa"
        size="md"
      >
        <div className="space-y-6">
          <Input 
            label="Título"
            value={newEntity.name}
            onChange={e => setNewEntity({...newEntity, name: e.target.value})}
            placeholder="Ex: Livro Caixa Unidade"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Ano"
              type="number"
              value={newEntity.year}
              onChange={e => setNewEntity({...newEntity, year: parseInt(e.target.value)})}
            />
            <Input 
              label="Saldo Inicial"
              type="number"
              value={newEntity.initialBalance}
              onChange={e => setNewEntity({...newEntity, initialBalance: e.target.value})}
              addonLeft="R$"
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowEntityModal(false)}>Cancelar</Button>
          <Button onClick={handleCreateEntity}>Criar Livro</Button>
        </ModalFooter>
      </Modal>

      {/* MODAL DE LANÇAMENTO EM LOTE */}
      <Modal
        isOpen={showLaunchModal}
        onClose={() => setShowLaunchModal(false)}
        title="Lançamento em Lote"
        size="lg"
      >
        <div className="space-y-8">
          <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
            <button 
              onClick={() => setLaunchForm({...launchForm, type: 'Receita', category: ''})}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                launchForm.type === 'Receita' ? "bg-white text-emerald-600 shadow-sm border border-slate-100" : "text-slate-400"
              )}
            >
              <TrendingUp className="w-4 h-4" /> Receita
            </button>
            <button 
              onClick={() => setLaunchForm({...launchForm, type: 'Despesa', category: ''})}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                launchForm.type === 'Despesa' ? "bg-white text-rose-500 shadow-sm border border-slate-100" : "text-slate-400"
              )}
            >
              <TrendingDown className="w-4 h-4" /> Despesa
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Select 
              label="Conta Contábil"
              wrapperClassName="sm:col-span-2"
              value={launchForm.category}
              onChange={e => setLaunchForm({...launchForm, category: e.target.value})}
              placeholder="Selecione uma conta..."
              options={categories[launchForm.type].map(c => ({ value: c.label, label: `${c.id} - ${c.label}` }))}
              iconLeft={launchForm.type === 'Receita' ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-rose-500" />}
            />

            <Input 
              label="Valor Unitário"
              type="number"
              placeholder="0,00"
              value={launchForm.amount}
              onChange={e => setLaunchForm({...launchForm, amount: e.target.value})}
              addonLeft="R$"
            />

            <div className="flex flex-col gap-1.5">
              <label className="ds-label">Exercício</label>
              <div className="h-10 bg-slate-50 border border-slate-200 rounded-[10px] px-3 flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                <Calendar className="w-4 h-4" /> {selectedEntity?.year}
              </div>
            </div>

            <Input 
              label="Histórico / Descrição"
              wrapperClassName="sm:col-span-2"
              placeholder="Descrição opcional do lançamento..."
              value={launchForm.description}
              onChange={e => setLaunchForm({...launchForm, description: e.target.value})}
            />
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Aplicar nos meses:</label>
                <div className="flex gap-4">
                   <button onClick={() => setLaunchForm({...launchForm, months: Array.from({length: 12}, (_, i) => i)})} className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline">Todos</button>
                   <button onClick={() => setLaunchForm({...launchForm, months: []})} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:underline">Limpar</button>
                </div>
             </div>
             <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
               {monthNames.map((name, idx) => (
                 <button 
                   key={name}
                   onClick={() => toggleMonthSelection(idx)}
                   className={cn(
                     "py-2.5 text-[9px] font-black rounded-xl border transition-all uppercase tracking-widest",
                     launchForm.months.includes(idx) ? "bg-blue-600 border-blue-600 text-white shadow-md" : "bg-white border-slate-100 text-slate-400 hover:border-blue-100 hover:bg-slate-50"
                   )}
                 >
                   {name.substring(0, 3)}
                 </button>
               ))}
             </div>
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowLaunchModal(false)}>Cancelar</Button>
          <Button 
            onClick={handleLaunchSubmit}
            variant={launchForm.type === 'Receita' ? 'success' : 'danger'}
            iconLeft={<Save className="w-4 h-4" />}
          >
            Processar Lançamentos
          </Button>
        </ModalFooter>
      </Modal>
    </PageWrapper>
  );
};

export default GeneralLedger;
