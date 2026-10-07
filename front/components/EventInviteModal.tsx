import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Link as LinkIcon, MessageCircle } from 'lucide-react';
import { BaseTeam, Event, Member } from '../types';
import { Button, EmptyState, Input, Modal, ModalFooter, Select } from './ui';
import { eventPath, inviteMessage, internalEventLink, publicEventLink } from '../utils/events';
import { maskPhone } from '../utils/masks';
import { matchesDirectorySearch } from '../utils/memberDirectory';
import { whatsappUrl } from '../utils/whatsapp';

interface EventInviteModalProps {
  isOpen: boolean;
  event: Event;
  events: Event[];
  teams: BaseTeam[];
  members: Member[];
  scopeTeamId: string | null;
  onClose: () => void;
}

const copy = async (text: string, done: string) => {
  try { await navigator.clipboard.writeText(text); toast.success(done); }
  catch { toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.'); }
};

/** Convite: link de inscrição (público no evento externo, dentro do sistema no interno) e mensagem pronta para WhatsApp. */
export const EventInviteModal: React.FC<EventInviteModalProps> = ({ isOpen, event, events, teams, members, scopeTeamId, onClose }) => {
  const external = event.kind === 'externo';
  const link = external && event.publicToken ? publicEventLink(event.publicToken) : internalEventLink(eventPath(event, events));
  const [teamId, setTeamId] = useState('');
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const availableTeams = scopeTeamId ? teams.filter(team => team.id === scopeTeamId) : teams;

  useEffect(() => {
    if (!isOpen) return;
    setSearch(''); setText(inviteMessage(event, link));
    setTeamId(scopeTeamId && teams.some(team => team.id === scopeTeamId) ? scopeTeamId : teams[0]?.id || '');
  }, [isOpen, event.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const candidates = useMemo(() => members.filter(member => member.teamId === teamId && member.status !== 'Inativo' && matchesDirectorySearch(member, search)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [members, teamId, search]);
  // O texto editado vale para todos; "Olá, Nome!" só entra na mensagem pessoal.
  const personal = (member: Member) => text.replace(/^Olá! /, `Olá, ${(member.nickname || member.name).trim().split(/\s+/)[0]}! `);

  return <Modal isOpen={isOpen} onClose={onClose} title={`Convidar · ${event.name}`} size="lg" footer={<ModalFooter><Button size="sm" onClick={onClose}>Fechar</Button></ModalFooter>}>
    <div className="space-y-4">
      <div>
        <label className="ds-label mb-1 block">{external ? 'Link público de inscrição' : 'Link do evento (exige login no sistema)'}</label>
        <div className="flex gap-2">
          <Input aria-label="Link do evento" readOnly value={link} wrapperClassName="flex-1" iconLeft={<LinkIcon size={14} />} onFocus={event => event.currentTarget.select()} />
          <Button variant="outline" size="sm" iconLeft={<Copy size={14} />} onClick={() => copy(link, 'Link copiado.')}>Copiar</Button>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">{external ? 'Qualquer pessoa com o link se inscreve, sem precisar de login. Respeita prazo e vagas.' : 'Evento interno: só quem tem acesso ao sistema abre o link. Convidados de fora precisam de um evento externo.'}</p>
      </div>

      <div>
        <label htmlFor="invite-text" className="ds-label mb-1 block">Mensagem</label>
        <textarea id="invite-text" value={text} onChange={event => setText(event.target.value)} rows={4}
          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-[13px] leading-relaxed text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10" />
        <div className="mt-1.5 flex flex-wrap gap-2">
          <Button variant="outline" size="xs" iconLeft={<Copy size={12} />} onClick={() => copy(text, 'Mensagem copiada.')}>Copiar mensagem</Button>
          <Button variant="ghost" size="xs" onClick={() => setText(inviteMessage(event, link))}>Restaurar texto padrão</Button>
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-3">
        <p className="text-xs font-semibold text-slate-800">Enviar para membros pelo WhatsApp</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select aria-label="Equipe" value={teamId} disabled={!!scopeTeamId} onChange={event => setTeamId(event.target.value)} options={availableTeams.map(team => ({ value: team.id, label: team.name }))} placeholder="Equipe" />
          <Input aria-label="Buscar membro" placeholder="Buscar membro…" value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        {candidates.length ? <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {candidates.map(member => { const url = whatsappUrl(member.phone, personal(member)); return <li key={member.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="min-w-0"><span className="block text-[13px] text-slate-800 break-words">{member.name}</span><span className="block text-xs text-slate-500">{member.phone ? maskPhone(member.phone) : 'Telefone não informado'}</span></span>
            <Button size="xs" variant="success" disabled={!url} title={url ? 'Abrir o WhatsApp com o convite' : 'Telefone não informado ou incompleto'} iconLeft={<MessageCircle size={12} />} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>Convidar</Button>
          </li>; })}
        </ul> : <EmptyState icon={MessageCircle} title="Nenhum membro encontrado" description="Escolha uma equipe ou ajuste a busca." />}
      </div>
    </div>
  </Modal>;
};
