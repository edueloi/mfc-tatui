import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, UserPlus, Users, MapPin, Pencil, Trash2, Check, AlertCircle, Loader2, Layers, Baby, UserCheck, Cake } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { api, photoSrc } from '../api';
import { MemberStatus, Member, BaseTeam } from '../types';
import {
  PageWrapper, ContentCard, PanelCard, Button, Badge, Modal, ModalFooter, ConfirmModal, EmptyState, StatGrid, StatCard, Tabs,
  FilterLine, FilterLineSection, FilterLineSearch, GridTable, usePagination,
} from '../components/ui';
import { TeamFormModal } from '../components/TeamFormModal';
import { maskPhone } from '../utils/masks';
import { dateLabel, yearsSince } from '../utils/dates';
import { matchesDirectorySearch } from '../utils/memberDirectory';
import { findTeamByParam, teamPath } from '../utils/teamSlug';

const tabs = [
  { id: 'membros', label: 'Membros', icon: Users },
  { id: 'resumo', label: 'Resumo', icon: Cake },
] as const;

const shortMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ageBands = [
  { name: 'Até 20 anos', test: (age: number) => age <= 20 },
  { name: '21 a 40 anos', test: (age: number) => age > 20 && age <= 40 },
  { name: '41 a 60 anos', test: (age: number) => age > 40 && age <= 60 },
  { name: 'Mais de 60', test: (age: number) => age > 60 },
];
const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6'];

const Avatar: React.FC<{ member: Member }> = ({ member }) => (
  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-blue-50 text-xs font-semibold text-blue-700">
    {member.photoUrl ? <img src={photoSrc(member.photoUrl)} alt={`Foto de ${member.name}`} className="h-full w-full object-cover" /> : (member.name || '?').substring(0, 2).toUpperCase()}
  </div>
);

const TeamDetail: React.FC = () => {
  const { teamSlug: teamParam } = useParams<{ teamSlug: string }>();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [activeTab, setActiveTab] = useState<typeof tabs[number]['id']>('membros');
  const [search, setSearch] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [teamItems, memberItems] = await Promise.all([api.getTeams(), api.getMembers()]);
        if (cancelled) return;
        setTeams(teamItems);
        setMembers(memberItems);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    setLoading(true);
    setActiveTab('membros');
    setSearch('');
    load();
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.removeEventListener('focus', load); };
  }, [teamParam, retry]);

  const team = useMemo(() => findTeamByParam(teams, teamParam), [teams, teamParam]);

  // Links antigos (/equipes/<id>) e renomeações passam a usar o nome na URL.
  useEffect(() => {
    if (!team) return;
    const path = teamPath(team, teams);
    if (path !== `/equipes/${teamParam}`) navigate(path, { replace: true });
  }, [team, teams, teamParam, navigate]);

  const teamMembers = useMemo(() => members.filter(member => team && member.teamId === team.id).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [members, team]);
  const filteredMembers = useMemo(() => teamMembers.filter(member => matchesDirectorySearch(member, search)), [teamMembers, search]);
  const { page, pageSize, paginatedData, setPage, setPageSize } = usePagination(filteredMembers, 15);
  const waitingMembers = useMemo(() => members.filter(member => member.status === MemberStatus.AGUARDANDO && !member.teamId), [members]);

  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const birthdaysByMonth = shortMonths.map((month, index) => ({ month, total: teamMembers.filter(member => member.dob && Number(member.dob.slice(5, 7)) - 1 === index).length }));
    const ages = ageBands.map(band => ({ name: band.name, value: teamMembers.filter(member => { const age = yearsSince(member.dob); return age !== null && band.test(age); }).length }));
    return {
      active: teamMembers.filter(member => member.status === MemberStatus.ATIVO).length,
      birthdaysThisMonth: birthdaysByMonth[currentMonth].total,
      birthdaysByMonth,
      ages,
      withoutBirthDate: teamMembers.filter(member => yearsSince(member.dob) === null).length,
    };
  }, [teamMembers]);

  const handleAttach = async (member: Member) => {
    if (!team || attachingId) return;
    setAttachingId(member.id);
    try {
      const updated: Member = await api.updateMember(member.id, { ...member, teamId: team.id });
      setMembers(prev => prev.map(item => item.id === updated.id ? updated : item));
      toast.success(`${member.name} vinculado(a) à equipe.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível vincular o membro.');
    } finally { setAttachingId(null); }
  };

  const handleDelete = async () => {
    if (!team || deleting) return;
    setDeleting(true);
    try {
      await api.deleteTeam(team.id);
      toast.success('Equipe excluída.');
      navigate('/equipes', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir a equipe.');
      setDeleting(false);
    }
  };

  if (loading && !team) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando equipe…</div></PageWrapper>;

  if (error || !team) return <PageWrapper><ContentCard><EmptyState icon={Users}
    title={error ? 'Não foi possível carregar a equipe' : 'Equipe não encontrada'}
    description={error ? 'Confira a conexão e tente novamente.' : 'A equipe pode ter sido removida ou o endereço está incorreto.'}
    action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate('/equipes')}>Voltar para Equipes</Button>{error && <Button onClick={() => setRetry(value => value + 1)}>Tentar novamente</Button>}</div>} />
  </ContentCard></PageWrapper>;

  const hasMembers = teamMembers.length > 0;
  const founded = dateLabel(team.createdAt);

  return (
    <PageWrapper>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={() => navigate('/equipes')}>Voltar para Equipes</Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" iconLeft={<UserPlus size={14} />} onClick={() => setShowAddMember(true)}>Vincular membro</Button>
            <Button variant="outline" size="sm" iconLeft={<Pencil size={14} />} onClick={() => setShowEdit(true)}>Editar</Button>
            <Button variant="outline" size="sm" iconLeft={<Trash2 size={14} />} onClick={() => setShowDelete(true)}>Excluir</Button>
          </div>
        </div>

        <ContentCard padding="md">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border ${team.isYouth ? 'border-violet-100 bg-violet-50 text-violet-600' : 'border-blue-100 bg-blue-50 text-blue-600'}`}>
              {team.isYouth ? <Baby size={24} /> : <Layers size={24} />}
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 break-words">{team.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500 break-words"><MapPin size={12} className="shrink-0" />{team.city} / {team.state}{founded && ` · Cadastrada em ${founded}`}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge color={team.isYouth ? 'purple' : 'info'} dot>{team.isYouth ? 'MFC Jovem' : 'Equipe base'}</Badge>
                <span className="text-xs text-slate-500">{teamMembers.length} {teamMembers.length === 1 ? 'membro' : 'membros'}</span>
              </div>
            </div>
          </div>
        </ContentCard>

        <StatGrid cols={3}>
          <StatCard title="Membros" value={teamMembers.length} icon={Users} color="info" />
          <StatCard title="Ativos" value={stats.active} icon={UserCheck} color="success" />
          <StatCard title="Aniversários no mês" value={stats.birthdaysThisMonth} icon={Cake} color="purple" />
        </StatGrid>

        <Tabs<typeof tabs[number]['id']> items={tabs} value={activeTab} onChange={setActiveTab} label="Detalhes da equipe">
          {activeTab === 'membros' && <div className="space-y-3">
            <FilterLine>
              <FilterLineSection grow><FilterLineSearch aria-label="Buscar membros da equipe" value={search} onChange={setSearch} placeholder="Nome, apelido, telefone ou CPF…" /></FilterLineSection>
              <FilterLineSection><span className="text-xs text-slate-500">{filteredMembers.length} {filteredMembers.length === 1 ? 'membro' : 'membros'}</span>{search && <Button variant="ghost" size="sm" onClick={() => setSearch('')}>Limpar busca</Button>}</FilterLineSection>
            </FilterLine>
            <ContentCard padding="none">
              <GridTable<Member> data={paginatedData} keyExtractor={member => member.id} noDesktopCard onRowClick={member => navigate(`/mfcistas/${member.id}`)}
                columns={[
                  { header: 'MFCista', render: member => <div className="flex min-w-0 items-center gap-2.5"><Avatar member={member} /><div className="min-w-0"><p className="text-xs font-medium text-slate-800 break-words">{member.name}</p>{member.nickname && <p className="mt-0.5 text-[11px] text-slate-500">{member.nickname}</p>}</div></div> },
                  { header: 'Telefone', render: member => <span className="text-xs whitespace-nowrap text-slate-700">{maskPhone(member.phone || '') || 'Não informado'}</span> },
                  { header: 'Status', render: member => <Badge size="sm" dot color={member.status === MemberStatus.ATIVO ? 'success' : member.status === MemberStatus.AGUARDANDO || member.status === MemberStatus.PENDENTE ? 'warning' : 'default'}>{member.status || 'Não informado'}</Badge> },
                  { header: 'No MFC desde', render: member => <span className="text-xs whitespace-nowrap text-slate-700">{dateLabel(member.mfcDate) || 'Não informado'}</span> },
                ]}
                emptyMessage={<EmptyState icon={Users} title={hasMembers ? 'Nenhum membro encontrado' : 'Nenhum membro nesta equipe'}
                  description={hasMembers ? 'Ajuste a busca para encontrar o membro.' : 'Vincule MFCistas que estão aguardando uma equipe.'}
                  action={!hasMembers ? <Button size="sm" iconLeft={<UserPlus size={14} />} onClick={() => setShowAddMember(true)}>Vincular membro</Button> : undefined} />}
                pagination={{ total: filteredMembers.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }} />
            </ContentCard>
          </div>}

          {activeTab === 'resumo' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PanelCard title="Faixa etária" description={stats.withoutBirthDate ? `${stats.withoutBirthDate} sem data de nascimento não entram no gráfico.` : 'Distribuição por idade dos membros.'}>
              {stats.ages.some(band => band.value > 0) ? <div className="h-64 min-w-0">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}><PieChart>
                  <Pie data={stats.ages.filter(band => band.value > 0)} innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value" nameKey="name">
                    {stats.ages.filter(band => band.value > 0).map(band => <Cell key={band.name} fill={COLORS[stats.ages.indexOf(band) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart></ResponsiveContainer>
              </div> : <EmptyState icon={Users} title="Sem dados de idade" description="Cadastre a data de nascimento dos membros para ver o gráfico." />}
            </PanelCard>
            <PanelCard title="Aniversariantes por mês" description="Quantidade de membros que fazem aniversário em cada mês.">
              <div className="h-64 min-w-0">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}><BarChart data={stats.birthdaysByMonth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [value, 'Aniversariantes']} />
                  <Bar dataKey="total" fill="#2563eb" radius={[3, 3, 0, 0]} barSize={20} />
                </BarChart></ResponsiveContainer>
              </div>
            </PanelCard>
          </div>}
        </Tabs>
      </div>

      <Modal isOpen={showAddMember} onClose={() => setShowAddMember(false)} title="Vincular membro" size="lg"
        footer={<ModalFooter><Button variant="ghost" size="sm" onClick={() => setShowAddMember(false)}>Fechar</Button></ModalFooter>}>
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500"><AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-500" />Aparecem apenas MFCistas com status “Aguardando” que ainda não têm equipe.</p>
          {waitingMembers.length === 0
            ? <EmptyState icon={Check} title="Tudo certo" description="Nenhum MFCista aguardando vinculação no momento." />
            : <div className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
              {waitingMembers.map(member => <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5"><Avatar member={member} /><div className="min-w-0"><p className="text-[13px] text-slate-800 break-words">{member.name}</p><p className="text-xs text-slate-500">{maskPhone(member.phone || '') || 'Telefone não informado'}</p></div></div>
                <Button size="xs" loading={attachingId === member.id} disabled={!!attachingId} onClick={() => handleAttach(member)}>Vincular</Button>
              </div>)}
            </div>}
        </div>
      </Modal>

      <TeamFormModal isOpen={showEdit} team={team} onClose={() => setShowEdit(false)}
        onSaved={saved => { setTeams(prev => prev.map(item => item.id === saved.id ? { ...item, ...saved } : item)); }} />

      {teamMembers.length > 0 ? (
        <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Não é possível excluir" size="sm"
          footer={<ModalFooter><Button size="sm" onClick={() => setShowDelete(false)}>Entendi</Button></ModalFooter>}>
          <p className="text-[13px] leading-relaxed text-slate-600">A equipe <strong className="text-slate-900">{team.name}</strong> tem {teamMembers.length} {teamMembers.length === 1 ? 'membro vinculado' : 'membros vinculados'}. Desvincule todos antes de excluir.</p>
        </Modal>
      ) : (
        <ConfirmModal isOpen={showDelete} onClose={() => setShowDelete(false)} onConfirm={handleDelete} loading={deleting}
          title="Excluir equipe?" message={`A equipe "${team.name}" será excluída. Esta ação não pode ser desfeita.`} confirmLabel="Excluir equipe" variant="danger" />
      )}
    </PageWrapper>
  );
};

export default TeamDetail;
