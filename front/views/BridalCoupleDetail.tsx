import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Heart, Copy } from 'lucide-react';
import { api } from '../api';
import { BridalCouple } from '../types';
import { PageWrapper, SectionTitle, ContentCard, Button, Badge } from '../components/ui';
import { BridalCoupleForm, BridalCoupleFormData } from '../components/BridalCoupleForm';

const BridalCoupleDetail: React.FC = () => {
  const { coupleId } = useParams<{ coupleId: string }>();
  const navigate = useNavigate();
  const [couple, setCouple] = useState<BridalCouple | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCouple = () => {
    if (!coupleId) return;
    api.getBridalCouple(coupleId).then(setCouple).catch(() => {
      toast.error('Ficha não encontrada.');
      navigate('/encontro-noivos');
    });
  };

  useEffect(() => {
    loadCouple();
  }, [coupleId]);

  const handleSave = async (data: BridalCoupleFormData) => {
    if (!coupleId) return;
    setSaving(true);
    try {
      const updated = await api.updateBridalCouple(coupleId, data);
      setCouple(updated);
      toast.success('Ficha atualizada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar ficha.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDocument = async (file: File) => {
    if (!coupleId) return;
    try {
      await api.uploadBridalDocument(coupleId, file);
      loadCouple();
      toast.success('Documento anexado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao anexar documento.');
    }
  };

  const handleRemoveDocument = async (docId: string) => {
    if (!coupleId) return;
    try {
      await api.deleteBridalDocument(coupleId, docId);
      loadCouple();
      toast.success('Documento removido.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover documento.');
    }
  };

  const copyPublicLink = () => {
    if (!couple) return;
    const url = `${window.location.origin}/noivos/form/${couple.publicToken}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  if (!couple) {
    return (
      <PageWrapper>
        <p className="text-sm text-zinc-400">Carregando...</p>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="space-y-4">
        <button
          onClick={() => navigate('/encontro-noivos')}
          className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para Encontro de Noivos
        </button>

        <SectionTitle
          title={`${couple.noivoName || 'Noivo'} & ${couple.noivaName || 'Noiva'}`}
          description="Detalhes da ficha de inscrição"
          icon={Heart}
          action={
            <div className="flex items-center gap-2">
              <Badge color={couple.status === 'Confirmado' ? 'success' : 'warning'}>{couple.status}</Badge>
              <Button variant="outline" size="sm" iconLeft={<Copy className="w-3.5 h-3.5" />} onClick={copyPublicLink}>
                Copiar Link
              </Button>
            </div>
          }
        />

        <ContentCard padding="md">
          <BridalCoupleForm
            mode="internal"
            initialData={{
              status: couple.status,
              eventId: couple.eventId ?? null,
              paymentStatus: couple.paymentStatus,
              paymentAmount: couple.paymentAmount,
              paymentDate: couple.paymentDate,
              paymentMethod: couple.paymentMethod,
              paymentObservation: couple.paymentObservation,
              noivo: couple.partners?.find(p => p.role === 'noivo'),
              noiva: couple.partners?.find(p => p.role === 'noiva'),
            }}
            onSave={handleSave}
            saving={saving}
            documents={(couple.documents || []).map(d => ({ id: d.id, fileName: d.fileName }))}
            onUploadDocument={handleUploadDocument}
            onRemoveDocument={handleRemoveDocument}
          />
        </ContentCard>
      </div>
    </PageWrapper>
  );
};

export default BridalCoupleDetail;
