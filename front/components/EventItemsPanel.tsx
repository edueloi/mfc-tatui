import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ClipboardList, HandHeart, ListPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { BaseTeam, Event, EventItem, EventItemStatus } from '../types';
import { Badge, Button, ConfirmModal, ContentCard, EmptyState, IconButton, Input, Modal, ModalFooter, Select } from './ui';
import { ITEM_TEMPLATES, itemProgress } from '../utils/events';

interface EventItemsPanelProps {
  event: Event;
  items: EventItem[];
  teams: BaseTeam[];
  /** Equipe e nome do usuário, para o botão "Eu levo". */
  me: { name: string; teamId?: string } | null;
  canEdit: boolean;
  onChange: (items: EventItem[]) => void;
}

const STATUS_COLOR: Record<EventItemStatus, 'warning' | 'info' | 'success'> = { Pendente: 'warning', Confirmado: 'info', Entregue: 'success' };

/** Lista de itens para levar (café, lanche, material…): quantidade, quem leva e se já foi confirmado/entregue. */
export const EventItemsPanel: React.FC<EventItemsPanelProps> = ({ event, items, teams, me, canEdit, onChange }) => {
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<EventItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const progress = itemProgress(items);
  const teamName = (id: string | null) => teams.find(team => team.id === id)?.name;

  const update = async (item: EventItem, data: Partial<EventItem>, message?: string) => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      const saved: EventItem = await api.updateEventItem(item.id, data);
      onChange(items.map(current => current.id === saved.id ? saved : current));
      if (message) toast.success(message);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar o item.'); }
    finally { setBusyId(null); }
  };

  const remove = async () => {
    if (!removeTarget || removing) return;
    setRemoving(true);
    try { await api.deleteEventItem(removeTarget.id); onChange(items.filter(item => item.id !== removeTarget.id)); toast.success('Item removido.'); setRemoveTarget(null); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível remover o item.'); }
    finally { setRemoving(false); }
  };

  return <div className="space-y-3">
    <ContentCard padding="md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Itens para levar</p>
          <p className="mt-0.5 text-xs text-slate-500">{progress.total ? `${progress.done} de ${progress.total} itens confirmados ou entregues` : 'Monte a lista do que cada equipe precisa levar.'}</p>
          {progress.total > 0 && <div className="mt-2 h-1.5 w-56 max-w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>}
        </div>
        {canEdit && <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" iconLeft={<ListPlus size={14} />} onClick={() => setShowTemplates(true)}>Lista pronta</Button>
          <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => { setEditing(null); setShowForm(true); }}>Adicionar item</Button>
        </div>}
      </div>
    </ContentCard>

    {items.length === 0
      ? <ContentCard><EmptyState icon={ClipboardList} title="Nenhum item na lista" description="Adicione itens um a um ou use uma lista pronta (café, almoço, lanche, material)." action={canEdit ? <Button size="sm" onClick={() => setShowTemplates(true)}>Usar lista pronta</Button> : undefined} /></ContentCard>
      : <ContentCard padding="none"><ul className="divide-y divide-slate-100">
        {items.map(item => { const who = [item.assignedTo, teamName(item.teamId)].filter(Boolean).join(' · ');
          return <li key={item.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-slate-900 break-words">{item.name} <span className="font-normal text-slate-500">· {item.quantity}{item.unit ? ` ${item.unit}` : ''}</span></p>
              <p className="mt-0.5 text-xs text-slate-500">{who ? `Quem leva: ${who}` : 'Ninguém assumiu ainda'}</p>
            </div>
            <Badge size="sm" dot color={STATUS_COLOR[item.status]}>{item.status}</Badge>
            <div className="flex items-center gap-1.5">
              {me && !item.assignedTo && item.status === 'Pendente' && <Button variant="outline" size="xs" iconLeft={<HandHeart size={12} />} disabled={!!busyId} onClick={() => update(item, { assignedTo: me.name, teamId: me.teamId || null, status: 'Confirmado' }, 'Obrigado! O item é seu.')}>Eu levo</Button>}
              {canEdit && item.status !== 'Entregue' && <Button variant="ghost" size="xs" disabled={!!busyId} onClick={() => update(item, { status: item.status === 'Pendente' ? 'Confirmado' : 'Entregue' })}>{item.status === 'Pendente' ? 'Confirmar' : 'Marcar entregue'}</Button>}
              {canEdit && item.status !== 'Pendente' && <Button variant="ghost" size="xs" disabled={!!busyId} onClick={() => update(item, { status: 'Pendente' })}>Desfazer</Button>}
              {canEdit && <IconButton variant="ghost" size="xs" aria-label={`Editar ${item.name}`} onClick={() => { setEditing(item); setShowForm(true); }}><Pencil size={14} /></IconButton>}
              {canEdit && <IconButton variant="ghost" size="xs" aria-label={`Remover ${item.name}`} onClick={() => setRemoveTarget(item)}><Trash2 size={14} className="text-red-500" /></IconButton>}
            </div>
          </li>; })}
      </ul></ContentCard>}

    <ItemFormModal isOpen={showForm} event={event} item={editing} teams={teams} onClose={() => setShowForm(false)}
      onSaved={(saved, mode) => onChange(mode === 'created' ? [...items, saved] : items.map(item => item.id === saved.id ? saved : item))} />
    <TemplateModal isOpen={showTemplates} event={event} existing={items} onClose={() => setShowTemplates(false)} onSaved={created => onChange([...items, ...created])} />
    <ConfirmModal isOpen={!!removeTarget} onClose={() => setRemoveTarget(null)} onConfirm={remove} loading={removing} title="Remover item?" message={`"${removeTarget?.name}" sai da lista de itens do evento.`} confirmLabel="Remover item" variant="danger" />
  </div>;
};

const ItemFormModal: React.FC<{ isOpen: boolean; event: Event; item: EventItem | null; teams: BaseTeam[]; onClose: () => void; onSaved: (item: EventItem, mode: 'created' | 'updated') => void }> = ({ isOpen, event, item, teams, onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', quantity: '1', unit: '', teamId: '', assignedTo: '' });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => { if (isOpen) { setTouched(false); setForm(item ? { name: item.name, quantity: String(item.quantity), unit: item.unit, teamId: item.teamId || '', assignedTo: item.assignedTo } : { name: '', quantity: '1', unit: '', teamId: '', assignedTo: '' }); } }, [isOpen, item]);
  const errors = { name: form.name.trim().length < 2 ? 'Informe o nome do item.' : '', quantity: !(parseInt(form.quantity, 10) >= 1) ? 'A quantidade precisa ser 1 ou mais.' : '' };
  const invalid = Object.values(errors).some(Boolean);
  const err = (message: string) => touched && message ? <p role="alert" className="mt-1 text-xs text-red-600">{message}</p> : null;

  const save = async () => {
    setTouched(true);
    if (invalid || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const payload = { name: form.name.trim(), quantity: parseInt(form.quantity, 10), unit: form.unit.trim(), teamId: form.teamId || null, assignedTo: form.assignedTo.trim() };
      const saved: EventItem = item ? await api.updateEventItem(item.id, payload) : (await api.createEventItems(event.id, [payload]))[0];
      toast.success(item ? 'Item atualizado.' : 'Item adicionado.');
      onSaved(saved, item ? 'updated' : 'created');
      onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o item.'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  return <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title={item ? 'Editar item' : 'Novo item'} size="sm"
    footer={<ModalFooter><Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>Cancelar</Button><Button size="sm" loading={saving} onClick={save}>{item ? 'Salvar' : 'Adicionar'}</Button></ModalFooter>}>
    <div className="space-y-3">
      <div><Input label="Item" placeholder="Ex.: Café" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />{err(errors.name)}</div>
      <div className="grid grid-cols-2 gap-3">
        <div><Input label="Quantidade" type="number" min={1} value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} />{err(errors.quantity)}</div>
        <Input label="Unidade" placeholder="kg, L, un…" value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value })} />
      </div>
      <Select label="Equipe responsável" value={form.teamId} onChange={event => setForm({ ...form, teamId: event.target.value })} options={[{ value: '', label: 'Ninguém ainda' }, ...teams.map(team => ({ value: team.id, label: team.name }))]} />
      <Input label="Quem leva" placeholder="Opcional (nome da pessoa)" value={form.assignedTo} onChange={event => setForm({ ...form, assignedTo: event.target.value })} />
    </div>
  </Modal>;
};

const TemplateModal: React.FC<{ isOpen: boolean; event: Event; existing: EventItem[]; onClose: () => void; onSaved: (items: EventItem[]) => void }> = ({ isOpen, event, existing, onClose, onSaved }) => {
  const [templateId, setTemplateId] = useState(ITEM_TEMPLATES[0].id);
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const template = ITEM_TEMPLATES.find(item => item.id === templateId)!;
  const have = useMemo(() => new Set(existing.map(item => item.name.trim().toLowerCase())), [existing]);
  const fresh = template.items.filter(item => !have.has(item.name.toLowerCase()));
  useEffect(() => { if (isOpen) setTemplateId(ITEM_TEMPLATES[0].id); }, [isOpen]);
  useEffect(() => { setPicked(fresh.map(item => item.name)); }, [templateId, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!picked.length || saving) return;
    setSaving(true);
    try {
      const created: EventItem[] = await api.createEventItems(event.id, template.items.filter(item => picked.includes(item.name)));
      toast.success(`${created.length} ${created.length === 1 ? 'item adicionado' : 'itens adicionados'}.`);
      onSaved(created); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível adicionar a lista.'); }
    finally { setSaving(false); }
  };

  return <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title="Lista pronta de itens" size="md"
    footer={<ModalFooter><Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>Cancelar</Button><Button size="sm" loading={saving} disabled={!picked.length} onClick={save}>{picked.length ? `Adicionar ${picked.length} ${picked.length === 1 ? 'item' : 'itens'}` : 'Adicionar'}</Button></ModalFooter>}>
    <div className="space-y-3">
      <Select label="Modelo" value={templateId} onChange={event => setTemplateId(event.target.value)} options={ITEM_TEMPLATES.map(item => ({ value: item.id, label: item.label }))} />
      <p className="text-xs text-slate-500">Desmarque o que não precisa. Depois de adicionados, você ajusta quantidades e quem leva cada item.</p>
      <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
        {template.items.map(item => { const already = have.has(item.name.toLowerCase()); return <li key={item.name}>
          <label className={`flex items-center gap-3 px-3 py-2 ${already ? 'bg-slate-50 opacity-70' : 'cursor-pointer hover:bg-slate-50'}`}>
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" disabled={already} checked={picked.includes(item.name)} onChange={() => setPicked(prev => prev.includes(item.name) ? prev.filter(name => name !== item.name) : [...prev, item.name])} />
            <span className="flex-1 text-[13px] text-slate-800">{item.name}</span><span className="text-xs text-slate-500">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</span>{already && <span className="text-xs text-emerald-700">Já na lista</span>}
          </label></li>; })}
      </ul>
    </div>
  </Modal>;
};
