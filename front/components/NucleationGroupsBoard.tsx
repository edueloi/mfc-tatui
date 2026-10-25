import React from 'react';
import { CalendarDays, FileDown, MapPin, Printer, UserRound, UsersRound, Wand2, Plus, ArrowRight } from 'lucide-react';
import { NucleationGroup } from '../types';
import { Badge, Button, ContentCard, EmptyState } from './ui';
import { GROUP_STATUS_COLOR, groupStatus, groupWhen, splitGroups } from '../utils/nucleationGroups';

interface Props {
  groups: NucleationGroup[];
  canCreate: boolean;
  onOpen: (group: NucleationGroup) => void;
  onNew: () => void;
  onGenerate: () => void;
  onAttendance: (group: NucleationGroup, mode: 'download' | 'print') => void;
}

const GroupCard: React.FC<{ group: NucleationGroup; onOpen: Props['onOpen']; onAttendance: Props['onAttendance'] }> = ({ group, onOpen, onAttendance }) => {
  const status = groupStatus(group);
  const when = groupWhen(group);
  return <article className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md">
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">{group.name}</h3>
        <Badge size="sm" color={GROUP_STATUS_COLOR[status]}>{status}</Badge>
      </div>
      {group.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{group.description}</p>}
      <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
        <li className="flex items-center gap-2"><CalendarDays size={13} className="shrink-0 text-slate-400" />{when || <span className="text-slate-400">Data a definir</span>}</li>
        {group.location && <li className="flex items-start gap-2"><MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" /><span className="[overflow-wrap:anywhere]">{group.location}</span></li>}
        {group.leader && <li className="flex items-start gap-2"><UserRound size={13} className="mt-0.5 shrink-0 text-slate-400" /><span className="[overflow-wrap:anywhere]">{group.leader}</span></li>}
        <li className="flex items-center gap-2 font-medium text-slate-800"><UsersRound size={13} className="shrink-0 text-slate-400" />{group.contactsCount || 0} {(group.contactsCount || 0) === 1 ? 'contato' : 'contatos'}</li>
      </ul>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
      <Button size="xs" iconRight={<ArrowRight size={12} />} onClick={() => onOpen(group)}>Ver pessoas</Button>
      <Button variant="outline" size="xs" iconLeft={<FileDown size={12} />} onClick={() => onAttendance(group, 'download')}>PDF</Button>
      <Button variant="outline" size="xs" iconLeft={<Printer size={12} />} onClick={() => onAttendance(group, 'print')}>Imprimir</Button>
    </div>
  </article>;
};

const Section: React.FC<{ title: string; hint: string; items: NucleationGroup[]; onOpen: Props['onOpen']; onAttendance: Props['onAttendance'] }> = ({ title, hint, items, onOpen, onAttendance }) =>
  <section className="space-y-3">
    <div className="flex flex-wrap items-baseline gap-2"><h2 className="text-sm font-semibold text-slate-900">{title}</h2><span className="text-xs text-slate-500">{items.length} · {hint}</span></div>
    {items.length
      ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map(group => <GroupCard key={group.id} group={group} onOpen={onOpen} onAttendance={onAttendance} />)}</div>
      : <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500">Nenhuma nucleação aqui por enquanto.</p>}
  </section>;

export const NucleationGroupsBoard: React.FC<Props> = ({ groups, canCreate, onOpen, onNew, onGenerate, onAttendance }) => {
  if (!groups.length) return <ContentCard><EmptyState icon={UsersRound} title="Nenhum grupo de nucleação ainda"
    description="Crie um grupo com data e local, ou gere vários de uma vez para distribuir as pessoas que estão na Nucleação."
    action={canCreate ? <div className="flex flex-wrap justify-center gap-2"><Button size="sm" iconLeft={<Plus size={14} />} onClick={onNew}>Novo grupo</Button><Button variant="outline" size="sm" iconLeft={<Wand2 size={14} />} onClick={onGenerate}>Gerar grupos</Button></div> : undefined} /></ContentCard>;
  const { upcoming, done } = splitGroups(groups);
  return <div className="space-y-6">
    <Section title="Próximas nucleações" hint="agendadas ou sem data" items={upcoming} onOpen={onOpen} onAttendance={onAttendance} />
    <Section title="Nucleações realizadas" hint="da mais recente para a mais antiga" items={done} onOpen={onOpen} onAttendance={onAttendance} />
  </div>;
};
