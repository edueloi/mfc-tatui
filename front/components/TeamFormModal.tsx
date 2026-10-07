import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { BaseTeam, City } from '../types';
import { Button, Input, Modal, ModalFooter, Select, Switch } from './ui';

interface TeamFormModalProps {
  isOpen: boolean;
  /** Equipe em edição; null cria uma nova. */
  team: BaseTeam | null;
  onClose: () => void;
  onSaved: (team: BaseTeam, mode: 'created' | 'updated') => void;
}

const emptyForm = { name: '', city: 'Tatuí', state: 'SP', isYouth: false };

export const TeamFormModal: React.FC<TeamFormModalProps> = ({ isOpen, team, onClose, onSaved }) => {
  const [form, setForm] = useState(emptyForm);
  const [cities, setCities] = useState<City[]>([]);
  const [estados, setEstados] = useState<Array<{ id: number; sigla: string; nome: string }>>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(team ? { name: team.name, city: team.city, state: team.state, isYouth: !!team.isYouth } : emptyForm);
    api.getCities().then((items: City[]) => {
      setCities(items);
      if (!team && items[0]) setForm(prev => ({ ...prev, city: items[0].name, state: items[0].uf }));
    }).catch(() => setCities([]));
    api.getEstados().then(setEstados).catch(() => setEstados([]));
  }, [isOpen, team]);

  const canSave = form.name.trim().length >= 3 && !!form.city.trim() && !!form.state.trim();

  const save = async (createAnother = false) => {
    if (!canSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim() };
      const saved: BaseTeam = team ? await api.updateTeam(team.id, payload) : await api.createTeam(payload);
      toast.success(team ? 'Equipe atualizada.' : 'Equipe criada.');
      onSaved(saved, team ? 'updated' : 'created');
      if (createAnother) setForm(prev => ({ ...prev, name: '', isYouth: false }));
      else onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a equipe.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const close = () => { if (!saving) onClose(); };

  return <Modal isOpen={isOpen} onClose={close} title={team ? 'Editar equipe' : 'Nova equipe'} size="sm"
    footer={<ModalFooter>
      {!team && <Button variant="outline" size="sm" disabled={!canSave || saving} onClick={() => save(true)}>Salvar e criar outra</Button>}
      <Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancelar</Button>
      <Button size="sm" loading={saving} disabled={!canSave} onClick={() => save()}>{team ? 'Salvar' : 'Criar equipe'}</Button>
    </ModalFooter>}>
    <div className="space-y-3">
      <Input label="Nome da equipe" placeholder="Ex.: Equipe São José" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Estado" value={form.state} onChange={event => setForm({ ...form, state: event.target.value })} options={estados.map(item => ({ value: item.sigla, label: item.sigla }))} />
        <Select label="Cidade" value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} options={cities.map(item => ({ value: item.name, label: item.name }))} />
      </div>
      <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 cursor-pointer">
        <Switch checked={form.isYouth} onCheckedChange={isYouth => setForm({ ...form, isYouth })} size="sm" />
        <span>
          <span className="block text-xs font-semibold text-slate-800">Equipe MFC Jovem</span>
          <span className="block text-[11px] text-slate-500">Marque se for uma equipe de jovens.</span>
        </span>
      </label>
      {form.name.trim().length > 0 && form.name.trim().length < 3 && <p role="alert" className="text-xs text-red-600">O nome precisa ter ao menos 3 letras.</p>}
    </div>
  </Modal>;
};
