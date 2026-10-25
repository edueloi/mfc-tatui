import type { NucleationGroup } from '../types';

export type GroupStatus = 'Agendada' | 'Realizada' | 'Sem data';

/** Hoje no horário local, no formato AAAA-MM-DD (para comparar com a data do encontro). */
export const todayIso = () => new Date().toLocaleDateString('sv-SE');

/** Realizada = data anterior a hoje. Hoje e datas futuras contam como agendadas. */
export const groupStatus = (group: Pick<NucleationGroup, 'eventDate'>): GroupStatus =>
  !group.eventDate ? 'Sem data' : group.eventDate < todayIso() ? 'Realizada' : 'Agendada';

export const GROUP_STATUS_COLOR: Record<GroupStatus, 'info' | 'success' | 'default'> = { Agendada: 'info', Realizada: 'success', 'Sem data': 'default' };

/** "Sábado, 21/11/2026 · 19:30" (partes ausentes são omitidas). */
export const groupWhen = (group: Pick<NucleationGroup, 'eventDate' | 'eventTime'>) => {
  const match = (group.eventDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match ? `${match[3]}/${match[2]}/${match[1]}` : '';
  return [date, group.eventTime].filter(Boolean).join(' · ');
};

/** Próximas primeiro (da mais perto para a mais longe); realizadas da mais recente para a mais antiga. */
export const splitGroups = (groups: NucleationGroup[]) => {
  const upcoming = groups.filter(group => groupStatus(group) !== 'Realizada')
    .sort((a, b) => (a.eventDate || '9999').localeCompare(b.eventDate || '9999') || a.name.localeCompare(b.name, 'pt-BR'));
  const done = groups.filter(group => groupStatus(group) === 'Realizada')
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || a.name.localeCompare(b.name, 'pt-BR'));
  return { upcoming, done };
};
