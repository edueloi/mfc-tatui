import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Plus, Users, Wallet, Target, MapPin, Clock, Pencil, ArrowRight, ShoppingCart, Loader2, Ticket, ServerCrash, Heart } from 'lucide-react';
import { api, photoSrc } from '../api';
import { BaseTeam, Event, EventSale, Member } from '../types';
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard, Button, IconButton, Badge, Select, EmptyState,
  FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch, FilterLineSegmented,
} from '../components/ui';
import { EventSaleModal } from '../components/EventSaleModal';
import { getCurrentUser } from '../src/lib/currentUser';
import { dateLabel } from '../utils/dates';
import { normalizeDirectoryText } from '../utils/memberDirectory';
import { EVENTS_BASE, canSellTickets, eventPath, eventStatus, money, percent, scopedTeamId } from '../utils/events';

const Bar: React.FC<{ value: number | null; tone?: string; label: string }> = ({ value, tone = 'bg-blue-600', label }) => (
  <div role="progressbar" aria-label={label} aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-slate-100">
    <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${value ?? 0}%` }} />
  </div>
);

const EventsView: React.FC = () => {
  const navigate = useNavigate();
  const me = getCurrentUser();
  const scope = scopedTeamId(me);
  const staff = scope === null;

  const [events, setEvents] = useState<Event[]>([]);
  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState('upcoming');
  const [kind, setKind] = useState('all');
  const [saleEvent, setSaleEvent] = useState<Event | null>(null);
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => Promise.all([api.getEvents(), api.getTeams(), api.getMembers().catch(() => [])])
      .then(([eventItems, teamItems, memberItems]) => { if (!cancelled) { setEvents(eventItems); setTeams(teamItems); setMembers(memberItems); setError(false); setOutdated(eventItems.length > 0 && !eventItems[0].stats); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    load();
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.removeEventListener('focus', load); };
  }, [retry]);

  const rows = useMemo(() => events.map(event => ({ event, status: eventStatus(event) })), [events]);
  const query = normalizeDirectoryText(search);
  const filtered = useMemo(() => rows
    .filter(({ event, status }) => (phase === 'all' || (phase === 'upcoming' ? status.phase === 'em-breve' || status.phase === 'hoje' : phase === 'done' ? status.phase === 'realizado' || status.phase === 'encerrado' : status.phase === 'cancelado'))
      && (kind === 'all' || (event.kind || 'interno') === kind) && (!query || normalizeDirectoryText(`${event.name} ${event.location || ''}`).includes(query)))
    .sort((a, b) => phase === 'upcoming' ? a.event.date.localeCompare(b.event.date) : b.event.date.localeCompare(a.event.date)), [rows, phase, kind, query]);

  const counts = useMemo(() => ({
    upcoming: rows.filter(({ status }) => status.phase === 'em-breve' || status.phase === 'hoje').length,
    done: rows.filter(({ status }) => status.phase === 'realizado' || status.phase === 'encerrado').length,
    cancelled: rows.filter(({ status }) => status.phase === 'cancelado').length,
  }), [rows]);
  const upcoming = rows.filter(({ status }) => status.phase === 'em-breve' || status.phase === 'hoje');
  const registered = upcoming.reduce((sum, { event }) => sum + (event.stats?.registered || 0), 0);
  const raised = filtered.reduce((sum, { event }) => sum + (event.stats?.raised || 0), 0);
  const goal = filtered.reduce((sum, { event }) => sum + (event.hasFee !== false ? Number(event.goalValue) || 0 : 0), 0);
  const hasFilter = !!query || kind !== 'all' || phase !== 'upcoming';

  if (loading) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando eventos…</div></PageWrapper>;
  if (outdated) return <PageWrapper><ContentCard><EmptyState icon={ServerCrash} title="O servidor ainda está na versão antiga" description="Os eventos novos precisam do backend atualizado. Reinicie o servidor (backend) e atualize esta página."
    action={<Button onClick={() => { setLoading(true); setOutdated(false); setRetry(value => value + 1); }}>Tentar novamente</Button>} /></ContentCard></PageWrapper>;
  if (error && !events.length) return <PageWrapper><ContentCard><EmptyState icon={CalendarDays} title="Não foi possível carregar os eventos" description="Confira a conexão e tente novamente."
    action={<Button onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Tentar novamente</Button>} /></ContentCard></PageWrapper>;

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle title="Eventos" icon={Ticket} description="Eventos internos e externos, inscrições, metas e itens."
          action={staff ? <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => navigate(`${EVENTS_BASE}/novo`)}>Novo evento</Button> : undefined} />

        <StatGrid cols={4}>
          <StatCard title="Próximos eventos" value={counts.upcoming} icon={CalendarDays} color="info" description={`${counts.done} realizados`} />
          <StatCard title="Inscritos nos próximos" value={registered} icon={Users} color="success" />
          <StatCard title="Arrecadado" value={money(raised)} icon={Wallet} color="purple" description="Dos eventos exibidos" />
          <StatCard title="Meta de arrecadação" value={money(goal)} icon={Target} color="warning" description={goal ? `${percent(raised, goal) ?? 0}% alcançado` : 'Eventos com taxa'} />
        </StatGrid>

        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem grow><FilterLineSearch aria-label="Buscar evento" value={search} onChange={setSearch} placeholder="Nome ou local…" /></FilterLineItem>
            <FilterLineItem><FilterLineSegmented value={phase} onChange={value => setPhase(String(value))}
              options={[{ value: 'upcoming', label: `Próximos (${counts.upcoming})` }, { value: 'done', label: `Realizados (${counts.done})` }, { value: 'cancelled', label: `Cancelados (${counts.cancelled})` }, { value: 'all', label: 'Todos' }]} /></FilterLineItem>
            <FilterLineItem><Select aria-label="Tipo de evento" value={kind} onChange={event => setKind(event.target.value)} options={[{ value: 'all', label: 'Todos os tipos' }, { value: 'interno', label: 'Internos' }, { value: 'externo', label: 'Externos' }]} /></FilterLineItem>
          </FilterLineSection>
          <FilterLineSection align="right">
            <span className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'evento' : 'eventos'}</span>
            {hasFilter && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setKind('all'); setPhase('upcoming'); }}>Limpar filtros</Button>}
          </FilterLineSection>
        </FilterLine>

        {filtered.length === 0
          ? <ContentCard><EmptyState icon={CalendarDays} title="Nenhum evento encontrado" description={hasFilter ? 'Ajuste a busca ou os filtros.' : 'Cadastre o primeiro evento.'} action={!hasFilter && staff ? <Button size="sm" onClick={() => navigate(`${EVENTS_BASE}/novo`)}>Novo evento</Button> : undefined} /></ContentCard>
          : <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map(({ event, status }) => {
            const stats = event.stats;
            const fee = event.hasFee !== false && Number(event.ticketValue) > 0;
            const people = stats?.registered || 0;
            const peopleGoal = event.participantsGoal || event.capacity || null;
            const peoplePct = percent(people, peopleGoal);
            const raisedPct = percent(stats?.raised || 0, event.goalValue);
            const open = () => navigate(eventPath(event, events));
            return <ContentCard key={event.id} padding="none" className={`group flex h-full flex-col overflow-hidden transition-all hover:border-blue-200 ${status.phase === 'cancelado' ? 'opacity-75' : ''}`}>
              {event.imageUrl && <button type="button" onClick={open} aria-label={`Abrir ${event.name}`} className="block h-28 w-full overflow-hidden bg-slate-100 focus-visible:outline-blue-500"><img src={photoSrc(event.imageUrl)} alt="" className="h-full w-full object-cover" /></button>}
              <div className="flex flex-1 flex-col gap-3 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge size="sm" color={event.kind === 'externo' ? 'purple' : 'info'}>{event.kind === 'externo' ? 'Externo' : 'Interno'}</Badge>
                  {event.bridalMeetingId && <Badge size="sm" color="danger" icon={<Heart size={10} />}>Encontro de Noivos</Badge>}
                  <Badge size="sm" color={fee ? 'warning' : 'success'}>{fee ? `Taxa ${money(Number(event.ticketValue))}` : 'Sem taxa'}</Badge>
                  <span className="ml-auto"><Badge size="sm" dot color={status.phase === 'cancelado' ? 'danger' : status.phase === 'realizado' || status.phase === 'encerrado' ? 'default' : status.phase === 'hoje' ? 'success' : 'info'}>{status.label}</Badge></span>
                </div>
                <button type="button" className="text-left focus-visible:outline-blue-500" onClick={open}>
                  <h3 className="text-sm font-semibold leading-tight text-slate-900 break-words transition-colors group-hover:text-blue-600">{event.name}</h3>
                  <ul className="mt-2 space-y-1 text-xs text-slate-500">
                    <li className="flex items-center gap-1.5"><CalendarDays size={12} className="shrink-0 text-slate-400" />{dateLabel(event.date)}{event.endDate && event.endDate !== event.date ? ` a ${dateLabel(event.endDate)}` : ''}</li>
                    {(event.startTime || event.endTime) && <li className="flex items-center gap-1.5"><Clock size={12} className="shrink-0 text-slate-400" />{[event.startTime, event.endTime].filter(Boolean).join(' às ')}</li>}
                    {event.location && <li className="flex items-center gap-1.5 break-words"><MapPin size={12} className="shrink-0 text-slate-400" />{event.location}</li>}
                  </ul>
                </button>
                <div className="mt-auto space-y-2.5 border-t border-slate-100 pt-3">
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>Inscritos</span><span className="tabular-nums">{people}{peopleGoal ? ` / ${peopleGoal}` : ''}</span></div>
                    <Bar value={peoplePct} label="Inscritos" tone="bg-emerald-500" />
                  </div>
                  {fee && <div>
                    <div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>Arrecadado</span><span className="tabular-nums">{money(stats?.raised || 0)}{Number(event.goalValue) > 0 ? ` / ${money(Number(event.goalValue))}` : ''}</span></div>
                    <Bar value={raisedPct} label="Arrecadação" />
                  </div>}
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/50 p-3">
                <Button size="xs" className="flex-1" iconRight={<ArrowRight size={12} />} onClick={open}>Abrir evento</Button>
                {canSellTickets(event) && status.canRegister && <Button variant="outline" size="xs" iconLeft={<ShoppingCart size={12} />} onClick={() => setSaleEvent(event)}>Registrar venda</Button>}
                {staff && !status.locked && <IconButton variant="ghost" size="xs" aria-label={`Editar ${event.name}`} className="h-8 w-8" onClick={() => navigate(`${eventPath(event, events)}/editar`)}><Pencil size={14} /></IconButton>}
              </div>
            </ContentCard>;
          })}</div>}
      </div>

      {saleEvent && <EventSaleModal isOpen event={saleEvent} teams={teams} members={members} scopeTeamId={scope} onClose={() => setSaleEvent(null)}
        onSaved={(sales: EventSale[]) => { void sales; setRetry(value => value + 1); }} />}
    </PageWrapper>
  );
};

export default EventsView;
