
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Wallet, 
  Search, 
  Filter, 
  ChevronRight, 
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowLeft,
  DollarSign,
  Printer,
  ChevronLeft
} from 'lucide-react';
import { api } from '../api';
import { MemberStatus, Member, BaseTeam, Payment } from '../types';
import { PageWrapper, SectionTitle, StatGrid, ContentCard, Button, IconButton, Input, Select } from '../components/ui';
import { StatCard } from '../components/ui/StatCard';
import { cn } from '../src/lib/utils';
import { monthlyAmountForMember, monthlyContributors } from '../utils/paymentRules';
import { isPaidPayment, matchesReference, receivedInPeriod, paidLate, formatPaymentDate } from '../utils/paymentAccounting';

interface FinanceViewProps {
  cityId: string;
}

const FinanceView: React.FC<FinanceViewProps> = ({ cityId }) => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [defaultMonthlyAmount, setDefaultMonthlyAmount] = useState(30);

  const loadData = () => {
    api.getTeams().then(setTeams).catch(() => setTeams([]));
    api.getMembers().then(setMembers).catch(() => setMembers([]));
    api.getPayments().then(setPayments).catch(() => setPayments([]));
    api.getFinancialConfig().then((config: any) => {
      if (config && config.monthlyPaymentAmount) {
        setDefaultMonthlyAmount(parseFloat(config.monthlyPaymentAmount));
      }
    }).catch(() => {});
  };

  useEffect(() => {
    loadData();

    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);
    
    const interval = setInterval(loadData, 30000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  const cityTeams = teams.filter(t => searchTerm === '' || t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const getTeamStats = (teamId: string) => {
    const teamMembers = monthlyContributors(members.filter(m => m.teamId === teamId));
    const teamPayments = payments.filter(p => {
      if (p.teamId !== teamId || !teamMembers.some(member => member.id === p.memberId)) return false;
      return isPaidPayment(p) && matchesReference(p, selectedMonth, selectedYear);
    });
    
    const paidMembers = new Set(teamPayments.map(p => p.memberId));
    const paidCount = paidMembers.size;
    const totalAmount = payments.filter(p => p.teamId === teamId && receivedInPeriod(p, selectedYear, selectedMonth)).reduce((sum, p) => sum + p.amount, 0);
    
    return {
      total: teamMembers.length,
      paid: paidCount,
      percent: teamMembers.length > 0 ? (paidCount / teamMembers.length) * 100 : 0,
      amount: totalAmount
    };
  };

  const calculateExpectedAmount = (activeMembers: Member[]) => {
    const contributors = monthlyContributors(activeMembers);
    return contributors.reduce((total, member) => total + monthlyAmountForMember(member, contributors, defaultMonthlyAmount), 0);
  };

  const allActiveMembers = monthlyContributors(members);
  const allPayments = payments.filter(p => {
    return isPaidPayment(p) && matchesReference(p, selectedMonth, selectedYear) && allActiveMembers.some(member => member.id === p.memberId);
  });
  
  const cashReceipts = payments.filter(p => receivedInPeriod(p, selectedYear, selectedMonth));
  const totalArrecadado = cashReceipts.reduce((sum, p) => sum + p.amount, 0);
  const paidMembersSet = new Set(allPayments.map(p => p.memberId));
  const totalPago = paidMembersSet.size;
  const totalEsperado = calculateExpectedAmount(allActiveMembers);
  // Recebimentos de meses antigos não abatem a dívida da referência selecionada.
  const pendente = allActiveMembers.reduce((total, member) => {
    const expected = monthlyAmountForMember(member, allActiveMembers, defaultMonthlyAmount);
    const paid = allPayments.filter(p => p.memberId === member.id).reduce((sum, p) => sum + p.amount, 0);
    return total + Math.max(0, expected - paid);
  }, 0);
  const equipesEmDia = cityTeams.filter(t => getTeamStats(t.id).percent === 100).length;
  
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const renderTeamList = () => (
    <div className="space-y-6">
      <StatGrid cols={3}>
        <StatCard 
          title="Recebido no mês"
          value={`R$ ${totalArrecadado.toFixed(2)}`}
          icon={Wallet}
          color="info"
          description={`Caixa de ${monthNames[selectedMonth - 1]}/${selectedYear}, incluindo atrasados`}
        />
        
        <StatCard 
          title="Em aberto da referência"
          value={`R$ ${Math.max(0, pendente).toFixed(2)}`}
          icon={Clock}
          color="warning"
          description={`Mensalidades de ${monthNames[selectedMonth - 1]}/${selectedYear}`}
        />

        <StatCard 
          title="Equipes em Dia"
          value={`${equipesEmDia} / ${cityTeams.length}`}
          icon={CheckCircle2}
          color="success"
          description={`${totalPago} responsáveis pagaram a referência selecionada`}
        />
      </StatGrid>

      <ContentCard padding="none" className="overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Status das Equipes Base</h3>
          <div className="flex items-center gap-3">
            <Input 
              iconLeft={<Search className="w-4 h-4 text-slate-400" />}
              placeholder="Buscar equipe..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              wrapperClassName="w-full sm:w-64"
            />
            <IconButton variant="outline" className="border-slate-200">
              <Printer className="w-5 h-5 text-slate-400" />
            </IconButton>
          </div>
        </div>

        <div className="divide-y divide-slate-50">
          {cityTeams.map(team => {
            const stats = getTeamStats(team.id);
            return (
              <div 
                key={team.id} 
                onClick={() => setSelectedTeamId(team.id)}
                className="p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-blue-50/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-sm",
                    stats.percent === 100 ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                  )}>
                    {team.name.substring(0, 2)}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 group-hover:text-blue-700 transition-colors">{team.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                      <Users className="w-3 h-3" /> {stats.total} Responsáveis pela mensalidade
                    </p>
                  </div>
                </div>

                <div className="mt-4 md:mt-0 md:px-12 flex-1 max-w-xs">
                  <div className="flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    <span>arrecadação</span>
                    <span>{stats.paid} / {stats.total}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500",
                        stats.percent === 100 ? "bg-emerald-500" : stats.percent > 50 ? "bg-blue-500" : "bg-amber-500"
                      )}
                      style={{ width: `${stats.percent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 md:mt-0 flex items-center gap-6">
                  <div className="text-right">
                    <p className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      stats.percent === 100 ? "text-emerald-600" : "text-amber-600"
                    )}>
                      {stats.percent === 100 ? 'EM DIA' : 'PENDENTE'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold">R$ {stats.amount.toFixed(2)} arrecadado</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      </ContentCard>
    </div>
  );

  const renderTeamDetail = () => {
    const team = teams.find(t => t.id === selectedTeamId);
    const teamMembers = monthlyContributors(members.filter(m => m.teamId === selectedTeamId));
    
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setSelectedTeamId(null)}
            iconLeft={<ChevronLeft className="w-4 h-4" />}
          >
            Voltar para lista de equipes
          </Button>
        </div>

        <ContentCard>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">{team?.name}</h2>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg uppercase tracking-widest border border-blue-100">Equipe Base</span>
              </div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Lançamentos referentes ao mês de <strong>{monthNames[selectedMonth - 1]}/{selectedYear}</strong></p>
            </div>
            <div className="flex gap-3">
              <Button iconLeft={<DollarSign className="w-4 h-4" />}>
                Lançar Lote Completo
              </Button>
            </div>
          </div>
        </ContentCard>

        <ContentCard padding="none" className="overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsável</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Pagamento</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Lançamento</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {teamMembers.map(member => {
                  const payment = payments.find(p => {
                    if (p.memberId !== member.id) return false;
                    return isPaidPayment(p) && matchesReference(p, selectedMonth, selectedYear);
                  });
                  
                  const memberExpectedAmount = monthlyAmountForMember(member, teamMembers, defaultMonthlyAmount);
                  
                  const isPaid = !!payment;
                  const paymentAmount = payment?.amount || memberExpectedAmount;
                  const paymentDate = payment?.date ? formatPaymentDate(payment.date) : '---';
                  
                  return (
                    <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs uppercase">
                            {member.name.substring(0, 1)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-900">{member.name}</span>
                              {member.relationshipType && member.relationshipType !== 'Titular' && (
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 uppercase tracking-widest border border-blue-100">
                                  {member.relationshipType}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-0.5">
                              {member.familyName && (
                                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.15em]">
                                  Família {member.familyName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          {isPaid ? (
                            <span className={cn("flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest", paidLate(payment) ? 'text-amber-700' : 'text-emerald-500')}>
                              <CheckCircle2 className="w-3.5 h-3.5" /> {paidLate(payment) ? 'Pago em atraso' : 'Pago'}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                              <Clock className="w-3.5 h-3.5" /> Pendente
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-xs font-bold text-slate-400">
                        {paymentDate}
                      </td>
                      <td className="px-8 py-5 text-sm font-black text-slate-900">
                        R$ {paymentAmount.toFixed(2)}
                      </td>
                      <td className="px-8 py-5 text-right">
                        {isPaid ? (
                          <button className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors">Estornar</button>
                        ) : (
                          <Button variant="success" size="xs">
                            Confirmar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ContentCard>
      </div>
    );
  };

  const selector = (
    <div className="flex items-center gap-3">
      <Select 
        size="sm"
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
        options={monthNames.map((month, index) => ({ value: index + 1, label: month }))}
        wrapperClassName="w-32"
      />
      <Select 
        size="sm"
        value={selectedYear}
        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
        options={[2024, 2025, 2026, 2027].map(year => ({ value: year, label: year.toString() }))}
        wrapperClassName="w-24"
      />
    </div>
  );

  return (
    <PageWrapper>
      <SectionTitle 
        title="Tesouraria Geral"
        description="Gestão financeira de todas as Equipes Bases."
        icon={Wallet}
        action={selector}
      />

      {selectedTeamId ? renderTeamDetail() : renderTeamList()}
      <ContentCard title={`Recebimentos de ${monthNames[selectedMonth - 1]}/${selectedYear}`} className="mt-6">
        <p className="mb-4 text-xs text-slate-500">Valores que entraram no caixa neste mês. A referência informa qual mensalidade foi paga.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="text-slate-500 border-b"><th className="p-3">Responsável</th><th className="p-3">Mensalidade</th><th className="p-3">Recebido em</th><th className="p-3">Situação</th><th className="p-3 text-right">Valor</th></tr></thead>
            <tbody>{cashReceipts.filter(p => !selectedTeamId || p.teamId === selectedTeamId).map(payment => (
              <tr key={payment.id} className="border-b border-slate-100">
                <td className="p-3">{payment.memberName || members.find(m => m.id === payment.memberId)?.name || 'Membro'}</td>
                <td className="p-3">{payment.referenceMonth}</td>
                <td className="p-3 whitespace-nowrap">{formatPaymentDate(payment.date)}</td>
                <td className={cn('p-3', paidLate(payment) ? 'text-amber-700' : 'text-emerald-700')}>{paidLate(payment) ? 'Pago em atraso' : 'Pago'}</td>
                <td className="p-3 text-right whitespace-nowrap">R$ {payment.amount.toFixed(2)}</td>
              </tr>
            ))}</tbody>
          </table>
          {!cashReceipts.some(p => !selectedTeamId || p.teamId === selectedTeamId) && <p className="py-6 text-sm text-slate-500">Nenhum recebimento neste período.</p>}
        </div>
      </ContentCard>
    </PageWrapper>
  );
};

export default FinanceView;
