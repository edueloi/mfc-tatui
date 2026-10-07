import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Heart, Copy, Loader2 } from 'lucide-react';
import { api } from '../api';
import { BridalCouple, BridalMeeting } from '../types';
import { PageWrapper, ContentCard, Button, Badge, EmptyState } from '../components/ui';
import { BridalCoupleForm, BridalCoupleFormData } from '../components/BridalCoupleForm';
import { dateLabel } from '../utils/dates';
import { BRIDAL_BASE, couplePath, findCouple, meetingPath } from '../utils/bridalPaths';

const BridalCoupleDetail: React.FC = () => {
  const { coupleSlug } = useParams<{ coupleSlug: string }>();
  const navigate = useNavigate();
  const [list, setList] = useState<BridalCouple[]>([]);
  const [meetings, setMeetings] = useState<BridalMeeting[]>([]);
  const [couple, setCouple] = useState<BridalCouple | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getBridalCouples(), api.getBridalMeetings().catch(() => [])])
      .then(([couples, meetingItems]) => { if (!cancelled) { setList(couples); setMeetings(meetingItems); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);

  const target = useMemo(() => findCouple(list, coupleSlug), [list, coupleSlug]);

  useEffect(() => {
    if (!target) { setCouple(null); return; }
    let cancelled = false;
    api.getBridalCouple(target.id).then((full: BridalCouple) => { if (!cancelled) setCouple(full); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [target?.id, reload]);

  // Link por id (ou nomes antigos) passa a mostrar o nome do casal na URL.
  useEffect(() => {
    if (!target) return;
    const path = couplePath(target, list);
    if (path !== `${BRIDAL_BASE}/${coupleSlug}`) navigate({ pathname: path, search: window.location.search }, { replace: true });
  }, [target, list, coupleSlug, navigate]);

  const meeting = couple?.eventId ? meetings.find(item => item.id === couple.eventId) : undefined;
  const title = couple ? `${couple.partners?.find(partner => partner.role === 'noivo')?.name || couple.noivoName || 'Noivo'} & ${couple.partners?.find(partner => partner.role === 'noiva')?.name || couple.noivaName || 'Noiva'}` : '';
  const backToList = () => navigate(meeting ? meetingPath(meeting, meetings) : BRIDAL_BASE);

  const handleSave = async (data: BridalCoupleFormData) => {
    if (!couple) return;
    setSaving(true);
    try {
      const updated: BridalCouple = await api.updateBridalCouple(couple.id, data);
      setCouple(updated);
      // O nome faz parte da URL: atualiza a lista para o endereço acompanhar a edição.
      setList(prev => prev.map(item => item.id === updated.id ? { ...item, noivoName: data.noivo.name, noivaName: data.noiva.name, eventId: updated.eventId, status: updated.status } : item));
      toast.success('Ficha atualizada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar a ficha.');
    } finally { setSaving(false); }
  };

  const handleUploadDocument = async (file: File) => {
    if (!couple) return;
    try { await api.uploadBridalDocument(couple.id, file); setReload(value => value + 1); toast.success('Documento anexado.'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível anexar o documento.'); }
  };

  const handleRemoveDocument = async (docId: string) => {
    if (!couple) return;
    try { await api.deleteBridalDocument(couple.id, docId); setReload(value => value + 1); toast.success('Documento removido.'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível remover o documento.'); }
  };

  const copyPublicLink = async () => {
    if (!couple) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}/noivos/form/${couple.publicToken}`); toast.success('Link copiado.'); }
    catch { toast.error('Não foi possível copiar. Copie o endereço manualmente.'); }
  };

  if (loading || (target && !couple && !error)) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando ficha…</div></PageWrapper>;

  if (error || !couple) return <PageWrapper><ContentCard><EmptyState icon={Heart}
    title={error ? 'Não foi possível carregar a ficha' : 'Ficha não encontrada'}
    description={error ? 'Confira a conexão e tente novamente.' : 'A ficha pode ter sido removida ou o endereço está incorreto.'}
    action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate(BRIDAL_BASE)}>Voltar para Encontro de Noivos</Button>{error && <Button onClick={() => { setError(false); setLoading(true); setRetry(value => value + 1); setReload(value => value + 1); }}>Tentar novamente</Button>}</div>} />
  </ContentCard></PageWrapper>;

  return (
    <PageWrapper>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={backToList}>{meeting ? 'Voltar para o encontro' : 'Voltar para Encontro de Noivos'}</Button>
          <Button variant="outline" size="sm" iconLeft={<Copy size={14} />} onClick={copyPublicLink}>Copiar link do casal</Button>
        </div>

        <ContentCard padding="md">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600"><Heart size={24} /></div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 break-words">{title}</h1>
              <p className="mt-1 text-xs text-slate-500 break-words">{[meeting?.name || 'Sem encontro definido', dateLabel(couple.createdAt) && `Ficha criada em ${dateLabel(couple.createdAt)}`].filter(Boolean).join(' · ')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge dot color={couple.status === 'Confirmado' ? 'success' : couple.status === 'Cancelado' ? 'danger' : couple.status === 'Aguardando Pagamento' ? 'warning' : 'default'}>{couple.status}</Badge>
                <Badge color={couple.paymentStatus === 'Pago' ? 'success' : couple.paymentStatus === 'Parcial' ? 'purple' : couple.paymentStatus === 'Isento' ? 'info' : 'warning'}>Pagamento: {couple.paymentStatus}</Badge>
                {couple.filledExternally && <Badge color="purple">Preenchida pelo casal</Badge>}
              </div>
            </div>
          </div>
        </ContentCard>

        <ContentCard padding="md">
          <BridalCoupleForm
            mode="internal"
            layout="tabs"
            initialData={{
              status: couple.status,
              eventId: couple.eventId ?? null,
              paymentStatus: couple.paymentStatus,
              paymentAmount: couple.paymentAmount,
              paymentDate: couple.paymentDate,
              paymentMethod: couple.paymentMethod,
              paymentObservation: couple.paymentObservation,
              noivo: couple.partners?.find(partner => partner.role === 'noivo'),
              noiva: couple.partners?.find(partner => partner.role === 'noiva'),
            }}
            onSave={handleSave}
            saving={saving}
            documents={(couple.documents || []).map(doc => ({ id: doc.id, fileName: doc.fileName }))}
            onUploadDocument={handleUploadDocument}
            onRemoveDocument={handleRemoveDocument}
          />
        </ContentCard>
      </div>
    </PageWrapper>
  );
};

export default BridalCoupleDetail;
