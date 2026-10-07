import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CalendarPlus, CalendarDays, Coins, Image as ImageIcon, Loader2, Plus, Trash2, Users, Wallet } from 'lucide-react';
import { api, photoSrc } from '../api';
import { BaseTeam, Event } from '../types';
import { PageWrapper, SectionTitle, ContentCard, PanelCard, Button, IconButton, Input, DatePicker, Switch, Tabs, EmptyState, FilterLineSegmented } from '../components/ui';
import { useUrlTab } from '../src/hooks/useUrlTab';
import { EVENTS_BASE, eventPath, findEvent, money } from '../utils/events';

const tabs = [
  { id: 'dados', label: 'Dados do evento', icon: CalendarDays },
  { id: 'taxa', label: 'Taxa e metas', icon: Coins },
  { id: 'equipes', label: 'Metas por equipe', icon: Users },
  { id: 'gastos', label: 'Gastos', icon: Wallet },
] as const;
const tabIds = tabs.map(tab => tab.id);

const today = () => new Date().toISOString().slice(0, 10);
const blank = {
  name: '', kind: 'interno' as 'interno' | 'externo', date: today(), endDate: '', startTime: '', endTime: '', location: '', responsible: '', description: '', notes: '', imageUrl: '',
  hasFee: false, ticketValue: '', goalValue: '', participantsGoal: '', capacity: '', registrationOpen: true, registrationDeadline: '', showOnDashboard: true,
};

const Textarea: React.FC<{ id: string; label: string; value: string; onChange: (value: string) => void; rows?: number; hint?: string; placeholder?: string }> = ({ id, label, value, onChange, rows = 4, hint, placeholder }) => (
  <div><label htmlFor={id} className="ds-label mb-1 block">{label}</label>
    <textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-[13px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10" />
    {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}</div>
);

const EventFormPage: React.FC = () => {
  const { eventSlug } = useParams<{ eventSlug?: string }>();
  const navigate = useNavigate();
  const editing = !!eventSlug;
  const [tab, setTab] = useUrlTab(tabIds, 'dados');
  const [events, setEvents] = useState<Event[]>([]);
  const [teams, setTeams] = useState<BaseTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [form, setForm] = useState(blank);
  const [quotas, setQuotas] = useState<Record<string, string>>({});
  const [expenses, setExpenses] = useState<{ description: string; amount: string }[]>([]);
  const [newExpense, setNewExpense] = useState({ description: '', amount: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageError, setImageError] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getEvents(), api.getTeams()])
      .then(([eventItems, teamItems]) => { if (!cancelled) { setEvents(eventItems); setTeams(teamItems); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);

  const current = useMemo(() => editing ? findEvent(events, eventSlug) : null, [events, eventSlug, editing]);

  useEffect(() => {
    if (!current || loadedFor.current === current.id) return;
    loadedFor.current = current.id;
    setForm({
      name: current.name, kind: current.kind || 'interno', date: current.date, endDate: current.endDate || '', startTime: current.startTime || '', endTime: current.endTime || '',
      location: current.location || '', responsible: current.responsible || '', description: current.description || '', notes: current.notes || '', imageUrl: current.imageUrl || '',
      hasFee: current.hasFee !== false && Number(current.ticketValue) > 0, ticketValue: current.ticketValue ? String(current.ticketValue) : '', goalValue: current.goalValue ? String(current.goalValue) : '',
      participantsGoal: current.participantsGoal ? String(current.participantsGoal) : '', capacity: current.capacity ? String(current.capacity) : '',
      registrationOpen: current.registrationOpen !== false, registrationDeadline: current.registrationDeadline || '', showOnDashboard: current.showOnDashboard !== false,
    });
    setQuotas(Object.fromEntries((current.teamQuotas || []).map(quota => [quota.teamId, String(quota.quotaValue)])));
    setExpenses((current.expenses || []).map(item => ({ description: item.description, amount: String(item.amount) })));
  }, [current]);

  useEffect(() => {
    if (!imageFile) { setImagePreview(''); return; }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const set = <K extends keyof typeof blank>(field: K, value: (typeof blank)[K]) => setForm(prev => ({ ...prev, [field]: value }));
  const ticket = parseFloat(form.ticketValue.replace(',', '.'));
  const errors = {
    name: form.name.trim().length < 3 ? ['dados', 'Informe o nome do evento (mínimo 3 letras).'] : null,
    date: !form.date ? ['dados', 'Informe a data do evento.'] : null,
    endDate: form.endDate && form.endDate < form.date ? ['dados', 'O término precisa ser igual ou depois do início.'] : null,
    time: form.startTime && form.endTime && !form.endDate && form.endTime <= form.startTime ? ['dados', 'O horário de término precisa ser depois do início.'] : null,
    fee: form.hasFee && !(ticket > 0) ? ['taxa', 'Informe o valor da taxa por pessoa ou marque o evento como sem taxa.'] : null,
  } as Record<string, [typeof tabIds[number], string] | null>;
  const firstError = Object.values(errors).find(Boolean);
  const err = (key: string) => touched && errors[key] ? <p role="alert" className="mt-1 text-xs text-red-600">{errors[key]![1]}</p> : null;
  const totalExpenses = expenses.reduce((sum, item) => sum + (parseFloat(item.amount.replace(',', '.')) || 0), 0);
  const goal = parseFloat(form.goalValue.replace(',', '.')) || 0;

  const selectImage = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setImageError('Selecione uma imagem JPG, PNG ou WebP.'); return; }
    if (file.size > 5 * 1024 * 1024) { setImageError('A imagem deve ter no máximo 5 MB.'); return; }
    setImageError(''); setImageFile(file);
  };

  const addExpense = () => {
    const amount = parseFloat(newExpense.amount.replace(',', '.'));
    if (newExpense.description.trim().length < 2 || !(amount > 0)) { toast.error('Informe a descrição e um valor maior que zero.'); return; }
    setExpenses(prev => [...prev, { description: newExpense.description.trim(), amount: String(amount) }]);
    setNewExpense({ description: '', amount: '' });
  };

  const save = async () => {
    setTouched(true);
    if (firstError) { toast.error(firstError[1]); setTab(firstError[0]); return; }
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      let imageUrl = form.imageUrl;
      if (imageFile) ({ imageUrl } = await api.uploadEventImage(imageFile));
      const payload = {
        name: form.name.trim(), kind: form.kind, date: form.date, endDate: form.endDate || null, startTime: form.startTime || null, endTime: form.endTime || null,
        location: form.location.trim(), responsible: form.responsible.trim(), description: form.description.trim(), notes: form.notes.trim(), imageUrl: imageUrl || null,
        hasFee: form.hasFee, ticketValue: form.hasFee ? ticket : 0, goalValue: form.hasFee ? goal : 0,
        participantsGoal: parseInt(form.participantsGoal, 10) || null, capacity: parseInt(form.capacity, 10) || null,
        registrationOpen: form.registrationOpen, registrationDeadline: form.registrationDeadline || null, showOnDashboard: form.showOnDashboard,
        cityId: current?.cityId || '1',
        expenses: expenses.map(item => ({ description: item.description, amount: parseFloat(item.amount.replace(',', '.')) || 0 })),
        teamQuotas: form.hasFee ? Object.entries(quotas).map(([teamId, value]) => ({ teamId, quotaValue: parseFloat(value.replace(',', '.')) || 0 })).filter(item => item.quotaValue > 0) : [],
      };
      const saved: Event = current ? await api.updateEvent(current.id, payload) : await api.createEvent(payload);
      toast.success(current ? 'Evento atualizado.' : 'Evento criado.');
      navigate(eventPath(saved, current ? events.map(item => item.id === saved.id ? saved : item) : [saved, ...events]), { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o evento.');
    } finally { savingRef.current = false; setSaving(false); }
  };

  if (loading) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando…</div></PageWrapper>;
  if (error || (editing && !current)) return <PageWrapper><ContentCard><EmptyState icon={CalendarDays} title={error ? 'Não foi possível carregar o evento' : 'Evento não encontrado'} description={error ? 'Confira a conexão e tente novamente.' : 'O evento pode ter sido removido ou o endereço está incorreto.'}
    action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate(EVENTS_BASE)}>Voltar para Eventos</Button>{error && <Button onClick={() => { setError(false); setLoading(true); setRetry(value => value + 1); }}>Tentar novamente</Button>}</div>} /></ContentCard></PageWrapper>;

  const image = imagePreview || (form.imageUrl ? photoSrc(form.imageUrl) : '');

  return (
    <PageWrapper>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={() => current ? navigate(eventPath(current, events)) : navigate(EVENTS_BASE)}>{current ? 'Voltar para o evento' : 'Voltar para Eventos'}</Button>
        <SectionTitle icon={CalendarPlus} title={current ? 'Editar evento' : 'Novo evento'} description={current ? 'Atualize os dados, as metas e as regras de inscrição.' : 'Cadastre o evento, defina se tem taxa e quais são as metas.'} />

        <Tabs<typeof tabIds[number]> items={tabs} value={tab} onChange={setTab} label="Seções do evento">
          {tab === 'dados' && <div className="space-y-3">
            <PanelCard title="Identificação">
              <div className="space-y-3">
                <div><Input label="Nome do evento" placeholder="Ex.: Retiro de casais 2026" value={form.name} onChange={event => set('name', event.target.value)} />{err('name')}</div>
                <div>
                  <p className="ds-label mb-1">Tipo</p>
                  <FilterLineSegmented<string> value={form.kind} onChange={value => set('kind', value as 'interno' | 'externo')} options={[{ value: 'interno', label: 'Interno (só membros)' }, { value: 'externo', label: 'Externo (aberto a convidados)' }]} />
                  <p className="mt-1 text-[11px] text-slate-500">{form.kind === 'externo' ? 'Gera um link público: qualquer pessoa se inscreve sem login.' : 'Só quem tem acesso ao sistema participa; as equipes inscrevem seus membros.'}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><DatePicker label="Data de início" value={form.date} onChange={value => set('date', value || '')} />{err('date')}</div>
                  <div><DatePicker label="Data de término (opcional)" value={form.endDate} onChange={value => set('endDate', value || '')} />{err('endDate')}</div>
                  <Input label="Horário de início" type="time" value={form.startTime} onChange={event => set('startTime', event.target.value)} />
                  <div><Input label="Horário de término" type="time" value={form.endTime} onChange={event => set('endTime', event.target.value)} />{err('time')}</div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Local" placeholder="Nome do local ou endereço" value={form.location} onChange={event => set('location', event.target.value)} />
                  <Input label="Responsável" placeholder="Quem coordena o evento" value={form.responsible} onChange={event => set('responsible', event.target.value)} />
                </div>
              </div>
            </PanelCard>
            <PanelCard title="Divulgação">
              <div className="space-y-3">
                <div>
                  <p className="ds-label mb-1">Imagem do evento</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
                      {image ? <img src={image} alt="Imagem do evento" className="h-full w-full object-cover" /> : <ImageIcon size={22} className="text-slate-300" />}
                    </div>
                    <div className="space-y-1.5">
                      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Selecionar imagem do evento" className="hidden" onChange={event => { selectImage(event.target.files?.[0]); event.target.value = ''; }} />
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" disabled={saving} onClick={() => fileInput.current?.click()}>{image ? 'Trocar imagem' : 'Selecionar imagem'}</Button>
                        {image && <Button variant="ghost" size="sm" disabled={saving} onClick={() => { setImageFile(null); set('imageUrl', ''); setImageError(''); }}>Remover</Button>}
                      </div>
                      <p className="text-[11px] text-slate-500">JPG, PNG ou WebP, até 5 MB. É enviada ao salvar.</p>
                      {imageError && <p role="alert" className="text-xs text-red-600">{imageError}</p>}
                    </div>
                  </div>
                </div>
                <Textarea id="event-description" label="Descrição" rows={5} value={form.description} onChange={value => set('description', value)} placeholder="O que é o evento, programação, o que levar…" hint="Aparece para os membros e na página de inscrição." />
                <Textarea id="event-notes" label="Observações internas" rows={3} value={form.notes} onChange={value => set('notes', value)} placeholder="Combinados da organização, contatos, pendências…" hint="Só quem administra vê. Não aparece para convidados." />
              </div>
            </PanelCard>
          </div>}

          {tab === 'taxa' && <div className="space-y-3">
            <PanelCard title="Taxa" description="Cobrança por pessoa inscrita.">
              <div className="space-y-3">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <Switch checked={form.hasFee} onCheckedChange={value => set('hasFee', value)} size="sm" />
                  <span><span className="block text-xs font-semibold text-slate-800">Evento com taxa</span><span className="block text-[11px] text-slate-500">{form.hasFee ? 'Cada inscrito deve o valor abaixo; dá para receber, registrar venda de ingresso e acompanhar a arrecadação.' : 'Sem taxa: ninguém é cobrado, não há venda de ingresso nem meta de arrecadação.'}</span></span>
                </label>
                {form.hasFee && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><Input label="Valor por pessoa" type="number" min={0} step="0.01" addonLeft="R$" value={form.ticketValue} onChange={event => set('ticketValue', event.target.value)} />{err('fee')}</div>
                  <Input label="Meta de arrecadação" type="number" min={0} step="0.01" addonLeft="R$" value={form.goalValue} onChange={event => set('goalValue', event.target.value)} hint="Quanto o evento precisa arrecadar. Aparece no painel." />
                </div>}
              </div>
            </PanelCard>
            <PanelCard title="Participantes e inscrições">
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Meta de participantes" type="number" min={0} value={form.participantsGoal} onChange={event => set('participantsGoal', event.target.value)} hint="Quantas pessoas você espera. Aparece no painel." />
                  <Input label="Vagas (limite)" type="number" min={0} value={form.capacity} onChange={event => set('capacity', event.target.value)} hint="Opcional. Fecha as inscrições quando lotar." />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DatePicker label="Prazo para inscrição (opcional)" value={form.registrationDeadline} onChange={value => set('registrationDeadline', value || '')} />
                </div>
                <label className="flex cursor-pointer items-center gap-3"><Switch checked={form.registrationOpen} onCheckedChange={value => set('registrationOpen', value)} size="sm" /><span className="text-xs text-slate-700">Inscrições abertas ao público (link)</span></label>
                <label className="flex cursor-pointer items-center gap-3"><Switch checked={form.showOnDashboard} onCheckedChange={value => set('showOnDashboard', value)} size="sm" /><span className="text-xs text-slate-700">Mostrar este evento no painel</span></label>
              </div>
            </PanelCard>
          </div>}

          {tab === 'equipes' && <PanelCard title="Meta de arrecadação por equipe" description="Quanto cada equipe se compromete a arrecadar. Deixe em branco para não definir meta.">
            {!form.hasFee ? <EmptyState icon={Users} title="Evento sem taxa" description="As metas por equipe valem para eventos com taxa. Ative a taxa na aba “Taxa e metas”." />
              : teams.length === 0 ? <EmptyState icon={Users} title="Nenhuma equipe cadastrada" />
              : <ul className="divide-y divide-slate-100">{teams.map(team => <li key={team.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span className="min-w-0 text-[13px] text-slate-800 break-words">{team.name}</span>
                <Input aria-label={`Meta da equipe ${team.name}`} type="number" min={0} step="0.01" addonLeft="R$" placeholder="0,00" wrapperClassName="w-44" value={quotas[team.id] || ''} onChange={event => setQuotas(prev => ({ ...prev, [team.id]: event.target.value }))} />
              </li>)}</ul>}
          </PanelCard>}

          {tab === 'gastos' && <PanelCard title="Gastos previstos" description="Custos do evento (aluguel, alimentação, material).">
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <Input label="Descrição" placeholder="Ex.: Aluguel do salão" wrapperClassName="min-w-[12rem] flex-1" value={newExpense.description} onChange={event => setNewExpense({ ...newExpense, description: event.target.value })} />
                <Input label="Valor" type="number" min={0} step="0.01" addonLeft="R$" wrapperClassName="w-40" value={newExpense.amount} onChange={event => setNewExpense({ ...newExpense, amount: event.target.value })} />
                <Button variant="outline" size="sm" iconLeft={<Plus size={14} />} onClick={addExpense}>Adicionar</Button>
              </div>
              {expenses.length ? <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">{expenses.map((item, index) => <li key={index} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-[13px] text-slate-800 break-words">{item.description}</span>
                <span className="flex items-center gap-2"><span className="text-xs font-semibold tabular-nums text-slate-800">{money(parseFloat(item.amount) || 0)}</span>
                  <IconButton variant="ghost" size="xs" aria-label={`Remover ${item.description}`} onClick={() => setExpenses(prev => prev.filter((_, i) => i !== index))}><Trash2 size={14} className="text-red-500" /></IconButton></span>
              </li>)}</ul> : <p className="text-xs text-slate-500">Nenhum gasto cadastrado.</p>}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                <span className="text-slate-600">Total de gastos <strong className="ml-1 text-slate-900">{money(totalExpenses)}</strong></span>
                {form.hasFee && goal > 0 && <span className={goal - totalExpenses >= 0 ? 'text-emerald-700' : 'text-red-600'}>Se bater a meta, sobram <strong>{money(goal - totalExpenses)}</strong></span>}
              </div>
            </div>
          </PanelCard>}
        </Tabs>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => current ? navigate(eventPath(current, events)) : navigate(EVENTS_BASE)}>Cancelar</Button>
          <Button size="sm" loading={saving} onClick={save}>{current ? 'Salvar alterações' : 'Criar evento'}</Button>
        </div>
      </div>
    </PageWrapper>
  );
};

export default EventFormPage;
