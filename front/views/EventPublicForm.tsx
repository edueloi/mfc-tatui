import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Loader2, MapPin, Clock, Ticket, Ban } from 'lucide-react';
import { api, photoSrc } from '../api';
import toast from 'react-hot-toast';
import { Button, ContentCard, EmptyState, Input } from '../components/ui';
import { BridalCoupleForm } from '../components/BridalCoupleForm';
import { dateLabel } from '../utils/dates';
import { maskPhone, unmask } from '../utils/masks';
import { money } from '../utils/events';
import coupleIllustration from '../../images/casal-noivo-noiva.png';

interface PublicEvent {
  name: string; date: string; endDate: string; startTime: string; endTime: string; location: string; description: string; imageUrl: string;
  kind: string; bridal?: boolean; hasFee: boolean; ticketValue: number; registrationDeadline: string; spotsLeft: number | null; open: boolean; closedReason: string; past: boolean;
}

/** Página pública de inscrição (sem login): evento externo, aberta por link. */
const EventPublicForm: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', guests: '0', notes: '' });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState<{ name: string; amountDue: number } | null>(null);
  const [problem, setProblem] = useState('');
  const [coupleSent, setCoupleSent] = useState<{ token: string; pixKey: string; noivoName: string; noivaName: string } | null>(null);
  const [savingCouple, setSavingCouple] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    api.getPublicEvent(token).then(setEvent).catch(() => setNotFound(true)).finally(() => setLoading(false));
  }, [token]);

  const guests = Math.min(10, Math.max(0, parseInt(form.guests, 10) || 0));
  const errors = {
    name: form.name.trim().length < 3 ? 'Informe seu nome completo.' : '',
    phone: ![10, 11].includes(unmask(form.phone).length) ? 'Informe o telefone com DDD.' : '',
    email: form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? 'E-mail inválido.' : '',
    guests: event?.spotsLeft !== null && event?.spotsLeft !== undefined && 1 + guests > event.spotsLeft ? `Restam apenas ${event.spotsLeft} ${event.spotsLeft === 1 ? 'vaga' : 'vagas'}.` : '',
  };
  const err = (message: string) => touched && message ? <p role="alert" className="mt-1 text-xs text-red-600">{message}</p> : null;

  const submit = async () => {
    setTouched(true); setProblem('');
    if (Object.values(errors).some(Boolean) || !token || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const result = await api.registerPublicEvent(token, { name: form.name.trim(), phone: unmask(form.phone), email: form.email.trim(), guests, notes: form.notes.trim() });
      setSent({ name: result.name, amountDue: result.amountDue });
    } catch (error) { setProblem(error instanceof Error ? error.message : 'Não foi possível concluir a inscrição. Tente novamente.'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  /** Inscrição do casal no Encontro de Noivos: a ficha completa (noivo, noiva e endereço) vira o cadastro do casal no encontro. */
  const submitCouple = async (data: { noivo: object; noiva: object }) => {
    if (!token || savingCouple) return;
    setSavingCouple(true);
    try {
      const result = await api.registerPublicCouple(token, { noivo: data.noivo, noiva: data.noiva });
      setCoupleSent({ token: result.couplePublicToken, pixKey: result.pixKey, noivoName: result.noivoName, noivaName: result.noivaName });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a inscrição. Tente novamente.'); }
    finally { setSavingCouple(false); }
  };

  const shell = (children: React.ReactNode, wide = false) => <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10"><div className={`mx-auto w-full space-y-4 ${wide ? 'max-w-xl lg:max-w-4xl' : 'max-w-xl'}`}>{children}</div></main>;

  if (loading) return shell(<div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando…</div>);
  if (notFound || !event) return shell(<ContentCard><EmptyState icon={Ticket} title="Evento não encontrado" description="Confira o link recebido ou fale com quem convidou você." /></ContentCard>);

  return shell(<>
    <ContentCard padding="none" className="overflow-hidden">
      {event.bridal ? <div className="relative h-44 overflow-hidden bg-gradient-to-br from-rose-100 via-rose-50 to-amber-50">
        <div className="absolute inset-y-0 left-0 flex w-3/5 flex-col justify-center p-5"><p className="text-xs font-bold uppercase tracking-wider text-rose-600">MFC</p><p className="mt-1 text-base font-bold leading-tight text-rose-950">Encontro de Noivos</p><p className="mt-1 text-xs leading-relaxed text-rose-700">Um passo especial na preparação para o matrimônio.</p></div>
        <img src={coupleIllustration} alt="Ilustração de noivo e noiva" className="absolute bottom-0 right-1 h-48 w-2/5 object-contain object-bottom" />
      </div> : event.imageUrl && <img src={photoSrc(event.imageUrl)} alt={`Imagem do evento ${event.name}`} className="h-44 w-full object-cover" />}
      <div className="p-4">
        <p className="text-xs font-medium text-blue-700">{event.bridal ? 'Ficha externa · Encontro de Noivos' : 'MFC · Movimento Familiar Cristão'}</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900 break-words">{event.name}</h1>
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          <li className="flex items-center gap-1.5"><CalendarDays size={13} className="text-slate-400" />{dateLabel(event.date)}{event.endDate && event.endDate !== event.date ? ` a ${dateLabel(event.endDate)}` : ''}</li>
          {(event.startTime || event.endTime) && <li className="flex items-center gap-1.5"><Clock size={13} className="text-slate-400" />{[event.startTime, event.endTime].filter(Boolean).join(' às ')}</li>}
          {event.location && <li className="flex items-center gap-1.5 break-words"><MapPin size={13} className="shrink-0 text-slate-400" />{event.location}</li>}
          <li className="flex items-center gap-1.5"><Ticket size={13} className="text-slate-400" />{event.bridal ? 'Inscrição do casal (noivo e noiva)' : event.hasFee && event.ticketValue > 0 ? `${money(event.ticketValue)} por pessoa` : 'Participação sem taxa'}</li>
        </ul>
        {event.description && <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-slate-700">{event.description}</p>}
      </div>
    </ContentCard>

    {event.bridal && coupleSent ? <ContentCard padding="md"><div className="flex flex-col items-center gap-2 py-4 text-center">
      <CheckCircle2 size={36} className="text-emerald-600" />
      <h2 className="text-base font-semibold text-slate-900">Inscrição enviada!</h2>
      <p className="text-sm text-slate-600">{coupleSent.noivoName} e {coupleSent.noivaName}, recebemos os dados de vocês. A organização do encontro entra em contato para combinar o pagamento.</p>
      {coupleSent.pixKey && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">Chave Pix do encontro: <strong className="break-all">{coupleSent.pixKey}</strong></p>}
      <a href={`/noivos/form/${coupleSent.token}`} className="text-xs font-medium text-blue-700 underline">Enviar documentos ou corrigir os dados</a>
    </div></ContentCard>
      : event.bridal && event.open ? <ContentCard padding="md"><div className="space-y-3">
        <div><h2 className="text-sm font-semibold text-slate-900">Ficha de inscrição do casal</h2><p className="mt-0.5 text-xs text-slate-500">Preencham os dados do noivo e da noiva. Leva poucos minutos.</p></div>
        <BridalCoupleForm mode="public" hideDocuments saving={savingCouple} onSave={submitCouple} />
      </div></ContentCard>
      : sent ? <ContentCard padding="md"><div className="flex flex-col items-center gap-2 py-4 text-center">
      <CheckCircle2 size={36} className="text-emerald-600" />
      <h2 className="text-base font-semibold text-slate-900">Inscrição recebida, {sent.name.split(' ')[0]}!</h2>
      <p className="text-sm text-slate-600">{sent.amountDue > 0 ? `O valor de ${money(sent.amountDue)} é combinado com a organização do evento.` : 'Não há taxa para este evento.'} Qualquer dúvida, fale com quem convidou você.</p>
    </div></ContentCard>
      : !event.open ? <ContentCard padding="md"><div className="flex items-start gap-3"><Ban size={20} className="mt-0.5 shrink-0 text-slate-400" /><div><h2 className="text-sm font-semibold text-slate-900">Inscrições encerradas</h2><p className="mt-1 text-xs text-slate-600">{event.closedReason || 'Este evento não aceita novas inscrições.'}</p></div></div></ContentCard>
      : <ContentCard padding="md"><div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2"><h2 className="text-sm font-semibold text-slate-900">Faça sua inscrição</h2>{event.spotsLeft !== null && <span className="text-xs text-slate-500">{event.spotsLeft} {event.spotsLeft === 1 ? 'vaga restante' : 'vagas restantes'}</span>}</div>
        <div><Input label="Nome completo" autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />{err(errors.name)}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><Input label="Telefone (WhatsApp)" inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" value={form.phone} onChange={e => setForm({ ...form, phone: maskPhone(e.target.value) })} />{err(errors.phone)}</div>
          <div><Input label="E-mail (opcional)" type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />{err(errors.email)}</div>
        </div>
        <div><Input label="Acompanhantes" type="number" min={0} max={10} value={form.guests} onChange={e => setForm({ ...form, guests: e.target.value })} hint={event.hasFee && event.ticketValue > 0 ? `Total: ${money(event.ticketValue * (1 + guests))}` : undefined} />{err(errors.guests)}</div>
        <Input label="Observações (opcional)" placeholder="Alergias, restrições, dúvidas…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        {problem && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{problem}</p>}
        <Button fullWidth loading={saving} onClick={submit}>Confirmar inscrição</Button>
      </div></ContentCard>}
  </>, !!event.bridal);
};

export default EventPublicForm;
