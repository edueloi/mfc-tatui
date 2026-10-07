import type { BridalMeeting } from '../types';

/** Dias depois da data do encontro em que ele fecha sozinho. */
export const CLOSE_AFTER_DAYS = 7;

const DAY = 86_400_000;
const noon = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`);

export interface MeetingStatus {
  closed: boolean;
  /** 'manual' = encerrado por alguém; 'auto' = passou do prazo depois da data. */
  reason: 'manual' | 'auto' | null;
  /** Dia em que o encontro fecha sozinho (null se a data for inválida). */
  closesOn: Date | null;
  /** Dias que faltam para fechar sozinho (0 ou mais), quando já aconteceu e ainda está no prazo. */
  daysLeft: number | null;
  happened: boolean;
}

export function meetingStatus(meeting: Pick<BridalMeeting, 'date' | 'isActive'>, now = new Date()): MeetingStatus {
  const date = meeting.date ? noon(meeting.date) : null;
  const valid = !!date && !Number.isNaN(date.getTime());
  const closesOn = valid ? new Date(date!.getTime() + CLOSE_AFTER_DAYS * DAY) : null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const autoClosed = !!closesOn && today.getTime() > closesOn.getTime();
  const happened = valid && today.getTime() > date!.getTime();
  const closed = !meeting.isActive || autoClosed;
  return {
    closed,
    reason: !meeting.isActive ? 'manual' : autoClosed ? 'auto' : null,
    closesOn,
    daysLeft: !closed && happened && closesOn ? Math.max(0, Math.round((closesOn.getTime() - today.getTime()) / DAY)) : null,
    happened,
  };
}

export const isMeetingClosed = (meeting: Pick<BridalMeeting, 'date' | 'isActive'>) => meetingStatus(meeting).closed;
