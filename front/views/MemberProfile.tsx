import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, User, Users, Home, Stethoscope, Award, ClipboardList, Phone, MessageCircle, Loader2 } from 'lucide-react';
import { api, photoSrc } from '../api';
import { Member, BaseTeam } from '../types';
import { PageWrapper, ContentCard, PanelCard, Button, Badge, EmptyState, DetailField, Tabs } from '../components/ui';
import { maskCPF, maskPhone, maskCEP } from '../utils/masks';
import { dateLabel, yearsSince } from '../utils/dates';
import { useUrlTab } from '../src/hooks/useUrlTab';

const tabs = [
  { id: 'pessoal', label: 'Perfil', icon: User },
  { id: 'familia', label: 'Família', icon: Users },
  { id: 'endereco', label: 'Endereço', icon: Home },
  { id: 'saude', label: 'Saúde', icon: Stethoscope },
  { id: 'historico', label: 'Cargos', icon: Award },
  { id: 'registro', label: 'Cadastro', icon: ClipboardList },
] as const;
const tabIds = tabs.map(tab => tab.id);

const fieldsClass = 'grid grid-cols-2 xl:grid-cols-3 gap-x-4 sm:gap-x-6';
/** Campo do perfil: no celular, valores longos ocupam a linha inteira (os curtos ficam lado a lado). */
const F = (props: React.ComponentProps<typeof DetailField>) => <DetailField {...props} className={String(props.value ?? '').length > 18 || props.label.length > 20 ? 'col-span-2 sm:col-span-1' : undefined} />;

const MemberProfile: React.FC = () => {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [activeTab, setActiveTab] = useUrlTab(tabIds, 'pessoal');

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;
    setLoading(true);
    setMember(null);
    const load = async () => {
      const currentRequest = ++requestId;
      try {
        const [members, baseTeams] = await Promise.all([api.getMembers(), api.getTeams()]);
        if (cancelled || currentRequest !== requestId) return;
        setMember(members.find((item: Member) => item.id === memberId) || null);
        setTeams(baseTeams);
        setError(false);
      } catch {
        if (!cancelled && currentRequest === requestId) setError(true);
      } finally {
        if (!cancelled && currentRequest === requestId) setLoading(false);
      }
    };
    load();
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.removeEventListener('focus', load); };
  }, [memberId, retry]);

  if (loading) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando MFCista…</div></PageWrapper>;

  if (error || !member) return <PageWrapper><ContentCard><EmptyState icon={User}
    title={error ? 'Não foi possível carregar o cadastro' : 'MFCista não encontrado'}
    description={error ? 'Confira a conexão e tente novamente.' : 'O cadastro pode ter sido removido.'}
    action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate('/mfcistas')}>Voltar para MFCistas</Button>{error && <Button onClick={() => setRetry(value => value + 1)}>Tentar novamente</Button>}</div>} />
  </ContentCard></PageWrapper>;

  const team = teams.find(item => item.id === member.teamId);
  const age = yearsSince(member.dob);
  const mfcYears = yearsSince(member.mfcDate);
  const phone = (member.phone || '').replace(/\D/g, '');
  const contactPhone = phone.length === 10 || phone.length === 11 ? `55${phone}` : /^55\d{10,11}$/.test(phone) ? phone : '';
  const edit = () => navigate(`/mfcistas/${member.id}/editar`);
  const hasMarriage = !!(member.spouseName || member.spouseCpf || member.marriageDate || member.maritalStatus?.startsWith('Casado'));

  return <PageWrapper>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={() => navigate('/mfcistas')}>Voltar para MFCistas</Button>
        <Button variant="outline" size="sm" iconLeft={<Edit size={14} />} onClick={edit}>Editar cadastro</Button>
      </div>

      <ContentCard padding="md">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-blue-50 text-base font-semibold text-blue-700">
              {member.photoUrl ? <img src={photoSrc(member.photoUrl)} alt={`Foto de ${member.name}`} className="w-full h-full object-cover" /> : (member.name || '?').substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 break-words">{member.name}</h1>
              <p className="text-xs text-slate-500 mt-1 break-words">{[member.nickname, team?.name || 'Sem equipe', [member.city, member.state].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge color={member.status === 'Ativo' ? 'success' : member.status === 'Aguardando' || member.status === 'Pendente' ? 'warning' : 'default'} dot>{member.status || 'Não informado'}</Badge>
                {age !== null && <span className="text-xs text-slate-500">{age} anos</span>}
                {mfcYears !== null && <span className="text-xs text-slate-500">{mfcYears < 1 ? 'Menos de 1 ano no MFC' : `${mfcYears} ${mfcYears === 1 ? 'ano' : 'anos'} no MFC`}</span>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button variant="outline" size="sm" disabled={!contactPhone} title={!contactPhone ? 'Telefone não informado ou incompleto' : 'Abrir conversa'} iconLeft={<MessageCircle size={14} />} onClick={() => window.open(`https://wa.me/${contactPhone}`, '_blank', 'noopener,noreferrer')}>WhatsApp</Button>
            <Button variant="outline" size="sm" disabled={!contactPhone} title={!contactPhone ? 'Telefone não informado ou incompleto' : 'Ligar para o MFCista'} iconLeft={<Phone size={14} />} onClick={() => { window.location.href = `tel:+${contactPhone}`; }}>Ligar</Button>
          </div>
        </div>
      </ContentCard>

      <Tabs<typeof tabs[number]['id']> items={tabs} value={activeTab} onChange={setActiveTab} label="Detalhes do MFCista">
        {activeTab === 'pessoal' && <div className="space-y-3">
          <PanelCard title="Dados pessoais">
            <dl className={fieldsClass}>
              <F label="Nome completo" value={member.name} />
              <F label="Nome no crachá" value={member.nickname} />
              <F label="Data de nascimento" value={dateLabel(member.dob)} />
              <F label="Sexo" value={member.gender} />
              <F label="Estado civil" value={member.maritalStatus} />
              <F label="Naturalidade" value={member.naturalness} />
              <F label="RG" value={member.rg} />
              <F label="CPF" value={maskCPF(member.cpf || '')} />
              <F label="Religião" value={member.religion} />
            </dl>
          </PanelCard>
          <PanelCard title="Contato e profissão">
            <dl className={fieldsClass}>
              <F label="Telefone principal" value={maskPhone(member.phone || '')} />
              <F label="Telefone de emergência" value={maskPhone(member.emergencyPhone || '')} />
              <F label="Profissão" value={member.profession} />
              <F label="Escolaridade" value={member.education} />
            </dl>
          </PanelCard>
        </div>}

        {activeTab === 'familia' && <PanelCard title="Família e vínculos">
          <dl className={fieldsClass}>
            <F label="Família" value={member.familyName} />
            <F label="Vínculo na família" value={member.relationshipType} />
            <F label="Estado civil" value={member.maritalStatus} />
            <F label="Pai" value={member.father} />
            <F label="Mãe" value={member.mother} />
          </dl>
          {hasMarriage && <div className="mt-4">
            <h3 className="text-xs font-semibold text-slate-700">Casamento</h3>
            <dl className={fieldsClass}>
              <F label="Cônjuge" value={member.spouseName} />
              <F label="CPF do cônjuge" value={maskCPF(member.spouseCpf || '')} />
              <F label="Data do casamento" value={dateLabel(member.marriageDate)} />
            </dl>
          </div>}
        </PanelCard>}

        {activeTab === 'endereco' && <PanelCard title="Endereço residencial">
          <dl className={fieldsClass}>
            <F label="CEP" value={maskCEP(member.zip || '')} />
            <F label="Logradouro" value={member.street} />
            <F label="Número" value={member.number} />
            <F label="Complemento" value={member.complement} />
            <F label="Bairro" value={member.neighborhood} />
            <F label="Cidade" value={member.city} />
            <F label="Estado" value={member.state} />
            <F label="CONDIR" value={member.condir} />
          </dl>
        </PanelCard>}

        {activeTab === 'saude' && <PanelCard title="Saúde e cuidados">
          <dl className={fieldsClass}>
            <F label="Tipo sanguíneo" value={member.bloodType} />
            <F label="Alergias" value={member.allergy} />
            <F label="Restrição alimentar" value={member.diet} />
            <F label="Medicação em uso" value={member.medication} />
            <F label="Plano de saúde" value={member.healthPlan} />
            <F label="Dificuldade de locomoção" value={member.mobilityIssue} />
            <F label="Fumante" value={member.smoker == null ? '' : member.smoker ? 'Sim' : 'Não'} />
            <F label="Pessoa com deficiência" value={member.pcd == null ? '' : member.pcd ? 'Sim' : 'Não'} />
            {member.pcd && <F label="Descrição da deficiência" value={member.pcdDescription} />}
          </dl>
        </PanelCard>}

        {activeTab === 'historico' && <PanelCard title="Trajetória no MFC">
          <dl className={fieldsClass}>
            <F label="No MFC desde" value={dateLabel(member.mfcDate)} />
            <F label="Equipe base" value={team?.name || 'Sem equipe'} />
          </dl>
          <h3 className="text-xs font-semibold text-slate-700 mt-4 mb-2">Cargos registrados</h3>
          {(member.movementRoles || []).length ? <ul className="divide-y divide-slate-100">{member.movementRoles.map((role, index) => <li key={`${role}-${index}`} className="text-[13px] text-slate-700 py-2 break-words">{role}</li>)}</ul> : <p className="text-xs text-slate-500 py-2">Nenhum cargo registrado.</p>}
        </PanelCard>}

        {activeTab === 'registro' && <PanelCard title="Informações do cadastro">
          <dl className={fieldsClass}>
            <F label="Data de cadastro" value={dateLabel(member.createdAt)} />
            <F label="Última atualização" value={dateLabel(member.updatedAt)} />
            <F label="Status" value={member.status} />
          </dl>
          <p className="text-xs text-slate-500 mt-4">Use “Editar cadastro” para atualizar os dados deste MFCista. As credenciais de acesso são gerenciadas na área de usuários.</p>
        </PanelCard>}
      </Tabs>
    </div>
  </PageWrapper>;
};

export default MemberProfile;
