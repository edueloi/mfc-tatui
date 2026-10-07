import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Users, Calendar, MapPin, Search, Trash2, Edit, Check, AlertCircle } from 'lucide-react';
import { api } from '../api';
import { MemberStatus, Member, BaseTeam } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  PageWrapper, 
  SectionTitle, 
  ContentCard, 
  Button, 
  IconButton, 
  Badge,
  Modal,
  EmptyState
} from '../components/ui';

const TeamDetail: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<BaseTeam | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);

  const loadData = () => {
    api.getTeams()
      .then((items: BaseTeam[]) => {
        const found = items.find(t => t.id === teamId) || null;
        setTeam(found);
      })
      .catch(() => setTeam(null));

    api.getMembers()
      .then(setMembers)
      .catch(() => setMembers([]));
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
  }, [teamId]);

  const teamMembers = members.filter(m => m.teamId === teamId);
  const waitingMembers = members.filter(m => m.status === MemberStatus.AGUARDANDO && !m.teamId);

  const handleAttachMember = (member: Member) => {
    if (!teamId) return;
    api.updateMember(member.id, { ...member, teamId })
      .then((updated: Member) => {
        setMembers(prev => prev.map(m => (m.id === updated.id ? updated : m)));
        setTimeout(() => loadData(), 500);
      })
      .catch((error) => {
        console.error('Erro ao vincular membro:', error);
      });
  };

  const ageData = [
    { name: '0-20', value: 2 },
    { name: '21-40', value: 5 },
    { name: '41-60', value: 3 },
    { name: '60+', value: 2 },
  ];

  const birthdayData = [
    { month: 'Jan', count: 1 },
    { month: 'Fev', count: 0 },
    { month: 'Mar', count: 2 },
    { month: 'Abr', count: 1 },
    { month: 'Mai', count: 0 },
    { month: 'Jun', count: 3 },
  ];

  const COLORS = ['#f59e0b', '#fcd34d', '#fbbf24', '#d97706'];

  if (!team) return (
    <PageWrapper>
      <EmptyState 
        icon={Users} 
        title="Equipe não encontrada" 
        description="A equipe que você tentou acessar não existe ou foi removida." 
        action={<Button variant="primary" size="sm" onClick={() => navigate('/equipes')}>Voltar para Equipes</Button>}
      />
    </PageWrapper>
  );

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      }).format(date);
    } catch {
      return dateString;
    }
  };

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <SectionTitle
          title={team.name}
          description={`Fundada em ${formatDate(team.createdAt)}`}
          icon={Users}
          action={
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<ArrowLeft className="w-4 h-4" />}
                onClick={() => navigate('/equipes')}
              >
                Voltar
              </Button>
              <Button
                variant="primary"
                size="sm"
                iconLeft={<UserPlus className="w-4 h-4" />}
                onClick={() => setShowAddMember(true)}
              >
                Vincular Membro
              </Button>
              <IconButton variant="outline" size="sm">
                <Edit className="w-4 h-4" />
              </IconButton>
              <IconButton variant="outline" size="sm" className="hover:bg-red-50 border-red-100">
                <Trash2 className="w-4 h-4 text-red-500" />
              </IconButton>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Member List */}
          <div className="lg:col-span-2 space-y-6">
            <ContentCard padding="none" className="overflow-hidden border-none shadow-xl shadow-slate-200/50 sm:rounded-[2rem]">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100">
                    <Users className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-zinc-800 tracking-tight">Membros Atuais</h3>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{teamMembers.length} pessoas na equipe</p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-zinc-50 bg-white">
                {teamMembers.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-zinc-400 font-medium">Nenhum membro vinculado a esta equipe ainda.</p>
                  </div>
                ) : (
                  teamMembers.map(member => (
                    <div 
                      key={member.id} 
                      className="p-4 flex items-center justify-between hover:bg-zinc-50 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/mfcistas/${member.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-sm uppercase shadow-sm group-hover:scale-105 transition-transform">
                          {member.name.substring(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-800 group-hover:text-amber-600 transition-colors">{member.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-semibold text-zinc-500">{member.phone}</span>
                            {member.status === MemberStatus.ATIVO && (
                              <Badge color="success" size="sm">Ativo</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                         <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Desde</span>
                         <span className="text-xs font-semibold text-zinc-600 bg-zinc-100 px-2 py-1 rounded-md">{member.mfcDate || 'N/A'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ContentCard>
          </div>

          {/* Statistics */}
          <div className="lg:col-span-1 space-y-6">
            <ContentCard padding="md" className="border-none shadow-xl shadow-slate-200/50 sm:rounded-[2rem]">
              <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Faixa Etária</h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ageData} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={5} stroke="none">
                      {ageData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ageData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs font-bold text-zinc-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </ContentCard>

            <ContentCard padding="md" className="border-none shadow-xl shadow-slate-200/50 sm:rounded-[2rem]">
              <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Aniversariantes</h3>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={birthdayData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 700 }} dy={10} />
                    <Tooltip cursor={{ fill: '#f4f4f5', radius: 8 }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                    <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ContentCard>
          </div>
        </div>

        {/* Add Member Modal */}
        <Modal
          isOpen={showAddMember}
          onClose={() => setShowAddMember(false)}
          title="Vincular Membro"
          size="lg"
        >
          <div className="p-4 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-800">Membros Aguardando</h4>
                <p className="text-xs text-amber-600/80 mt-1 font-medium">
                  Abaixo estão listados apenas os membros que estão com status "Aguardando" e ainda não possuem equipe vinculada.
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {waitingMembers.length === 0 ? (
                <EmptyState 
                  icon={Check} 
                  title="Tudo certo!" 
                  description="Não há nenhum membro aguardando vinculação no momento." 
                />
              ) : (
                waitingMembers.map(member => (
                  <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border border-zinc-100 bg-white rounded-2xl hover:border-amber-200 hover:shadow-md transition-all gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-600 flex items-center justify-center text-sm font-black uppercase">
                        {member.name.substring(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-900 truncate">{member.name}</p>
                        <p className="text-xs font-semibold text-zinc-500 truncate">{member.phone}</p>
                      </div>
                    </div>
                    <Button 
                      variant="primary" 
                      size="xs" 
                      onClick={() => handleAttachMember(member)}
                      className="w-full sm:w-auto"
                    >
                      Vincular à Equipe
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      </div>
    </PageWrapper>
  );
};

export default TeamDetail;




