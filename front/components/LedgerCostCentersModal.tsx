import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Plus, FolderOpen } from 'lucide-react';
import { api } from '../api';
import { CostCenter } from '../utils/ledger';
import { usePermission } from '../src/hooks/usePermission';
import { Modal, ModalFooter, Button, Input, GridTable, IconButton, Badge, ConfirmModal, EmptyState } from './ui';

export function LedgerCostCentersModal({ isOpen, onClose, onChanged }: { isOpen: boolean; onClose: () => void; onChanged: () => void }) {
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remove, setRemove] = useState<CostCenter | null>(null);
  const canCreate = usePermission('livro-caixa', 'create');
  const canEdit = usePermission('livro-caixa', 'edit');
  const canDelete = usePermission('livro-caixa', 'delete');
  const load = async () => { setLoading(true); setError(''); try { setCenters(await api.getCostCenters()); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } };
  useEffect(() => { if (isOpen) { load(); setShowForm(false); } }, [isOpen]);
  const edit = (center: CostCenter | null) => { setEditing(center); setForm(center ? { name: center.name, description: center.description } : { name: '', description: '' }); setShowForm(true); };
  const save = async () => {
    if (saving || (editing ? !canEdit : !canCreate)) return;
    if (form.name.trim().length < 2) return toast.error('Informe o nome do centro de custo.');
    setSaving(true);
    try { if (editing) await api.updateCostCenter(editing.id, form); else await api.createCostCenter(form); setShowForm(false); await load(); onChanged(); toast.success('Centro de custo salvo.'); }
    catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };
  const del = async () => { if (!remove || saving || !canDelete) return; setSaving(true); try { await api.deleteCostCenter(remove.id); setRemove(null); await load(); onChanged(); toast.success('Centro de custo excluído.'); } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); } };
  return <>
    <Modal isOpen={isOpen} onClose={() => { if (!saving) onClose(); }} title="Centros de custo" size="xl" footer={<ModalFooter><Button variant="ghost" onClick={onClose} disabled={saving}>Fechar</Button>{canCreate && <Button iconLeft={<Plus size={14} />} onClick={() => edit(null)}>Novo centro</Button>}</ModalFooter>}>
      <div className="space-y-3"><p className="text-xs text-slate-500">Cadastre áreas como Livraria, Sede e Bazar. Eventos e encontros de noivos recebem um centro vinculado automaticamente. Renomear atualiza a classificação dos lançamentos existentes.</p>
        <Input aria-label="Buscar centro" placeholder="Buscar centro de custo…" value={search} onChange={e => setSearch(e.target.value)} />
        {error ? <EmptyState icon={FolderOpen} title="Não foi possível carregar" description={error} action={<Button onClick={load}>Tentar novamente</Button>} /> : <GridTable<CostCenter> data={centers.filter(c => c.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))} keyExtractor={c => c.id} isLoading={loading} columns={[
          { header: 'Centro', render: c => <div className="text-xs"><strong>{c.name}</strong><p className="text-slate-500">{c.description}</p></div> },
          { header: 'Origem', render: c => <Badge color={c.eventId ? 'info' : 'default'}>{c.eventId ? 'Evento / encontro' : 'Manual'}</Badge> },
          { header: 'Lançamentos', render: c => c.entryCount },
          { header: 'Ações', render: c => <div className="flex gap-1">{canEdit && <IconButton aria-label={'Editar ' + c.name} variant="ghost" onClick={() => edit(c)}><Pencil size={15} /></IconButton>}{canDelete && <IconButton aria-label={'Excluir ' + c.name} variant="ghost" onClick={() => setRemove(c)}><Trash2 size={15} className="text-red-600" /></IconButton>}</div> },
        ]} emptyMessage="Nenhum centro de custo encontrado." />}
      </div>
    </Modal>
    <Modal isOpen={isOpen && showForm} onClose={() => { if (!saving) setShowForm(false); }} title={editing ? 'Editar centro de custo' : 'Novo centro de custo'} size="md" footer={<ModalFooter><Button variant="ghost" disabled={saving} onClick={() => setShowForm(false)}>Cancelar</Button><Button loading={saving} onClick={save}>Salvar</Button></ModalFooter>}><div className="space-y-3"><Input label="Nome" maxLength={160} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><Input label="Descrição" maxLength={500} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div></Modal>
    <ConfirmModal isOpen={!!remove} onClose={() => setRemove(null)} onConfirm={del} loading={saving} title="Excluir centro de custo?" message={remove?.entryCount ? `Este centro tem ${remove.entryCount} lançamentos. Reclassifique-os antes de excluir; o histórico financeiro será preservado.` : `Excluir “${remove?.name}”? Centros vinculados a eventos excluídos aqui não serão recriados automaticamente.`} confirmLabel="Excluir centro" variant="danger" />
  </>;
}
