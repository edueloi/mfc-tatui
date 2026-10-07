import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Heart, CheckCircle2, AlertCircle, Calendar, Clock, MapPin, Wallet } from 'lucide-react';
import { api } from '../api';
import { BridalCouple, BridalMeeting } from '../types';
import { BridalCoupleForm, BridalCoupleFormData } from '../components/BridalCoupleForm';

type Status = 'loading' | 'ready' | 'not-found' | 'submitted';

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function formatMeetingDate(dateStr: string) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return `${WEEKDAYS[d.getDay()]}, ${day} de ${MONTHS[month - 1]} de ${year}`;
}

const BridalPublicForm: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [couple, setCouple] = useState<BridalCouple | null>(null);
  const [meeting, setMeeting] = useState<BridalMeeting | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('not-found');
      return;
    }
    api.getBridalCoupleByToken(token)
      .then((data: BridalCouple) => {
        setCouple(data);
        setStatus('ready');
        if (data.eventId) {
          api.getBridalMeeting(data.eventId).then(setMeeting).catch(() => setMeeting(null));
        }
      })
      .catch(() => setStatus('not-found'));
  }, [token]);

  const handleSave = async (data: BridalCoupleFormData) => {
    if (!token) return;
    setSaving(true);
    try {
      await api.updateBridalCoupleByToken(token, { ...data, status: 'Aguardando Pagamento' });
      setStatus('submitted');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar inscrição. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const noivoName = couple?.partners?.find(p => p.role === 'noivo')?.name || '';
  const noivaName = couple?.partners?.find(p => p.role === 'noiva')?.name || '';

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-rose-50 via-amber-50 to-rose-100 flex flex-col items-center py-10 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg p-2">
          <img src="/imgs/mfc_logo01.png" alt="MFC" className="w-full h-full object-contain" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-rose-900 tracking-tight leading-none">Encontro de Noivos</h1>
          <p className="text-xs text-rose-500 font-semibold uppercase tracking-widest mt-0.5">Movimento Familiar Cristão</p>
        </div>
      </div>

      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl p-6 sm:p-10">
        {status === 'loading' && (
          <p className="text-center text-sm text-zinc-400 py-10">Carregando ficha...</p>
        )}

        {status === 'not-found' && (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">Ficha não encontrada</h2>
            <p className="text-sm text-zinc-500">Esse link não é válido ou expirou. Entre em contato com a equipe organizadora do Encontro de Noivos.</p>
          </div>
        )}

        {status === 'ready' && couple && (
          <>
            {/* Texto institucional */}
            <div className="mb-8 pb-8 border-b border-zinc-100">
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Heart className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900">Preparação próxima para o casamento</h2>
              </div>

              <p className="text-sm text-zinc-600 leading-relaxed mb-6">
                Objetivo de preparação ao matrimônio é de proporcionar aos noivos um aprofundamento na compreensão e
                vivência e AMOR, bem como de sua celebração sacramental, conscientizá-los mais ainda a respeito das
                próprias responsabilidades.
              </p>

              {noivoName && noivaName && (
                <div className="flex items-center justify-center gap-6 mb-6 text-sm font-semibold text-rose-700">
                  <span>○ Ele: {noivoName}</span>
                  <span>○ Ela: {noivaName}</span>
                </div>
              )}

              {meeting ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-700 text-sm font-semibold">
                    <Calendar className="w-4 h-4 shrink-0" /> {formatMeetingDate(meeting.date)}
                  </div>
                  {(meeting.startTime || meeting.endTime) && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-700 text-sm font-semibold">
                      <Clock className="w-4 h-4 shrink-0" /> Início {meeting.startTime} — Término previsto {meeting.endTime}
                    </div>
                  )}
                  {meeting.location && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-700 text-sm font-semibold">
                      <MapPin className="w-4 h-4 shrink-0" /> {meeting.location}
                    </div>
                  )}
                  {meeting.pixKey && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-700 text-sm font-semibold">
                      <Wallet className="w-4 h-4 shrink-0" /> Pix: {meeting.pixKey}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-xs text-amber-600 font-semibold uppercase tracking-widest">
                  Data e local do encontro ainda serão definidos pela coordenação.
                </p>
              )}
            </div>

            <div className="text-center mb-8">
              <h3 className="text-lg font-bold text-zinc-900">Ficha de Inscrição</h3>
              <p className="text-sm text-zinc-500 mt-1">Preencham os dados de vocês dois com atenção. Podem revisar antes de enviar.</p>
            </div>
            <BridalCoupleForm
              mode="public"
              initialData={{
                noivo: couple.partners?.find(p => p.role === 'noivo'),
                noiva: couple.partners?.find(p => p.role === 'noiva'),
              }}
              onSave={handleSave}
              saving={saving}
            />
          </>
        )}

        {status === 'submitted' && (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">Recebemos sua inscrição!</h2>
            <p className="text-sm text-zinc-500 max-w-md mx-auto">
              Em breve nossa equipe entrará em contato para confirmar os detalhes do pagamento e do encontro.
              Qualquer dúvida, procure a coordenação do MFC da sua cidade.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BridalPublicForm;
