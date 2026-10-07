import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { BaseTeam, Event, EventSale, Member } from '../types';
import { Button, DatePicker, Input, Modal, ModalFooter, Select } from './ui';
import { money } from '../utils/events';
import { localDateToday } from '../utils/paymentAccounting';

interface EventSaleModalProps {
  isOpen: boolean;
  event: Event;
  teams: BaseTeam[];
  members: Member[];
  /** Equipe a que o usuário está limitado; null deixa escolher qualquer uma. */
  scopeTeamId: string | null;
  onClose: () => void;
  onSaved: (sales: EventSale[]) => void;
}

/** Venda de ingresso feita por um membro de uma equipe. Só existe para evento com taxa. */
export const EventSaleModal: React.FC<EventSaleModalProps> = ({ isOpen, event, teams, members, scopeTeamId, onClose, onSaved }) => {
  const [teamId, setTeamId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [buyer, setBuyer] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [date, setDate] = useState(localDateToday());
  const [status, setStatus] = useState<'Pago' | 'Pendente'>('Pago');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const availableTeams = scopeTeamId ? teams.filter(team => team.id === scopeTeamId) : teams;
  const teamMembers = useMemo(() => members.filter(member => member.teamId === teamId).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [members, teamId]);
  const unit = Number(event.ticketValue) || 0;

  useEffect(() => {
    if (!isOpen) return;
    setTouched(false); setBuyer(''); setQuantity('1'); setStatus('Pago'); setDate(localDateToday());
    setTeamId(scopeTeamId && teams.some(team => team.id === scopeTeamId) ? scopeTeamId : teams[0]?.id || '');
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!teamMembers.some(member => member.id === memberId)) setMemberId(teamMembers[0]?.id || ''); }, [teamMembers]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = parseInt(quantity, 10);
  const errors = {
    team: !teamId ? 'Escolha a equipe.' : '',
    member: !memberId ? 'A equipe precisa ter ao menos um membro para ser o vendedor.' : '',
    quantity: !(count >= 1 && count <= 100) ? 'Informe de 1 a 100 ingressos.' : '',
    date: !date || date > localDateToday() ? 'A data da venda não pode ser futura.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);
  const err = (message: string) => touched && message ? <p role="alert" className="mt-1 text-xs text-red-600">{message}</p> : null;

  const save = async () => {
    setTouched(true);
    if (invalid || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    const requests = Array.from({ length: count }, () => ({ eventId: event.id, teamId, memberId, buyerName: buyer.trim() || 'Ingresso avulso', amount: unit, status, date }));
    const results = await Promise.allSettled(requests.map(request => api.createEventSale(request)));
    const created = results.flatMap(result => result.status === 'fulfilled' ? [result.value as EventSale] : []);
    const failed = results.length - created.length;
    if (created.length) onSaved(created);
    if (!failed) { toast.success(`${created.length === 1 ? 'Venda registrada' : `${created.length} vendas registradas`}: ${money(unit * created.length)}.`); onClose(); }
    else toast.error(`${failed} de ${results.length} vendas falharam. Confira o que foi registrado e tente de novo.`);
    savingRef.current = false; setSaving(false);
  };

  const close = () => { if (!saving) onClose(); };

  return <Modal isOpen={isOpen} onClose={close} title={`Registrar venda · ${event.name}`} size="md"
    footer={<ModalFooter><Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancelar</Button><Button size="sm" variant="success" loading={saving} onClick={save}>{count > 0 ? `Registrar ${money(unit * (count || 0))}` : 'Registrar venda'}</Button></ModalFooter>}>
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><Select label="Equipe do vendedor" value={teamId} disabled={!!scopeTeamId} onChange={event => setTeamId(event.target.value)} options={availableTeams.map(team => ({ value: team.id, label: team.name }))} placeholder="Selecione" />{err(errors.team)}</div>
        <div><Select label="Vendedor" value={memberId} onChange={event => setMemberId(event.target.value)} options={teamMembers.map(member => ({ value: member.id, label: member.name }))} placeholder="Selecione" />{err(errors.member)}</div>
      </div>
      <Input label="Comprador" placeholder="Opcional. Deixe vazio para ingresso avulso" value={buyer} onChange={event => setBuyer(event.target.value)} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div><Input label="Ingressos" type="number" min={1} max={100} value={quantity} onChange={event => setQuantity(event.target.value)} />{err(errors.quantity)}</div>
        <div><DatePicker label="Data da venda" value={date} onChange={value => setDate(value || '')} />{err(errors.date)}</div>
        <Select label="Pagamento" value={status} onChange={event => setStatus(event.target.value as 'Pago' | 'Pendente')} options={[{ value: 'Pago', label: 'Pago' }, { value: 'Pendente', label: 'Pendente' }]} />
      </div>
      <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600" aria-live="polite">Cada ingresso custa {money(unit)}. {status === 'Pago' ? 'O valor entra na arrecadação do evento e na meta da equipe.' : 'Fica pendente e só conta na arrecadação quando for pago.'}</p>
    </div>
  </Modal>;
};
