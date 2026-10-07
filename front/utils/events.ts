import type { Event, EventItem, EventRegistration, UserRoleType } from '../types';
import { entitySlug, findBySlug } from './entitySlug';
import { dateLabel } from './dates';

export const EVENTS_BASE = '/eventos';

/* ───────────── URL com o nome do evento ───────────── */

type EventLike = Pick<Event, 'id' | 'name' | 'date'>;
const bases = (event: EventLike) => [event.name, `${event.name} ${event.date}`];
export const eventSlug = (event: EventLike, events: EventLike[]) => {
  const slug = entitySlug(event, events, bases);
  // "novo" e "inscricao" são rotas fixas da tela.
  return ['novo', 'inscricao'].includes(slug) ? `${slug}-evento` : slug;
};
export const findEvent = <T extends EventLike>(events: T[], param?: string) => findBySlug<T>(events, param, bases, event => eventSlug(event, events));
export const eventPath = (event: EventLike, events: EventLike[]) => `${EVENTS_BASE}/${eventSlug(event, events)}`;

/* ───────────── Situação do evento ───────────── */

export type EventPhase = 'cancelado' | 'encerrado' | 'realizado' | 'hoje' | 'em-breve';

/** Dias depois do evento em que ele é encerrado sozinho (igual ao Encontro de Noivos). */
export const CLOSE_AFTER_DAYS = 7;

const day = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`);
const startOfToday = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);

export interface EventStatus {
  phase: EventPhase;
  label: string;
  /** Ainda dá para inscrever pessoas pela equipe/painel (não está cancelado nem já aconteceu). */
  canRegister: boolean;
  /** Inscrições abertas ao público (link): considera prazo, vagas e o interruptor do evento. */
  publicOpen: boolean;
  spotsLeft: number | null;
  daysUntil: number;
  /** Realizado e ainda dentro do prazo para acertar as contas: dias que faltam para encerrar sozinho. */
  daysToClose: number | null;
  /** Dia em que o evento é encerrado sozinho. */
  closesOn: Date;
  /** Encerrado: somente consulta. */
  locked: boolean;
}

export function eventStatus(event: Pick<Event, 'date' | 'endDate' | 'isActive' | 'registrationOpen' | 'registrationDeadline' | 'capacity' | 'stats' | 'closed'>, now = new Date()): EventStatus {
  const today = startOfToday(now);
  const start = day(event.date);
  const end = day(event.endDate || event.date);
  const daysUntil = Math.round((start.getTime() - today.getTime()) / 86_400_000);
  const closesOn = new Date(end.getTime() + CLOSE_AFTER_DAYS * 86_400_000);
  const autoClosed = today > closesOn;
  const phase: EventPhase = !event.isActive ? 'cancelado' : event.closed || autoClosed ? 'encerrado' : today > end ? 'realizado' : today >= start ? 'hoje' : 'em-breve';
  const spotsLeft = event.capacity ? Math.max(0, event.capacity - (event.stats?.registered || 0)) : null;
  const deadlineOk = !event.registrationDeadline || today <= day(event.registrationDeadline);
  const canRegister = phase === 'em-breve' || phase === 'hoje';
  return {
    phase,
    label: phase === 'cancelado' ? 'Cancelado' : phase === 'encerrado' ? 'Encerrado' : phase === 'realizado' ? 'Realizado' : phase === 'hoje' ? 'Acontecendo' : daysUntil === 1 ? 'Amanhã' : `Em ${daysUntil} dias`,
    canRegister,
    publicOpen: canRegister && event.registrationOpen !== false && deadlineOk && (spotsLeft === null || spotsLeft > 0),
    spotsLeft,
    daysUntil,
    daysToClose: phase === 'realizado' ? Math.max(0, Math.round((closesOn.getTime() - today.getTime()) / 86_400_000)) : null,
    closesOn,
    locked: phase === 'encerrado' || phase === 'cancelado',
  };
}

/* ───────────── Metas e arrecadação ───────────── */

export const percent = (value: number, goal?: number | null) => goal && goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : null;
export const people = (registration: Pick<EventRegistration, 'guests'>) => 1 + (Number(registration.guests) || 0);
export const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

/** "Registrar venda" só existe em evento com taxa e valor definido. */
export const canSellTickets = (event: Pick<Event, 'hasFee' | 'ticketValue' | 'isActive' | 'locked'>) => event.hasFee !== false && Number(event.ticketValue) > 0 && event.isActive && !event.locked;

/* ───────────── Quem pode mexer em quê ───────────── */

const TEAM_LEVEL: string[] = ['Coordenador Equipe Base', 'Vice Coordenador', 'Tesoureiro', 'Usuário'];

/**
 * Equipe a que o usuário fica limitado. Perfis de coordenação geral (admin, cidade, estado, secretarias, condir) veem e inscrevem todas as equipes;
 * coordenador/vice/tesoureiro/usuário só mexem na própria. Devolve null quando não há limite.
 */
export function scopedTeamId(user?: { role?: UserRoleType | string; teamId?: string } | null) {
  if (!user) return null;
  return TEAM_LEVEL.includes(String(user.role)) ? (user.teamId || '__sem_equipe__') : null;
}

/* ───────────── Listas prontas de itens ───────────── */

export interface ItemTemplate { id: string; label: string; items: { name: string; quantity: number; unit?: string }[]; }

export const ITEM_TEMPLATES: ItemTemplate[] = [
  { id: 'cafe', label: 'Café da manhã', items: [
    { name: 'Café', quantity: 2, unit: 'kg' }, { name: 'Leite', quantity: 6, unit: 'L' }, { name: 'Pão', quantity: 40, unit: 'un' }, { name: 'Margarina', quantity: 2, unit: 'pote' },
    { name: 'Queijo', quantity: 1, unit: 'kg' }, { name: 'Presunto', quantity: 1, unit: 'kg' }, { name: 'Bolo', quantity: 3, unit: 'un' }, { name: 'Frutas', quantity: 3, unit: 'kg' },
    { name: 'Copos descartáveis', quantity: 100, unit: 'un' }, { name: 'Guardanapos', quantity: 2, unit: 'pacote' } ] },
  { id: 'almoco', label: 'Almoço de confraternização', items: [
    { name: 'Arroz', quantity: 5, unit: 'kg' }, { name: 'Feijão', quantity: 3, unit: 'kg' }, { name: 'Carne', quantity: 8, unit: 'kg' }, { name: 'Salada', quantity: 4, unit: 'bandeja' },
    { name: 'Farofa', quantity: 2, unit: 'kg' }, { name: 'Refrigerante', quantity: 10, unit: 'L' }, { name: 'Suco', quantity: 10, unit: 'L' }, { name: 'Sobremesa', quantity: 40, unit: 'un' },
    { name: 'Pratos e talheres descartáveis', quantity: 100, unit: 'kit' } ] },
  { id: 'lanche', label: 'Lanche da tarde', items: [
    { name: 'Salgados', quantity: 100, unit: 'un' }, { name: 'Pão de queijo', quantity: 60, unit: 'un' }, { name: 'Bolo', quantity: 2, unit: 'un' }, { name: 'Suco', quantity: 6, unit: 'L' },
    { name: 'Café', quantity: 1, unit: 'kg' }, { name: 'Copos descartáveis', quantity: 80, unit: 'un' } ] },
  { id: 'material', label: 'Material e estrutura', items: [
    { name: 'Crachás', quantity: 60, unit: 'un' }, { name: 'Canetas', quantity: 30, unit: 'un' }, { name: 'Som e microfone', quantity: 1 }, { name: 'Banner do evento', quantity: 1 },
    { name: 'Folhetos e programação', quantity: 80, unit: 'un' }, { name: 'Cadeiras extras', quantity: 20, unit: 'un' } ] },
];

/* ───────────── Convite ───────────── */

export function inviteMessage(event: Pick<Event, 'name' | 'date' | 'startTime' | 'location' | 'hasFee' | 'ticketValue'> & { bridalMeetingId?: string | null }, link: string, recipient?: string) {
  const when = [dateLabel(event.date), event.startTime].filter(Boolean).join(' às ');
  if (event.bridalMeetingId) return `${recipient ? `Olá, ${recipient.trim().split(/\s+/)[0]}! ` : 'Olá! '}Vocês estão convidados para o Encontro de Noivos do MFC ("${event.name}"), em ${when}${event.location ? `, no local: ${event.location}` : ''}. Preencham a ficha de inscrição do casal pelo link: ${link} 🙏`;
  const fee = event.hasFee !== false && Number(event.ticketValue) > 0 ? ` Valor: ${money(Number(event.ticketValue))} por pessoa.` : ' Participação sem taxa.';
  return `${recipient ? `Olá, ${recipient.trim().split(/\s+/)[0]}! ` : 'Olá! '}Você está convidado(a) para o evento "${event.name}" do MFC, em ${when}${event.location ? `, no local: ${event.location}` : ''}.${fee} Faça sua inscrição pelo link: ${link} 🙏`;
}

export const publicEventLink = (token: string) => `${window.location.origin}${EVENTS_BASE}/inscricao/${token}`;
export const internalEventLink = (path: string) => `${window.location.origin}${path}`;

/* ───────────── Resumo de itens ───────────── */

export const itemProgress = (items: Pick<EventItem, 'status'>[]) => ({ total: items.length, done: items.filter(item => item.status !== 'Pendente').length });
