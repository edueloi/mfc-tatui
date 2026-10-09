import React from 'react';
import { Eye, Layers, Pencil, Trash2 } from 'lucide-react';
import { Member, MemberStatus } from '../types';
import { Badge, Button, IconButton } from './ui';
import type { Column } from './ui';

interface DirectoryActions {
  open: (member: Member) => void;
  edit: (member: Member) => void;
  remove: (member: Member) => void;
  team: (member: Member) => void;
  teamName: (member: Member) => string;
}
function years(value: string) {
  if (!value) return 'Não informado';
  const date = new Date(value.slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(date.getTime())) return 'Não informado';
  const today = new Date();
  const age = today.getFullYear() - date.getFullYear() - Number(today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate()));
  return age < 0 ? 'Não informado' : `${age} ${age === 1 ? 'ano' : 'anos'}`;
}
function Status({ member }: { member: Member }) {
  return <Badge dot color={member.status === MemberStatus.ATIVO ? 'success' : member.status === MemberStatus.AGUARDANDO ? 'warning' : 'default'}>{member.status}</Badge>;
}
function Identity({ member, open }: { member: Member; open: DirectoryActions['open'] }) {
  const initials = member.name.trim().split(/\s+/).filter(Boolean).map(part => part[0]).filter((_, i, all) => i === 0 || i === all.length - 1).join('').toLocaleUpperCase('pt-BR');
  return <button type="button" className="member-identity" onClick={event => { event.stopPropagation(); open(member); }} aria-label={`Abrir perfil de ${member.name}`}>
    <span className="member-avatar" aria-hidden="true">{initials || '—'}</span>
    <span className="min-w-0"><span className="member-name">{member.name}</span><span className="member-phone">{member.phone || 'Telefone não informado'}</span></span>
  </button>;
}
function Actions({ member, actions, mobile = false }: { member: Member; actions: DirectoryActions; mobile?: boolean }) {
  return <div className="member-row-actions" onClick={event => event.stopPropagation()}>
    {mobile && <Button size="sm" variant="outline" iconLeft={<Eye size={14} />} onClick={() => actions.open(member)}>Ver perfil</Button>}
    {member.teamId && <IconButton size="sm" title="Gerenciar equipe" aria-label={`Gerenciar equipe de ${member.name}`} onClick={() => actions.team(member)}><Layers size={15} /></IconButton>}
    <IconButton size="sm" title="Editar MFCista" aria-label={`Editar ${member.name}`} onClick={() => actions.edit(member)}><Pencil size={15} /></IconButton>
    <IconButton size="sm" title="Excluir MFCista" aria-label={`Excluir ${member.name}`} onClick={() => actions.remove(member)}><Trash2 size={15} className="text-red-500" /></IconButton>
  </div>;
}
export function memberDirectoryColumns(actions: DirectoryActions): Column<Member>[] {
  return [
    { header: 'MFCista', className: 'member-name-cell', render: member => <Identity member={member} open={actions.open} /> },
    { header: 'Profissão', className: 'member-detail-cell', render: member => member.profession?.trim() || <span className="text-slate-400">Não informada</span> },
    { header: 'Equipe', className: 'member-detail-cell', render: member => actions.teamName(member) },
    { header: 'Tempo no MFC', render: member => <span className="whitespace-nowrap tabular-nums">{years(member.mfcDate)}</span> },
    { header: 'Idade', render: member => <span className="whitespace-nowrap tabular-nums">{years(member.dob)}</span> },
    { header: 'Status', render: member => <Status member={member} /> },
    { header: 'Ações', className: 'w-28', render: member => <Actions member={member} actions={actions} /> },
  ];
}
export function MemberDirectoryCard({ member, actions }: { member: Member; actions: DirectoryActions }) {
  return <div className="member-mobile-card">
    <div className="member-mobile-heading"><Identity member={member} open={actions.open} /><Status member={member} /></div>
    <dl className="member-mobile-details">
      {[['Equipe', actions.teamName(member)], ['Profissão', member.profession?.trim() || 'Não informada'], ['Tempo no MFC', years(member.mfcDate)], ['Idade', years(member.dob)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    <Actions member={member} actions={actions} mobile />
  </div>;
}
