
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  DollarSign,
  History,
  Plus,
  CheckCircle2,
  MapPin,
  Heart,
  BarChart3,
  Ticket,
  Check,
  Settings as SettingsIcon,
  Edit,
  Briefcase,
  Cake,
  RotateCcw,
  AlertCircle,
  Save,
  X,
  ChevronRight,
  Filter,
  Search,
  Calendar,
  CreditCard,
  UserPlus,
  ArrowRight,
  TrendingUp,
  Info,
  BadgeDollarSign,
  Phone,
  Home,
  UserCheck,
  Trash2,
  Baby,
  Eye,
  ExternalLink,
  PhoneCall,
  LayoutGrid,
  Zap,
  Clock
} from 'lucide-react';
import { api } from '../api';
import { Payment, Member, EventSale, Event, BaseTeam, UserRoleType } from '../types';
import {
  PageWrapper,
  SectionTitle,
  Tabs,
  PanelCard,
  ContentCard,
  FilterLine,
  FilterLineSection,
  FilterLineSearch,
  FilterLineItem,
  FilterLineSegmented,
  Select,
  Input,
  Button,
  IconButton,
  Modal,
  ModalFooter,
  EmptyState,
  Divider,
  Badge,
  ConfirmModal,
  StatGrid,
  StatCard,
  Combobox
} from '../components/ui';
import { cn } from '../src/lib/utils';
import { monthlyAmountForMember, monthlyContributors } from '../utils/paymentRules';
import { isPaidPayment, matchesReference, receivedInPeriod, monthlySettlement, formatPaymentDate, localDateToday, paidLate } from '../utils/paymentAccounting';
import toast from 'react-hot-toast';
import { FamilyPaymentModal } from '../components/FamilyPaymentModal';
import type { BillingUnit } from '../utils/billingUnits';

interface MyTeamViewProps {
  teamId: string;
  userId: string;
  userRole: UserRoleType;
}

const TABS = [
  { id: 'familias',    label: 'Famílias',      icon: Heart },
  { id: 'membros',     label: 'Membros',        icon: Users },
  { id: 'mensalidades',label: 'Mensalidades',   icon: BadgeDollarSign },
  { id: 'eventos',     label: 'Metas Equipe',   icon: Ticket },
  { id: 'historico',   label: 'Extrato',        icon: History },
] as const;

type TabId = typeof TABS[number]['id'];

const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const shortMonths = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const MyTeamView: React.FC<MyTeamViewProps> = ({ teamId, userId, userRole }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('familias');
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<any>(null);
  
  const [editingFamily, setEditingFamily] = useState<{ name: string; memberIds: string[]; relationships: { [id: string]: string } } | null>(null);
  const [defaultMonthlyAmount, setDefaultMonthlyAmount] = useState(50.00);

  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);

  const [payUnit, setPayUnit] = useState<BillingUnit | null>(null);

  const [membersState, setMembersState] = useState<Member[]>([]);
  const [team, setTeam] = useState<BaseTeam | null>(null);
  const [localPayments, setLocalPayments] = useState<Payment[]>([]);
  const [localSales, setLocalSales] = useState<EventSale[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [familySearch, setFamilySearch] = useState('');
  const [familyStatusFilter, setFamilyStatusFilter] = useState('all');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState('all');

  const loadData = () => {
    api.getMembers().then((items: Member[]) => setMembersState(items.filter(m => m.teamId === teamId))).catch(() => setMembersState([]));
    api.getTeams().then((items: BaseTeam[]) => setTeam(items.find(t => t.id === teamId) || null)).catch(() => setTeam(null));
    api.getPayments().then((items: Payment[]) => setLocalPayments(items.filter(p => p.teamId === teamId))).catch(() => setLocalPayments([]));
    api.getEventSales().then((items: EventSale[]) => setLocalSales(items.filter(s => s.teamId === teamId))).catch(() => setLocalSales([]));
    api.getEvents().then(setEvents).catch(() => setEvents([]));
  };

  useEffect(() => {
    loadData();
    window.addEventListener('focus', loadData);
    const iv = setInterval(loadData, 60000);
    return () => { window.removeEventListener('focus', loadData); clearInterval(iv); };
  }, [teamId]);

  useEffect(() => {
    api.getFinancialConfig()
      .then((config: any) => { if (config?.monthlyPaymentAmount) { const v = parseFloat(config.monthlyPaymentAmount); setDefaultMonthlyAmount(isNaN(v) ? 50 : v); } })
      .catch(() => {});
  }, []);

  const financeStats = useMemo(() => {
    const monthlyTotal = localPayments.filter(p => receivedInPeriod(p, viewYear, viewMonth)).reduce((acc, p) => acc + p.amount, 0);
    const yearlyTotal = localPayments.filter(p => receivedInPeriod(p, viewYear)).reduce((acc, p) => acc + p.amount, 0);
    let pendingAmount = 0;
    const payingMembers = monthlyContributors(membersState);
    payingMembers.forEach(m => {
      for (let i = 1; i <= viewMonth; i++) {
        if (!localPayments.some(p => p.memberId === m.id && isPaidPayment(p) && matchesReference(p, i, viewYear))) {
          pendingAmount += monthlyAmountForMember(m, payingMembers, defaultMonthlyAmount);
        }
      }
    });
    return { monthlyTotal, yearlyTotal, pendingAmount };
  }, [localPayments, viewMonth, viewYear, membersState, defaultMonthlyAmount]);

  const groupedMembers = useMemo(() => {
    const map = new Map<string, Member[]>();
    membersState.forEach(m => {
      if (m.familyName?.trim()) {
        if (!map.has(m.familyName)) map.set(m.familyName, []);
        map.get(m.familyName)!.push(m);
      }
    });
    const groups: any[] = [];
    map.forEach((familyMembers, familyName) => {
      const sortedMembers = [...familyMembers].sort((a, b) => {
        const ord: Record<string, number> = { Titular: 1, 'Cônjuge': 2, 'Filho(a)': 3, 'Pai/Mãe': 4, Outro: 5 };
        return (ord[a.relationshipType || 'Outro'] || 5) - (ord[b.relationshipType || 'Outro'] || 5);
      });
      const paying = monthlyContributors(sortedMembers);
      const titular = sortedMembers.find(m => m.relationshipType === 'Titular') || sortedMembers[0];
      const spouse = sortedMembers.find(m => m.relationshipType === 'Cônjuge');
      const isCouple = paying.some(m => m.relationshipType === 'Titular') && paying.some(m => m.relationshipType === 'Cônjuge');
      const amtPerPerson = isCouple ? defaultMonthlyAmount / 2 : defaultMonthlyAmount;
      const monthSettlements = Array.from({ length: 12 }, (_, i) => monthlySettlement(paying.map(m => m.id), localPayments, i + 1, viewYear));
      const monthsStatus = monthSettlements.map(s => s.status === 'paid' || s.status === 'late');
      const atrasos = paying.length === 0 ? 0 : monthsStatus.slice(0, viewMonth).filter(s => !s).length;
      let displayName = `Família ${familyName}`;
      if (spouse) displayName = `${titular.nickname || titular.name.split(' ')[0]} & ${spouse.nickname || spouse.name.split(' ')[0]}`;
      groups.push({ 
        type: isCouple ? 'couple' : 'single', 
        members: sortedMembers, 
        payingMembers: paying, 
        displayName, 
        monthsStatus, 
        monthSettlements,
        atrasos, 
        amountPerPerson: amtPerPerson, 
        familyName,
        titular,
        spouse,
        children: sortedMembers.filter(m => m.relationshipType?.includes('Filho'))
      });
    });
    return groups.sort((a, b) => b.atrasos - a.atrasos);
  }, [membersState, localPayments, viewYear, viewMonth, defaultMonthlyAmount]);

  const filteredGroupedMembers = useMemo(() => groupedMembers
    .filter(g => familyStatusFilter === 'all' ? true : familyStatusFilter === 'pendente' ? g.atrasos > 0 : g.payingMembers.length > 0 && g.atrasos === 0)
    .filter(g => {
      if (!familySearch.trim()) return true;
      const q = familySearch.toLowerCase();
      return g.displayName.toLowerCase().includes(q) || String(g.familyName || '').toLowerCase().includes(q) || g.members.some((m: Member) => m.name.toLowerCase().includes(q));
    }), [groupedMembers, familySearch, familyStatusFilter]);

  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    return membersState.filter(m => m.dob).map(m => {
      const bd = new Date(m.dob!);
      const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      const daysUntil = Math.ceil((next.getTime() - today.getTime()) / 86400000);
      const age = bd.getFullYear() ? (today.getFullYear() - bd.getFullYear()) : 0;
      return { member: m, date: next, daysUntil, age, isToday: daysUntil === 0 };
    }).filter(b => b.daysUntil >= 0 && b.daysUntil <= 30).sort((a, b) => a.daysUntil - b.daysUntil);
  }, [membersState]);

  const availableMembers = useMemo(() => membersState.filter(m => !m.familyName || m.familyName === ''), [membersState]);

  const filteredTeamMembers = useMemo(() =>
    membersState
      .filter(m => memberStatusFilter === 'all' ? true : m.status === memberStatusFilter)
      .filter(m => {
        if (!memberSearch.trim()) return true;
        const q = memberSearch.toLowerCase();
        return m.name.toLowerCase().includes(q) || String(m.nickname || '').toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
    [membersState, memberSearch, memberStatusFilter]);

  const openPayment = (group: any) => setPayUnit({
    key: group.familyName, familyName: group.familyName, displayName: group.displayName, type: group.type,
    payingMembers: group.payingMembers, exemptMembers: group.members.filter((m: Member) => !group.payingMembers.includes(m)),
    amountPerPerson: group.amountPerPerson, monthlyTotal: group.amountPerPerson * group.payingMembers.length,
  });

  const handleSaveFamily = async () => {
    if (!editingFamily || !editingFamily.name || editingFamily.memberIds.length === 0) return;
    toast.promise(
      Promise.all(editingFamily.memberIds.map((memberId, idx) => {
        const member = membersState.find(m => m.id === memberId);
        if (!member) return Promise.resolve();
        const relationshipType = editingFamily.relationships[memberId] || (idx === 0 ? 'Titular' : 'Outro');
        const canPay = relationshipType === 'Titular' || relationshipType === 'Cônjuge';
        return api.updateMember(memberId, {
          ...member,
          familyName: editingFamily.name,
          relationshipType,
          // Filhos e demais dependentes ficam vinculados à família sem gerar cobrança.
          paysMonthly: canPay ? member.paysMonthly !== false : false,
          isPaymentInactive: canPay ? member.isPaymentInactive : false
        });
      })).then(() => {
        loadData();
        setShowFamilyModal(false);
        setEditingFamily(null);
      }),
      {
        loading: 'Salvando família...',
        success: 'Família atualizada com sucesso! ❤️',
        error: 'Erro ao salvar família.'
      }
    );
  };

  const getMemberAge = (dob?: string) => {
    if (!dob) return null;
    const bd = new Date(dob);
    const today = new Date();
    let y = today.getFullYear() - bd.getFullYear();
    const diff = today.getMonth() - bd.getMonth();
    if (diff < 0 || (diff === 0 && today.getDate() < bd.getDate())) y--;
    return y;
  };

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle title={team?.name || 'Minha equipe'} icon={Users}
          description={[[team?.city, team?.state].filter(Boolean).join(' / '), `${groupedMembers.length} famílias`, `${membersState.length} membros`].filter(Boolean).join(' · ')}
          action={<div className="w-full sm:w-64"><Combobox placeholder="Localizar família…" options={groupedMembers.map(group => ({ value: group.familyName, label: group.displayName, subtitle: group.familyName }))}
            onChange={value => { const family = groupedMembers.find(group => group.familyName === value); if (family) { setSelectedFamily(family); setShowDetailModal(true); } }} /></div>} />
        <Tabs<TabId> items={TABS} value={activeTab} onChange={setActiveTab} label="Seções da minha equipe">
        {/* ── TAB FAMÍLIAS ──────────────────────────────────────────────────── */}
        {activeTab === 'familias' && (
          <div className="space-y-4">
            <FilterLine>
               <FilterLineSection grow>
                  <FilterLineItem grow>
                     <FilterLineSearch 
                        value={familySearch}
                        onChange={setFamilySearch}
                        placeholder="Pesquisar famílias ou membros..."
                     />
                  </FilterLineItem>
                  <FilterLineItem>
                     <FilterLineSegmented 
                        value={familyStatusFilter}
                        onChange={(val) => setFamilyStatusFilter(val as string)}
                        options={[
                           { value: 'all', label: 'Todas', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
                           { value: 'pendente', label: 'Pendentes', icon: <Clock className="w-3.5 h-3.5" /> },
                           { value: 'em_dia', label: 'Em Dia', icon: <CheckCircle2 className="w-3.5 h-3.5" /> }
                        ]}
                     />
                  </FilterLineItem>
               </FilterLineSection>
               <FilterLineSection align="right">
                  <Button 
                    size="sm"
                    onClick={() => { setEditingFamily({ name: '', memberIds: [], relationships: {} }); setShowFamilyModal(true); }}
                    iconLeft={<Plus className="w-4 h-4" />}
                  >
                    Nova Família
                  </Button>
               </FilterLineSection>
            </FilterLine>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-3">
              {filteredGroupedMembers.map((group, idx) => {
                const progressPercent = Math.round((group.monthsStatus.filter((s: boolean) => s).length / viewMonth) * 100);
                const isLate = group.atrasos > 0;
                const hasNoMonthlyCharge = group.payingMembers.length === 0;
                
                return (
                  <ContentCard key={idx} padding="none" className={cn(
                    "group transition-all hover:border-blue-200 overflow-hidden flex flex-col h-full border-slate-100",
                    isLate && "border-rose-100 shadow-rose-100/10"
                  )}>
                    <div className={cn(
                      "p-3 flex flex-col gap-4 flex-1",
                      isLate ? "bg-rose-50/10" : "bg-white"
                    )}>
                      <div className="flex items-start justify-between">
                        <div className={cn(
                          "w-7 h-7 rounded-md flex items-center justify-center transition-all shadow-none border",
                          isLate ? "bg-rose-100 text-rose-600 border-rose-200" : hasNoMonthlyCharge ? "bg-slate-50 text-slate-300 border-slate-100" : "bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500"
                        )}>
                          {group.type === 'couple' ? <Heart className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                           <Badge color={isLate ? 'danger' : hasNoMonthlyCharge ? 'default' : 'success'} dot size="sm">
                            {isLate ? `${group.atrasos} meses` : hasNoMonthlyCharge ? 'Sem cobrança' : 'Em Dia'}
                          </Badge>
                          <p className="text-[11px] font-semibold text-slate-400 tracking-normal">{progressPercent}% Adimplência</p>
                        </div>
                      </div>
                      
                      <button type="button" className="text-left focus-visible:outline-blue-500" onClick={() => { setSelectedFamily(group); setShowDetailModal(true); }}>
                        <h3 className="text-sm font-semibold text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors leading-tight">{group.displayName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[11px] font-semibold text-slate-400 tracking-normal">
                            {group.members.length} {group.members.length === 1 ? 'Membro' : 'Membros'} 
                           </span>
                           <div className="w-1 h-1 bg-slate-200 rounded-full" />
                           <span className="text-[11px] font-semibold text-blue-500 tracking-normal">
                             R$ {(group.amountPerPerson * group.payingMembers.length).toFixed(2)}/mês
                           </span>
                        </div>
                      </button>

                      <div className="flex -space-x-1.5 overflow-hidden">
                        {group.members.map((m: Member) => (
                          <div key={m.id} className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 text-slate-400 flex items-center justify-center font-semibold text-[11px] uppercase shadow-sm" title={m.name}>
                            {m.name[0]}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-12 gap-0.5 mt-auto">
                        {group.monthsStatus.map((isPaid: boolean, mIdx: number) => {
                          const isFuture = mIdx + 1 > viewMonth;
                          const hasNoMonthlyCharge = group.payingMembers.length === 0;
                          const settlement = group.monthSettlements[mIdx];
                          return (
                            <div 
                              key={mIdx} 
                              title={`${monthNames[mIdx]}: ${settlement.description}`}
                              className={cn(
                                "h-2.5 rounded-[3px] border transition-all",
                                settlement.status === 'late' || settlement.status === 'partial' ? "bg-amber-400 border-amber-500" : isPaid ? "bg-emerald-500 border-emerald-500" : hasNoMonthlyCharge || isFuture ? "bg-slate-100 border-slate-100" : "bg-rose-500 border-rose-500 shadow-none"
                              )} 
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center gap-2">
                      <Button 
                        variant="primary" 
                        size="xs" 
                        className="flex-1"
                        disabled={group.payingMembers.length === 0}
                        iconLeft={<CreditCard className="w-3 h-3" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openPayment(group);
                        }}
                      >
                        Lançar Recebimento
                      </Button>
                      <IconButton 
                        variant="ghost" 
                        size="xs"
                        aria-label={`Ver detalhes de ${group.displayName}`}
                        className="w-8 h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFamily(group);
                          setShowDetailModal(true);
                        }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </IconButton>
                    </div>
                  </ContentCard>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB MENSALIDADES ─────────────────────────────────────────────────── */}
        {activeTab === 'mensalidades' && (
          <div className="space-y-4">
            <StatGrid cols={3}>
              <StatCard title={`Recebido em ${monthNames[viewMonth-1]}`} description="Pela data do recebimento, incluindo meses atrasados." value={`R$ ${financeStats.monthlyTotal.toFixed(2)}`} icon={TrendingUp} color="success" />
              <StatCard title="Pendências Acumuladas" value={`R$ ${financeStats.pendingAmount.toFixed(2)}`} icon={AlertCircle} color="danger" />
              <StatCard title={`Total Acumulado ${viewYear}`} value={`R$ ${financeStats.yearlyTotal.toFixed(2)}`} icon={BarChart3} color="info" />
            </StatGrid>

            <ContentCard title="Controle Financeiro" className="overflow-hidden">
               <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <Select
                      label="Ano"
                      value={String(viewYear)}
                      size="sm"
                      onChange={e => setViewYear(parseInt(e.target.value))}
                      options={[2024, 2025, 2026, 2027].map(y => ({ value: String(y), label: String(y) }))}
                    />
                    <Select
                      label="Mês de Visão"
                      value={String(viewMonth)}
                      size="sm"
                      onChange={e => setViewMonth(parseInt(e.target.value))}
                      options={monthNames.map((n, i) => ({ value: String(i + 1), label: n }))}
                    />
                  </div>
                  <div className="md:w-56 p-4 bg-blue-50 rounded-lg border border-blue-100 flex flex-col justify-center">
                     <p className="text-[11px] font-semibold text-blue-400 tracking-normal mb-0.5">Expectativa Mensal</p>
                     <p className="text-base font-semibold text-blue-700 tracking-tight">
                        R$ {(() => {
                          const contributors = monthlyContributors(membersState);
                          return contributors.reduce((total, member) => total + monthlyAmountForMember(member, contributors, defaultMonthlyAmount), 0).toFixed(2);
                        })()}
                     </p>
                  </div>
               </div>
            </ContentCard>

            <ContentCard padding="none">
              <p className="px-5 py-3 text-xs text-slate-600">Verde: pago no mês ou antecipado · Amarelo: pago em atraso ou parcial · Vermelho: em aberto. O caixa considera a data do recebimento.</p>
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-3 py-3 text-[11px] font-semibold text-slate-400 tracking-normal border-b border-slate-100 sticky left-0 bg-slate-50 z-20">Unidade Familiar</th>
                      {shortMonths.map((m, idx) => (
                        <th key={m} className={cn(
                          "px-3 py-3 text-[11px] font-semibold text-slate-400 tracking-normal border-b border-slate-100 text-center",
                          idx + 1 === viewMonth && "bg-blue-50 text-blue-600"
                        )}>{m}</th>
                      ))}
                      <th className="px-3 py-3 text-[11px] font-semibold text-slate-400 tracking-normal border-b border-slate-100 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {groupedMembers.map((group, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/10 transition-colors group">
                        <td className="px-3 py-3 sticky left-0 bg-white group-hover:bg-white z-10 border-r border-slate-50">
                           <div className="flex items-center gap-2.5">
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-slate-100",
                                group.atrasos > 0 ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-600"
                              )}>
                                 {group.type === 'couple' ? <Heart className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                              </div>
                              <p className="text-xs font-semibold text-slate-800 tracking-tight truncate max-w-[140px]">{group.displayName}</p>
                           </div>
                        </td>
                        {group.monthsStatus.map((isPaid: boolean, mIdx: number) => {
                          const isFuture = mIdx + 1 > viewMonth;
                          const hasNoMonthlyCharge = group.payingMembers.length === 0;
                          const settlement = group.monthSettlements[mIdx];
                          return (
                            <td key={mIdx} title={settlement.description} className={cn("px-1.5 py-3 text-center", mIdx + 1 === viewMonth && "bg-blue-50/30")}>
                               <div className={cn(
                                 "w-5 h-5 rounded-md mx-auto flex items-center justify-center transition-all",
                                 settlement.status === 'late' || settlement.status === 'partial' ? "bg-amber-100 text-amber-800 border border-amber-300" :
                                 isPaid ? "bg-emerald-500 text-white shadow-md shadow-emerald-100" : 
                                 hasNoMonthlyCharge || isFuture ? "bg-slate-50 text-slate-200 border border-slate-100" : 
                                 "bg-rose-500 text-white shadow-md shadow-rose-100"
                               )}>
                                 {settlement.status === 'late' || settlement.status === 'partial' ? <Clock className="w-3 h-3" /> : isPaid ? <Check className="w-2.5 h-2.5" /> : hasNoMonthlyCharge || isFuture ? null : <X className="w-2.5 h-2.5" />}
                               </div>
                               <span className="block mt-1 text-[11px] leading-tight min-w-[48px] text-slate-600">{isFuture && settlement.status === 'pending' ? 'A vencer' : settlement.status === 'pending' ? 'Em atraso' : settlement.label}</span>
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-center">
                          <IconButton 
                            variant="primary" 
                            size="xs" 
                            className="w-7 h-7"
                            disabled={group.payingMembers.length === 0}
                            onClick={() => {
                              openPayment(group);
                            }}
                          >
                             <Plus className="w-3.5 h-3.5" />
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ContentCard>
          </div>
        )}

        {/* ── TAB METAS EVENTOS ────────────────────────────────────────────── */}
        {activeTab === 'eventos' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {events.map(event => {
              const teamQuota = event.teamQuotas.find(q => q.teamId === teamId);
              const teamSales = localSales.filter(s => s.eventId === event.id).reduce((acc, s) => acc + s.amount, 0);
              const progress = teamQuota ? (teamSales / teamQuota.quotaValue) * 100 : 0;
              
              return (
                <PanelCard key={event.id} title={event.name} description="Meta coletiva da equipe" icon={Ticket}>
                  <div className="p-3 space-y-5">
                     <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                           <p className="text-[11px] font-semibold text-slate-400 tracking-normal mb-0.5">Cota Equipe</p>
                           <p className="text-base font-semibold text-slate-900">R$ {teamQuota?.quotaValue.toFixed(2) || '0.00'}</p>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                           <p className="text-[11px] font-semibold text-emerald-400 tracking-normal mb-0.5">Realizado</p>
                           <p className="text-base font-semibold text-emerald-600">R$ {teamSales.toFixed(2)}</p>
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-semibold uppercase text-slate-400">
                          <span>Progresso da Campanha</span>
                          <span className="text-blue-600">{progress.toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${Math.min(progress, 100)}%` }} />
                        </div>
                     </div>
                  </div>
                </PanelCard>
              );
            })}
          </div>
        )}

        {/* ── TAB HISTÓRICO ─────────────────────────────────────────────────── */}
        {activeTab === 'historico' && (
          <ContentCard padding="none">
            <div className="p-3 border-b border-slate-50">
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">Extrato Recente</h3>
                <p className="text-[11px] text-slate-400 font-semibold tracking-normal mt-0.5 italic">Últimos lançamentos realizados.</p>
            </div>
            <div className="overflow-x-auto no-scrollbar">
               <table className="w-full text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-3 py-3 text-[11px] font-semibold text-slate-400 tracking-normal border-b border-slate-100 whitespace-nowrap sticky left-0 bg-slate-50 z-20">MFCista</th>
                      <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 tracking-normal border-b border-slate-100 whitespace-nowrap">Referência</th>
                      <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 tracking-normal border-b border-slate-100 whitespace-nowrap">Recebido em</th>
                      <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 tracking-normal border-b border-slate-100 whitespace-nowrap">Valor</th>
                      <th className="px-3 py-3 text-[11px] font-semibold text-slate-400 tracking-normal border-b border-slate-100 text-center whitespace-nowrap">Forma</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {[...localPayments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map(p => {
                      const member = membersState.find(m => m.id === p.memberId);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-3 py-3 sticky left-0 bg-white group-hover:bg-white z-10 border-r border-slate-50">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center font-semibold text-xs shrink-0 uppercase">
                                {member?.name[0] || '?'}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-800 tracking-tight whitespace-nowrap">{member?.name || 'Membro'}</p>
                                <p className="text-[11px] font-semibold text-slate-400 uppercase whitespace-nowrap">{p.familyName || '-'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap"><Badge color="default" size="sm">{p.referenceMonth}</Badge><span className="block mt-1 text-[10px] text-slate-600">{paidLate(p) ? 'Pago em atraso' : p.status}</span></td>
                          <td className="px-4 py-3 text-[10px] font-bold text-slate-400 whitespace-nowrap">{formatPaymentDate(p.date)}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-900 whitespace-nowrap">R$ {p.amount.toFixed(2)}</td>
                          <td className="px-3 py-3 text-center">
                             <Badge color="info" dot size="sm">{p.method || 'Pix'}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
            </div>
          </ContentCard>
        )}

        {/* ── TAB MEMBROS ─────────────────────────────────────────────────── */}
        {activeTab === 'membros' && (
          <div className="space-y-4">
            <FilterLine>
               <FilterLineSection grow>
                  <FilterLineItem grow>
                     <FilterLineSearch 
                        value={memberSearch}
                        onChange={setMemberSearch}
                        placeholder="Pesquisar MFCistas..."
                     />
                  </FilterLineItem>
                  <FilterLineItem>
                     <FilterLineSegmented 
                        value={memberStatusFilter}
                        onChange={(val) => setMemberStatusFilter(val as string)}
                        options={[
                           { value: 'all', label: 'Todos', icon: <Users className="w-3.5 h-3.5" /> },
                           { value: 'Ativo', label: 'Ativos', icon: <UserCheck className="w-3.5 h-3.5" /> },
                           { value: 'Inativo', label: 'Inativos', icon: <Zap className="w-3.5 h-3.5" /> }
                        ]}
                     />
                  </FilterLineItem>
               </FilterLineSection>
            </FilterLine>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pt-2">
              {filteredTeamMembers.map(m => (
                <ContentCard key={m.id} padding="none" className="cursor-pointer group hover:border-blue-200 transition-all" onClick={() => navigate(`/mfcistas/${m.id}`)}>
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-semibold text-sm group-hover:bg-blue-600 group-hover:text-white transition-all shadow-none shrink-0 border border-blue-100">
                      {m.name[0]}
                    </div>
                    <div className="min-w-0">
                       <h4 className="text-xs font-semibold text-slate-900 tracking-tight truncate">{m.name}</h4>
                       <p className="text-[11px] text-slate-400 font-semibold tracking-normal mt-0.5 truncate">{m.nickname || 'MFCista'}</p>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
                    <Badge color={m.status === 'Ativo' ? 'success' : 'warning'} size="sm">{m.status}</Badge>
                    <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </ContentCard>
              ))}
            </div>
          </div>
        )}
        </Tabs>
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}

      {/* MODAL DETALHES FAMÍLIA (DRAWER) */}
      <Modal
        isOpen={showDetailModal && !!selectedFamily}
        onClose={() => setShowDetailModal(false)}
        title={selectedFamily?.displayName}
        size="lg"
        position="center"
      >
        {selectedFamily && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Família {selectedFamily.familyName}</p>
                <p className="mt-1 text-xs text-slate-500">{selectedFamily.members.length} integrantes · {selectedFamily.payingMembers.length} contribuintes</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-500">Mensalidade</p>
                <p className="text-base font-semibold text-slate-900">{(selectedFamily.amountPerPerson * selectedFamily.payingMembers.length).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            </div>
            <section>
              <h3 className="text-xs font-semibold text-slate-800 mb-2">Endereço e contatos</h3>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                {[selectedFamily.titular.street, selectedFamily.titular.number, selectedFamily.titular.neighborhood].filter(Boolean).join(', ') || 'Endereço não informado'}
                <span className="block text-xs text-slate-500">{[selectedFamily.titular.city, selectedFamily.titular.state].filter(Boolean).join(' · ')}</span>
              </p>
              <div className="mt-2 divide-y divide-slate-100">
                {[selectedFamily.titular, selectedFamily.spouse].filter(Boolean).map((member: Member) => (
                  <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <span className="text-slate-500">{member.nickname || member.name.split(' ')[0]}</span>
                    {member.phone ? <a className="text-blue-700 hover:underline" href={'tel:' + member.phone}>{member.phone}</a> : <span className="text-slate-400">Telefone não informado</span>}
                  </div>
                ))}
              </div>
            </section>
            <section className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-semibold text-slate-800">Integrantes da família</h3>
                <Button variant="ghost" size="xs" onClick={() => {
                  const relationships: Record<string, string> = {};
                  selectedFamily.members.forEach((m: Member) => { relationships[m.id] = m.relationshipType || 'Outro'; });
                  setEditingFamily({ name: selectedFamily.familyName || '', memberIds: selectedFamily.members.map((m: Member) => m.id), relationships });
                  setShowFamilyModal(true);
                }}>Editar</Button>
              </div>
              <div className="divide-y divide-slate-100">
                {selectedFamily.members.map((member: Member) => (
                  <button key={member.id} type="button" className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-blue-500" onClick={() => navigate('/mfcistas/' + member.id)}>
                    <span className="min-w-0">
                      <span className="block text-[13px] text-slate-800 break-words">{member.name}</span>
                      <span className="block mt-0.5 text-xs text-slate-500">{member.relationshipType || 'Titular'}{getMemberAge(member.dob) !== null ? ' · ' + getMemberAge(member.dob) + ' anos' : ''}</span>
                    </span>
                    <span className="text-[11px] text-slate-500 shrink-0">{selectedFamily.payingMembers.some((m: Member) => m.id === member.id) ? 'Contribuinte' : 'Sem cobrança'}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
        <ModalFooter align="between" className="border-t border-slate-100 mt-6 bg-white sticky bottom-0 -mx-5 -mb-5 p-3">
          <Button variant="ghost" size="sm" onClick={() => setShowDetailModal(false)}>Fechar</Button>
          <Button variant="primary" size="sm" className="px-3" disabled={!selectedFamily?.payingMembers?.length} iconLeft={<CreditCard className="w-4 h-4" />} onClick={() => {
             if (!selectedFamily?.payingMembers?.length) return;
             openPayment(selectedFamily);
          }}>Lançar Mensalidade</Button>
        </ModalFooter>
      </Modal>

      <FamilyPaymentModal isOpen={!!payUnit} onClose={() => setPayUnit(null)} unit={payUnit} teamId={teamId} userId={userId}
        payments={localPayments} defaultMonth={viewMonth} defaultYear={viewYear}
        onSaved={created => { setLocalPayments(prev => [...created, ...prev]); setTimeout(loadData, 500); }} />

      {/* MODAL GESTÃO FAMÍLIA */}
      <Modal
        isOpen={showFamilyModal}
        onClose={() => { setShowFamilyModal(false); setEditingFamily(null); }}
        title="Configurar Unidade Familiar"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Nome da Família *"
            placeholder="Ex: Família Silva"
            size="sm"
            value={editingFamily?.name || ''}
            onChange={e => setEditingFamily(prev => prev ? { ...prev, name: e.target.value } : { name: e.target.value, memberIds: [], relationships: {} })}
            iconLeft={<Heart className="w-4 h-4 text-rose-400" />}
          />

          <div className="space-y-4">
             <div className="flex items-center justify-between px-1">
                <h4 className="text-[11px] font-semibold text-slate-400 tracking-normal">Adicionar Membros</h4>
                <Badge color="info" size="sm">{editingFamily?.memberIds.length || 0} Selecionados</Badge>
             </div>
             
             <Combobox 
                multiple
                placeholder="Pesquisar e adicionar MFCistas..."
                searchPlaceholder="Digite o nome..."
                options={membersState.map(m => ({
                  value: m.id,
                  label: m.name,
                  subtitle: m.familyName ? `Família: ${m.familyName}` : 'Sem Família',
                  badge: m.status,
                  badgeColor: m.status === 'Ativo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                }))}
                value={editingFamily?.memberIds || []}
                onChange={(ids) => {
                  const newIds = ids as string[];
                  setEditingFamily(prev => {
                    if (!prev) return null;
                    const newRel = { ...prev.relationships };
                    newIds.forEach((id, idx) => {
                      if (!newRel[id]) newRel[id] = newIds.length === 1 ? 'Titular' : 'Outro';
                    });
                    return { ...prev, memberIds: newIds, relationships: newRel };
                  });
                }}
             />

             <div className="space-y-2 mt-4">
                {editingFamily?.memberIds.map(id => {
                   const m = membersState.find(x => x.id === id);
                   if (!m) return null;
                   return (
                      <div key={id} className="py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                         <div className="flex items-center gap-3 min-w-0">
                            <div className="min-w-0">
                               <p className="text-[11px] font-semibold text-slate-800 truncate">{m.name}</p>
                               <p className="text-[11px] font-semibold text-slate-400 tracking-normal truncate">{m.nickname || 'MFCista'}</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-2 shrink-0">
                            <Select 
                               value={editingFamily.relationships[id] || 'Outro'}
                               size="sm"
                               className="w-32"
                               onChange={e => setEditingFamily({ ...editingFamily, relationships: { ...editingFamily.relationships, [id]: e.target.value } })}
                               options={['Titular','Cônjuge','Filho(a)','Pai/Mãe','Irmão/Irmã','Neto(a)','Sogro(a)','Outro'].map(v => ({ value: v, label: v }))}
                            />
                            <IconButton variant="ghost" size="xs" className="w-7 h-7" onClick={() => setEditingFamily(prev => {
                               if (!prev) return null;
                               const newIds = prev.memberIds.filter(mid => mid !== id);
                               const newRel = { ...prev.relationships }; delete newRel[id];
                               return { ...prev, memberIds: newIds, relationships: newRel };
                            })}><X className="w-3.5 h-3.5 text-rose-400" /></IconButton>
                         </div>
                      </div>
                   );
                })}
                {(editingFamily?.memberIds.length || 0) === 0 && (
                  <div className="p-10 rounded-lg bg-slate-50/50 border-2 border-dashed border-slate-200 text-center">
                     <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                     <p className="text-[10px] font-semibold text-slate-400 tracking-normal">Nenhum membro selecionado</p>
                  </div>
                )}
             </div>
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" size="sm" onClick={() => { setShowFamilyModal(false); setEditingFamily(null); }}>Cancelar</Button>
          <Button 
            variant="primary" 
            size="sm"
            disabled={!editingFamily?.name || (editingFamily?.memberIds.length || 0) === 0} 
            iconLeft={<Save className="w-4 h-4" />} 
            onClick={handleSaveFamily}
          >
            Salvar Família
          </Button>
        </ModalFooter>
      </Modal>

    </PageWrapper>
  );
};

export default MyTeamView;
