import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, ExternalLink, Link as LinkIcon, LockKeyhole, Send } from 'lucide-react';
import { BridalMeeting, Event } from '../types';
import { Button, Input, Modal, ModalFooter } from './ui';
import { inviteMessage, publicEventLink } from '../utils/events';
import { whatsappUrl } from '../utils/whatsapp';
import coupleIllustration from '../../images/casal-noivo-noiva.png';

interface BridalMeetingInviteModalProps {
  isOpen: boolean;
  meeting: BridalMeeting | null;
  event: Event | null;
  onClose: () => void;
}

const copy = async (value: string, success: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(success);
  } catch {
    toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.');
  }
};

/** Link e mensagem para o casal preencher a ficha pública de um encontro. */
export const BridalMeetingInviteModal: React.FC<BridalMeetingInviteModalProps> = ({ isOpen, meeting, event, onClose }) => {
  const link = event?.publicToken ? publicEventLink(event.publicToken) : '';
  const internalLink = meeting ? `${window.location.origin}/encontro-noivos/encontro/${meeting.id}` : '';
  const defaultMessage = useMemo(() => event && link ? inviteMessage(event, link) : '', [event, link]);
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setMessage(defaultMessage);
    setPhone('');
  }, [isOpen, defaultMessage]);

  const whatsapp = whatsappUrl(phone, message);

  return <Modal isOpen={isOpen} onClose={onClose} title={`Convidar casal · ${meeting?.name || ''}`} size="lg" footer={
    <ModalFooter><Button size="sm" onClick={onClose}>Fechar</Button></ModalFooter>
  }>
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-rose-100 bg-gradient-to-r from-rose-50 via-white to-amber-50 px-4 py-3 pr-28 sm:pr-36">
        <img src={coupleIllustration} alt="Noivo e noiva" className="absolute bottom-0 right-2 h-28 w-28 object-contain object-bottom sm:right-4 sm:h-36 sm:w-36" />
        <p className="text-sm font-semibold text-rose-900">Convite para o Encontro de Noivos</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">Envie o link externo para o casal preencher a ficha. Os dados entram diretamente neste encontro.</p>
      </div>

      <div>
        <div className="mb-1 flex items-center gap-1.5"><ExternalLink size={13} className="text-emerald-600" /><label className="ds-label">Link externo · preenchimento do casal</label></div>
        <div className="flex gap-2">
          <Input aria-label="Link de preenchimento da ficha" readOnly value={link} wrapperClassName="flex-1" iconLeft={<LinkIcon size={14} />} onFocus={input => input.currentTarget.select()} />
          <Button variant="outline" size="sm" iconLeft={<Copy size={14} />} disabled={!link} onClick={() => copy(link, 'Link copiado.')}>Copiar</Button>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2"><p className="text-xs text-slate-500">Qualquer pessoa com o link pode preencher os dados do casal, sem entrar no sistema.</p><Button variant="ghost" size="xs" iconLeft={<ExternalLink size={12} />} disabled={!link} onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}>Abrir formulário</Button></div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="mb-1 flex items-center gap-1.5"><LockKeyhole size={13} className="text-slate-500" /><p className="text-xs font-semibold text-slate-800">Link interno · gestão do encontro</p></div>
        <div className="flex gap-2">
          <Input aria-label="Link interno do encontro" readOnly value={internalLink} wrapperClassName="flex-1" className="bg-slate-50" iconLeft={<LinkIcon size={14} />} onFocus={input => input.currentTarget.select()} />
          <Button variant="outline" size="sm" iconLeft={<Copy size={14} />} disabled={!internalLink} onClick={() => copy(internalLink, 'Link interno copiado.')}>Copiar</Button>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">Uso da equipe organizadora. Exige login e não deve ser enviado ao casal.</p>
      </div>

      <div>
        <label htmlFor="bridal-invite-message" className="ds-label mb-1 block">Mensagem do convite</label>
        <textarea id="bridal-invite-message" value={message} onChange={input => setMessage(input.target.value)} rows={5}
          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-[13px] leading-relaxed text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10" />
        <div className="mt-1.5 flex flex-wrap gap-2">
          <Button variant="outline" size="xs" iconLeft={<Copy size={12} />} disabled={!message} onClick={() => copy(message, 'Mensagem copiada.')}>Copiar mensagem</Button>
          <Button variant="ghost" size="xs" onClick={() => setMessage(defaultMessage)}>Restaurar texto padrão</Button>
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-3">
        <p className="text-xs font-semibold text-slate-800">Enviar para uma pessoa pelo WhatsApp</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input aria-label="Telefone do destinatário" value={phone} onChange={input => setPhone(input.target.value)} placeholder="(00) 00000-0000" inputMode="tel" wrapperClassName="flex-1" />
          <Button variant="success" iconLeft={<Send size={14} />} disabled={!whatsapp || !message} onClick={() => window.open(whatsapp, '_blank', 'noopener,noreferrer')}>Enviar convite</Button>
        </div>
        <p className="text-[11px] text-slate-500">Informe o telefone com DDD. O WhatsApp abrirá com a mensagem e o link prontos para enviar.</p>
      </div>
    </div>
  </Modal>;
};
