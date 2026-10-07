import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { api } from '../api';
import { Member, BaseTeam } from '../types';
import { maskCPF, maskPhone, maskCEP, maskRG, unmask } from '../utils/masks';
import { PageWrapper, SectionTitle, ContentCard, Button } from '../components/ui';
import { MemberForm } from '../components/MemberForm';

const MemberFormPage: React.FC = () => {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const isEditing = !!memberId;

  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(isEditing);

  useEffect(() => {
    api.getTeams().then(setTeams).catch(() => setTeams([]));
  }, []);

  useEffect(() => {
    if (!memberId) return;
    setLoading(true);
    api.getMembers()
      .then((list: Member[]) => {
        const found = list.find(m => m.id === memberId);
        if (!found) {
          toast.error('MFCista não encontrado.');
          navigate('/mfcistas');
          return;
        }
        setMember(found);
      })
      .catch(() => {
        toast.error('Erro ao carregar MFCista.');
        navigate('/mfcistas');
      })
      .finally(() => setLoading(false));
  }, [memberId]);

  const handleSave = (data: Partial<Member>) => {
    const payload: Partial<Member> = {
      ...data,
      rg: unmask(data.rg || ''),
      cpf: unmask(data.cpf || ''),
      spouseCpf: unmask(data.spouseCpf || ''),
      phone: unmask(data.phone || ''),
      emergencyPhone: unmask(data.emergencyPhone || ''),
      zip: unmask(data.zip || ''),
      movementRoles: data.movementRoles || [],
      updatedAt: new Date().toISOString(),
    };

    if (isEditing && memberId) {
      return toast.promise(
        api.updateMember(memberId, payload).then(() => {
          navigate(`/mfcistas/${memberId}`);
        }),
        { loading: 'Atualizando...', success: 'MFCista atualizado! ✅', error: (e) => e.message }
      ).catch(() => {});
    } else {
      return toast.promise(
        api.createMember({ ...payload, createdAt: new Date().toISOString() }).then(() => {
          navigate('/mfcistas');
        }),
        { loading: 'Criando...', success: 'MFCista criado! 🎉', error: (e) => e.message }
      ).catch(() => {});
    }
  };

  const handleCancel = () => navigate(-1);

  if (isEditing && loading) {
    return (
      <PageWrapper>
        <p className="text-sm text-zinc-400">Carregando...</p>
      </PageWrapper>
    );
  }

  const initialData = member
    ? {
        ...member,
        rg: maskRG(member.rg || ''),
        cpf: maskCPF(member.cpf || ''),
        zip: maskCEP(member.zip || ''),
        phone: maskPhone(member.phone || ''),
        emergencyPhone: maskPhone(member.emergencyPhone || ''),
        spouseCpf: maskCPF(member.spouseCpf || ''),
      }
    : undefined;

  return (
    <PageWrapper>
      <div className="space-y-4">
        <button
          onClick={() => navigate('/mfcistas')}
          className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para MFCistas
        </button>

        <SectionTitle
          title={isEditing ? 'Editar MFCista' : 'Novo MFCista'}
          description={isEditing ? 'Atualize os dados cadastrais do membro.' : 'Preencha os dados para cadastrar um novo membro.'}
          icon={UserPlus}
        />

        <ContentCard padding="md">
          <MemberForm
            isEditing={isEditing}
            teams={teams}
            initialData={initialData}
            onCancel={handleCancel}
            onSave={handleSave}
          />
        </ContentCard>
      </div>
    </PageWrapper>
  );
};

export default MemberFormPage;
