import type { BridalCouple, BridalMeeting } from '../types';
import { entitySlug, findBySlug } from './entitySlug';

export const SEM_ENCONTRO = 'sem-encontro';
export const BRIDAL_BASE = '/encontro-noivos';

const meetingBases = (meeting: BridalMeeting) => [meeting.name, `${meeting.name} ${meeting.date}`];
const coupleBases = (couple: Pick<BridalCouple, 'id' | 'noivoName' | 'noivaName'>) => [`${couple.noivoName || 'noivo'} e ${couple.noivaName || 'noiva'}`];

/** "sem-encontro" é reservado para a lista de casais sem turma. */
export const meetingSlug = (meeting: BridalMeeting, meetings: BridalMeeting[]) => {
  const slug = entitySlug(meeting, meetings, meetingBases);
  return slug === SEM_ENCONTRO ? `${slug}-turma` : slug;
};
export const findMeeting = (meetings: BridalMeeting[], param?: string) =>
  findBySlug(meetings, param, meetingBases, meeting => meetingSlug(meeting, meetings));
export const meetingPath = (meeting: BridalMeeting, meetings: BridalMeeting[]) => `${BRIDAL_BASE}/encontro/${meetingSlug(meeting, meetings)}`;

type CoupleLike = Pick<BridalCouple, 'id' | 'noivoName' | 'noivaName'>;
export const coupleSlug = (couple: CoupleLike, couples: CoupleLike[]) => entitySlug(couple, couples, coupleBases);
export const findCouple = <T extends CoupleLike>(couples: T[], param?: string) => findBySlug(couples, param, coupleBases);
export const couplePath = (couple: CoupleLike, couples: CoupleLike[]) => `${BRIDAL_BASE}/${coupleSlug(couple, couples)}`;
