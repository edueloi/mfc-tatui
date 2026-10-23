import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Heart, MapPin, ClipboardList, Check } from 'lucide-react';
import { api } from '../api';
import { NucleationContact, NucleationGroup } from '../types';
import { Button, Combobox, CepInput, DatePicker, Input, Modal, ModalFooter, Select, Textarea } from './ui';
import type { CepAddress } from './ui';
import { maskPhone, unmask } from '../utils/masks';
import { EDUCATION_LEVELS, RELIGIONS } from '../utils/domainLists';

interface NucleationContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Chamado com o contato criado ou atualizado. */
  onCreated: (contact: NucleationContact) => void;
  /** Quando informado, o modal edita este contato em vez de criar um novo. */
  contact?: NucleationContact | null;
  groups?: NucleationGroup[];
}

type Role = 'noivo' | 'noiva';
type Step = 'casal' | 'endereco' | 'acompanhamento';

interface FormState {
  noivoName: string; noivoPhone: string; noivoEmail: string; noivoDob: string;
  noivaName: string; noivaPhone: string; noivaEmail: string; noivaDob: string;
  noivoProfession: string; noivoEducation: string; noivoReligion: string;
  noivaProfession: string; noivaEducation: string; noivaReligion: string;
  zip: string; street: string; number: string; neighborhood: string; complement: string; city: string; state: string;
  groupId: string; notes: string;
}

const blank: FormState = {
  noivoName: '', noivoPhone: '', noivoEmail: '', noivoDob: '',
  noivaName: '', noivaPhone: '', noivaEmail: '', noivaDob: '',
  noivoProfession: '', noivoEducation: '', noivoReligion: '',
  noivaProfession: '', noivaEducation: '', noivaReligion: '',
  zip: '', street: '', number: '', neighborhood: '', complement: '', city: '', state: '',
  groupId: '', notes: '',
};

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => ({ value: uf, label: uf }));
const STEPS: { id: Step; label: string; icon: typeof Heart }[] = [
  { id: 'casal', label: 'Casal', icon: Heart },
  { id: 'endereco', label: 'Endereço', icon: MapPin },
  { id: 'acompanhamento', label: 'Acompanhamento', icon: ClipboardList },
];

const phoneOk = (value: string) => !value || [10, 11].includes(unmask(value).length);
const emailOk = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const today = () => new Date().toISOString().slice(0, 10);
const dobOk = (value: string) => !value || value <= today();

const fromContact = (contact: NucleationContact): FormState => {
  // Contatos antigos só têm "Nome" e dois telefones: separa "Fulano & Fulana" quando der.
  const [legacyA, legacyB] = (contact.name || '').split(/\s+&\s+/);
  return {
    noivoName: contact.noivoName || (contact.noivaName ? '' : legacyA || ''),
    noivoPhone: maskPhone(contact.phone1 || ''), noivoEmail: contact.noivoEmail || '', noivoDob: contact.noivoDob || '',
    noivaName: contact.noivaName || (contact.noivoName ? '' : legacyB || ''),
    noivaPhone: maskPhone(contact.phone2 || ''), noivaEmail: contact.noivaEmail || '', noivaDob: contact.noivaDob || '',
    zip: contact.zip || '', street: contact.street || '', number: contact.number || '', neighborhood: contact.neighborhood || '',
    noivoProfession: contact.noivoProfession || '', noivoEducation: contact.noivoEducation || '', noivoReligion: contact.noivoReligion || '',
    noivaProfession: contact.noivaProfession || '', noivaEducation: contact.noivaEducation || '', noivaReligion: contact.noivaReligion || '',
    complement: contact.complement || '', city: contact.city || '', state: contact.state || '',
    groupId: contact.groupId || '', notes: contact.notes || '',
  };
};

const PartnerBlock: React.FC<{ role: Role; form: FormState; errors: Record<string, string>; touched: boolean; set: (patch: Partial<FormState>) => void }> = ({ role, form, errors, touched, set }) => {
  const k = (field: 'Name' | 'Phone' | 'Email' | 'Dob' | 'Profession' | 'Education' | 'Religion') => `${role}${field}` as keyof FormState;
  const isNoivo = role === 'noivo';
  const err = (key: string) => touched && errors[key] ? <p role="alert" className="mt-1 text-xs text-red-600">{errors[key]}</p> : null;
  return <div className={`min-w-0 flex-1 space-y-3 rounded-xl border p-4 ${isNoivo ? 'border-sky-100 bg-sky-50/55' : 'border-rose-100 bg-rose-50/55'}`}>
    <div className={`flex items-center gap-2 ${isNoivo ? 'text-sky-700' : 'text-rose-700'}`}>
      <Heart className="h-4 w-4" />
      <h4 className="text-xs font-bold uppercase tracking-normal">{isNoivo ? 'Noivo' : 'Noiva'}</h4>
    </div>
    <div><Input label="Nome completo" value={form[k('Name')]} onChange={event => set({ [k('Name')]: event.target.value })} placeholder="Nome completo" />{err(`${role}Name`)}</div>
    <div><Input label="Telefone / WhatsApp" inputMode="tel" value={form[k('Phone')]} onChange={event => set({ [k('Phone')]: maskPhone(event.target.value) })} placeholder="(00) 00000-0000" />{err(`${role}Phone`)}</div>
    <div><Input label="E-mail" type="email" inputMode="email" value={form[k('Email')]} onChange={event => set({ [k('Email')]: event.target.value })} placeholder="nome@email.com" />{err(`${role}Email`)}</div>
    <div><DatePicker label="Data de nascimento" value={form[k('Dob')]} onChange={value => set({ [k('Dob')]: value || '' })} />{err(`${role}Dob`)}</div>
    <Input label="Profissão" value={form[k('Profession')]} onChange={event => set({ [k('Profession')]: event.target.value })} placeholder="Profissão" />
    <div className="flex flex-col gap-1.5">
      <label className="ds-label">Escolaridade</label>
      <Combobox value={form[k('Education')]} onChange={value => set({ [k('Education')]: value as string })} options={EDUCATION_LEVELS}
        placeholder="Selecione ou busque" searchPlaceholder="Buscar escolaridade..." />
    </div>
    <div className="flex flex-col gap-1.5">
      <label className="ds-label">Religião</label>
      <Combobox value={form[k('Religion')]} onChange={value => set({ [k('Religion')]: value as string })} options={RELIGIONS} allowCustom
        placeholder="Selecione ou busque" searchPlaceholder="Buscar religião..." />
    </div>
  </div>;
};

export const NucleationContactModal: React.FC<NucleationContactModalProps> = ({ isOpen, onClose, onCreated, contact, groups = [] }) => {
  const editing = !!contact;
  const [form, setForm] = useState<FormState>(blank);
  const [step, setStep] = useState<Step>('casal');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groupOptions, setGroupOptions] = useState<NucleationGroup[]>(groups);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(contact ? fromContact(contact) : blank);
    setStep('casal'); setTouched(false);
  }, [isOpen, contact?.id]);

  // Se a tela não trouxe os grupos, busca aqui.
  useEffect(() => {
    if (!isOpen) return;
    if (groups.length) { setGroupOptions(groups); return; }
    api.getNucleationGroups().then((items: NucleationGroup[]) => setGroupOptions(items)).catch(() => setGroupOptions([]));
  }, [isOpen, groups]);

  const set = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));
  const applyAddress = (address: CepAddress) => set({
    street: address.logradouro || '', neighborhood: address.bairro || '', city: address.localidade || '', state: address.uf || '',
    complement: form.complement || address.complemento || '',
  });

  const errors: Record<string, string> = {};
  if (!form.noivoName.trim() && !form.noivaName.trim()) errors.noivoName = 'Informe o nome de ao menos um dos dois.';
  if (!form.noivoPhone && !form.noivaPhone) errors.noivoPhone = 'Informe ao menos um telefone.';
  if (!phoneOk(form.noivoPhone)) errors.noivoPhone = 'Telefone incompleto: use DDD + número.';
  if (!phoneOk(form.noivaPhone)) errors.noivaPhone = 'Telefone incompleto: use DDD + número.';
  if (!emailOk(form.noivoEmail)) errors.noivoEmail = 'E-mail inválido.';
  if (!emailOk(form.noivaEmail)) errors.noivaEmail = 'E-mail inválido.';
  if (!dobOk(form.noivoDob)) errors.noivoDob = 'A data não pode ser futura.';
  if (!dobOk(form.noivaDob)) errors.noivaDob = 'A data não pode ser futura.';
  const casalInvalid = ['noivoName', 'noivoPhone', 'noivoEmail', 'noivoDob', 'noivaPhone', 'noivaEmail', 'noivaDob'].some(key => errors[key]);
  const stepIndex = STEPS.findIndex(item => item.id === step);
  const isLast = stepIndex === STEPS.length - 1;

  const save = async () => {
    setTouched(true);
    if (casalInvalid) { setStep('casal'); toast.error('Confira os dados do casal.'); return; }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        noivoName: form.noivoName.trim(), noivoEmail: form.noivoEmail.trim(), noivoDob: form.noivoDob,
        noivaName: form.noivaName.trim(), noivaEmail: form.noivaEmail.trim(), noivaDob: form.noivaDob,
        noivoProfession: form.noivoProfession.trim(), noivoEducation: form.noivoEducation, noivoReligion: form.noivoReligion,
        noivaProfession: form.noivaProfession.trim(), noivaEducation: form.noivaEducation, noivaReligion: form.noivaReligion,
        phone1: unmask(form.noivoPhone), phone2: unmask(form.noivaPhone),
        zip: form.zip, street: form.street.trim(), number: form.number.trim(), neighborhood: form.neighborhood.trim(),
        complement: form.complement.trim(), city: form.city.trim(), state: form.state, notes: form.notes.trim(),
      };
      let saved: NucleationContact;
      if (editing && contact) {
        saved = await api.updateNucleationContact(contact.id, payload);
        if ((contact.groupId || '') !== form.groupId) saved = await api.setNucleationContactGroup(contact.id, form.groupId || null);
      } else {
        saved = await api.createNucleationContact({ ...payload, groupId: form.groupId || undefined });
      }
      const group = groupOptions.find(item => item.id === (saved.groupId || form.groupId));
      toast.success(editing ? 'Contato atualizado.' : 'Contato criado.');
      onCreated({ ...saved, groupName: saved.groupName || group?.name || null });
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o contato.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const close = () => { if (!saving) onClose(); };
  const next = () => { if (step === 'casal' && casalInvalid) { setTouched(true); return; } setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)].id); };

  return <Modal isOpen={isOpen} onClose={close} title={editing ? 'Editar contato de nucleação' : 'Novo contato de nucleação'} size="xl"
    footer={<ModalFooter>
      <Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancelar</Button>
      {stepIndex > 0 && <Button variant="outline" size="sm" disabled={saving} onClick={() => setStep(STEPS[stepIndex - 1].id)}>Voltar</Button>}
      {!isLast
        ? <Button size="sm" onClick={next}>Continuar</Button>
        : <Button size="sm" loading={saving} iconLeft={<Check size={14} />} onClick={save}>{editing ? 'Salvar alterações' : 'Criar contato'}</Button>}
      {!isLast && <Button variant="outline" size="sm" loading={saving} onClick={save}>{editing ? 'Salvar' : 'Criar agora'}</Button>}
    </ModalFooter>}>
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-2" aria-label="Etapas do cadastro">
        {STEPS.map((item, index) => {
          const Icon = item.icon;
          const active = item.id === step;
          const done = index < stepIndex;
          return <li key={item.id}>
            <button type="button" onClick={() => { if (index <= stepIndex || !casalInvalid) setStep(item.id); else setTouched(true); }} aria-current={active ? 'step' : undefined}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'border-blue-600 bg-blue-600 text-white' : done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
              {done ? <Check size={13} /> : <Icon size={13} />}{item.label}
            </button>
          </li>;
        })}
      </ol>

      {step === 'casal' && <div className="space-y-3">
        <p className="text-xs text-slate-500">Cadastre o casal como no Encontro de Noivos. Basta o nome e o telefone de um dos dois para criar o contato.</p>
        <div className="flex flex-col gap-3 md:flex-row">
          <PartnerBlock role="noivo" form={form} errors={errors} touched={touched} set={set} />
          <PartnerBlock role="noiva" form={form} errors={errors} touched={touched} set={set} />
        </div>
      </div>}

      {step === 'endereco' && <div className="mx-auto max-w-2xl space-y-3">
        <p className="text-xs text-slate-500">Opcional. Digite o CEP para preencher rua, bairro e cidade automaticamente.</p>
        <CepInput value={form.zip} onChange={value => set({ zip: value })} onAddress={applyAddress} />
        <Input label="Rua" value={form.street} onChange={event => set({ street: event.target.value })} />
        <div className="grid grid-cols-10 gap-3">
          <Input label="Número" value={form.number} onChange={event => set({ number: event.target.value })} wrapperClassName="col-span-3" />
          <Input label="Bairro" value={form.neighborhood} onChange={event => set({ neighborhood: event.target.value })} wrapperClassName="col-span-7" />
        </div>
        <Input label="Complemento" value={form.complement} onChange={event => set({ complement: event.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Cidade" value={form.city} onChange={event => set({ city: event.target.value })} />
          <div className="flex flex-col gap-1.5">
            <label className="ds-label">Estado</label>
            <Combobox value={form.state} onChange={value => set({ state: value as string })} options={STATES} placeholder="UF" searchPlaceholder="Buscar estado..." />
          </div>
        </div>
      </div>}

      {step === 'acompanhamento' && <div className="mx-auto max-w-2xl space-y-3">
        <p className="text-xs text-slate-500">Organize o contato em um grupo e deixe anotações para quem for fazer as ligações.</p>
        <Select label="Grupo de nucleação" value={form.groupId} onChange={event => set({ groupId: event.target.value })}
          options={[{ value: '', label: 'Sem grupo' }, ...groupOptions.map(group => ({ value: group.id, label: group.name }))]} />
        <Textarea label="Observações" rows={5} maxLength={2000} value={form.notes} onChange={event => set({ notes: event.target.value })}
          placeholder="Ex.: conheceram o MFC pelo Encontro de Noivos de agosto; melhor horário para ligar: à noite." />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Resumo</p>
          <p className="mt-1">{[form.noivoName.trim(), form.noivaName.trim()].filter(Boolean).join(' & ') || 'Sem nome informado'}</p>
          <p>{[form.noivoPhone, form.noivaPhone].filter(Boolean).join(' · ') || 'Sem telefone informado'}</p>
          {(form.city || form.street) && <p>{[form.street, form.number, form.neighborhood, form.city && `${form.city}${form.state ? '/' + form.state : ''}`].filter(Boolean).join(', ')}</p>}
        </div>
      </div>}
    </div>
  </Modal>;
};
