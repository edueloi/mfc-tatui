
import React, { useState, useEffect, useRef } from 'react';
import { 
  UserRound, 
  MapPin, 
  Phone, 
  Heart, 
  Stethoscope, 
  User, 
  Briefcase, 
  BookOpen, 
  Shield, 
  Layers,
  CheckCircle2
} from 'lucide-react';
import { Member, MemberStatus, UserRoleType, BaseTeam } from '../types';
import { Button, Divider, Input, Select, Switch, DatePicker, CepInput } from './ui';
import { maskCPF, maskPhone, maskCEP, maskRG, unmask } from '../utils/masks';
import { api, photoSrc } from '../api';
import toast from 'react-hot-toast';

interface MemberFormProps {
  initialData?: Partial<Member>;
  teams: BaseTeam[];
  onSave: (data: Partial<Member>) => void | Promise<unknown>;
  onCancel: () => void;
  isEditing?: boolean;
}

const FormInput = ({ label, value, onChange, type = 'text', placeholder = '', mask, colSpan = 1 }: any) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = mask ? mask(e.target.value) : e.target.value;
    onChange(v);
  };
  return (
    <div className={colSpan === 2 ? 'sm:col-span-2' : ''}>
      <Input label={label} type={type} placeholder={placeholder} value={value} onChange={handleChange} />
    </div>
  );
};

const FormSelect = ({ label, value, onChange, options, colSpan = 1 }: any) => (
  <div className={colSpan === 2 ? 'sm:col-span-2' : ''}>
    <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}
      options={options.map((o: string) => ({ value: o, label: o }))} />
  </div>
);

const FormCheck = ({ label, checked, onChange }: any) => (
  <label className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 cursor-pointer hover:border-blue-400 transition-all">
    <Switch checked={checked} onCheckedChange={onChange} size="sm" />
    <span className="text-xs font-semibold text-zinc-600 uppercase tracking-normal">{label}</span>
  </label>
);

export const MemberForm: React.FC<MemberFormProps> = ({ initialData, teams, onSave, onCancel, isEditing }) => {
  const blank = {
    name: '', nickname: '', dob: '', rg: '', cpf: '', bloodType: 'O+', gender: 'Feminino',
    maritalStatus: 'Casado(a)', spouseName: '', spouseCpf: '', marriageDate: '',
    mfcDate: new Date().toISOString().split('T')[0], phone: '', emergencyPhone: '',
    street: '', number: '', neighborhood: '', zip: '', complement: '', city: 'Tatui',
    state: 'SP', condir: 'Sudeste', naturalness: '', father: '', mother: '', photoUrl: '',
    smoker: false, mobilityIssue: '', healthPlan: '', diet: '', medication: '',
    allergy: '', pcd: false, pcdDescription: '', profession: '', religion: 'Catolica',
    education: 'Superior completo', createAccess: false, email: '', username: '',
    password: '', role: UserRoleType.USUARIO, status: MemberStatus.AGUARDANDO, teamId: null as string | null,
    familyName: '', relationshipType: 'Titular', paysMonthly: true, isPaymentInactive: false,
  };

  const [form, setForm] = useState({ ...blank, ...initialData });
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => {
    if (!photoFile) { setPhotoPreview(''); return; }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const selectPhoto = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Selecione uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('A foto deve ter no máximo 5 MB.');
      return;
    }
    setPhotoError('');
    setPhotoFile(file);
  };

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      let photoUrl = form.photoUrl;
      if (photoFile) {
        ({ photoUrl } = await api.uploadMemberPhoto(photoFile));
        setForm(prev => ({ ...prev, photoUrl }));
        setPhotoFile(null);
      }
      await onSave({ ...form, photoUrl });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const [activeTab, setActiveTab] = useState<'pessoal' | 'familia' | 'contato' | 'endereco' | 'saude'>('pessoal');

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));
  const isBillingResponsible = ['Titular', 'Cônjuge'].includes(form.relationshipType || 'Titular');
  const isExemptFromMonthlyPayment = form.paysMonthly === false || form.isPaymentInactive === true;

  const setRelationshipType = (relationshipType: string) => {
    const canPay = ['Titular', 'Cônjuge'].includes(relationshipType);
    setForm(prev => ({
      ...prev,
      relationshipType,
      paysMonthly: canPay ? prev.paysMonthly : false,
      isPaymentInactive: canPay ? prev.isPaymentInactive : false
    }));
  };

  const requiredFilled = [form.name, form.cpf, form.phone, form.dob, form.mfcDate, form.city, form.state].filter(v => v && String(v).trim()).length;
  const completion = Math.round((requiredFilled / 7) * 100);


  return (
    <div className="space-y-4">
      {/* Progresso */}
      <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-normal text-zinc-400">Progresso do cadastro</span>
          <span className="text-xs font-semibold text-blue-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{completion}%</span>
        </div>
        <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-400 transition-all" style={{ width: `${completion}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-zinc-100">
        {(['pessoal', 'familia', 'contato', 'endereco', 'saude'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 rounded-t-lg font-semibold text-[10px] uppercase tracking-normal whitespace-nowrap transition-all border-b-2 ${
              activeTab === tab ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}>
            {tab === 'pessoal' ? 'Pessoal' : tab === 'familia' ? 'Família' : tab === 'contato' ? 'Contato' : tab === 'endereco' ? 'Endereço' : 'Saúde'}
          </button>
        ))}
      </div>

      {/* Conteúdo das tabs */}
      <div className="min-w-0">
        {activeTab === 'pessoal' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 flex items-center gap-3 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
              <div className="w-12 h-12 rounded-lg border-2 border-dashed border-zinc-300 flex items-center justify-center overflow-hidden shrink-0 bg-white">
                {photoPreview || form.photoUrl
                  ? <img src={photoPreview || photoSrc(form.photoUrl)} alt="Foto do MFCista" className="w-full h-full object-cover" />
                  : <UserRound className="w-5 h-5 text-zinc-300" />}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="ds-label">Foto do MFCista</p>
                <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Selecionar foto do MFCista" className="hidden" disabled={saving}
                  onChange={event => { selectPhoto(event.target.files?.[0]); event.target.value = ''; }} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => photoInput.current?.click()}>{photoFile || form.photoUrl ? 'Trocar foto' : 'Selecionar foto'}</Button>
                  {(photoFile || form.photoUrl) && <Button size="sm" variant="ghost" disabled={saving} onClick={() => { setPhotoFile(null); set('photoUrl', ''); setPhotoError(''); }}>Remover foto</Button>}
                </div>
                <p className="text-[11px] text-slate-500">JPG, PNG ou WebP, até 5 MB. A foto será enviada ao salvar.</p>
                {photoError && <p role="alert" className="text-xs text-red-600">{photoError}</p>}
              </div>
            </div>
            <FormInput label="Nome Completo" value={form.name} onChange={(v: string) => set('name', v)} colSpan={2} />
            <FormInput label="Apelido / Crachá" value={form.nickname} onChange={(v: string) => set('nickname', v)} />
            <DatePicker label="Data de Nascimento" value={form.dob} onChange={(v) => set('dob', v)} />
            <FormInput label="RG" value={form.rg} onChange={(v: string) => set('rg', v)} mask={maskRG} />
            <FormInput label="CPF" value={form.cpf} onChange={(v: string) => set('cpf', v)} mask={maskCPF} />
            <FormSelect label="Sexo" value={form.gender} onChange={(v: string) => set('gender', v)} options={['Feminino', 'Masculino', 'Outro']} />
            <FormSelect label="Tipo Sanguíneo" value={form.bloodType} onChange={(v: string) => set('bloodType', v)} options={['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']} />
            <DatePicker label="MFCista Desde" value={form.mfcDate} onChange={(v) => set('mfcDate', v)} />
            <Select label="Equipe Base" value={form.teamId || ''}
              onChange={e => set('teamId', e.target.value || null)}
              options={[{ value: '', label: 'Sem equipe' }, ...teams.map(t => ({ value: t.id, label: t.name }))]} />
            <FormInput label="Telefone Principal" value={form.phone} onChange={(v: string) => set('phone', v)} mask={maskPhone} />
            <FormInput label="E-mail" type="email" value={form.email} onChange={(v: string) => set('email', v)} colSpan={2} />
            {isEditing && (
              <FormSelect label="Status" value={form.status} onChange={(v: string) => set('status', v)}
                options={[MemberStatus.AGUARDANDO, MemberStatus.ATIVO, MemberStatus.INATIVO, MemberStatus.PENDENTE, MemberStatus.CONVIDADO]} />
            )}
          </div>
        )}

        {activeTab === 'familia' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Nome da Família" value={form.familyName || ''} onChange={(v: string) => set('familyName', v)} colSpan={2} />
            <FormSelect
              label="Vínculo na família"
              value={form.relationshipType || 'Titular'}
              onChange={setRelationshipType}
              options={['Titular', 'Cônjuge', 'Filho(a)', 'Pai/Mãe', 'Irmão/Irmã', 'Neto(a)', 'Sogro(a)', 'Outro']}
            />
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              {isBillingResponsible ? (
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch
                    checked={!isExemptFromMonthlyPayment}
                    onCheckedChange={(active) => setForm(prev => ({ ...prev, paysMonthly: active, isPaymentInactive: !active }))}
                    size="sm"
                  />
                  <span>
                    <span className="block text-xs font-semibold text-blue-900">Mensalidade ativa</span>
                    <span className="block text-[10px] font-medium text-blue-600">Desative para isentar este membro.</span>
                  </span>
                </label>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-blue-900">Dependente sem cobrança</p>
                  <p className="text-[10px] font-medium text-blue-600">Filhos e demais familiares não entram no cálculo.</p>
                </div>
              )}
            </div>
            <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-[11px] text-slate-600">
              A mensalidade é calculada somente para o titular e, quando houver, para o cônjuge. A família é apenas um agrupamento cadastral e não recebe cobrança própria.
            </div>
            <Divider className="sm:col-span-2" />
            <FormSelect label="Estado Civil" value={form.maritalStatus} onChange={(v: string) => set('maritalStatus', v)} options={['Casado(a)', 'Solteiro(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável']} />
            <DatePicker label="Data do Casamento" value={form.marriageDate} onChange={(v) => set('marriageDate', v)} />
            <FormInput label="Nome do Cônjuge" value={form.spouseName} onChange={(v: string) => set('spouseName', v)} colSpan={2} />
            <FormInput label="CPF do Cônjuge" value={form.spouseCpf} onChange={(v: string) => set('spouseCpf', v)} mask={maskCPF} />
            <Divider className="sm:col-span-2" />
            <FormInput label="Nome do Pai" value={form.father} onChange={(v: string) => set('father', v)} colSpan={2} />
            <FormInput label="Nome da Mãe" value={form.mother} onChange={(v: string) => set('mother', v)} colSpan={2} />
          </div>
        )}

        {activeTab === 'contato' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Telefone Emergência" value={form.emergencyPhone} onChange={(v: string) => set('emergencyPhone', v)} mask={maskPhone} colSpan={2} />
            <div className="sm:col-span-2 p-4 rounded-lg bg-blue-50 border border-blue-100">
               <p className="text-xs font-bold text-blue-800 mb-2 uppercase tracking-normal">Informações Profissionais</p>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput label="Profissão" value={form.profession} onChange={(v: string) => set('profession', v)} />
                  <FormSelect label="Escolaridade" value={form.education} onChange={(v: string) => set('education', v)} options={['Analfabeto', 'Fundamental incompleto', 'Fundamental completo', 'Médio incompleto', 'Médio completo', 'Superior incompleto', 'Superior completo', 'Pós-graduação']} />
                  <FormInput label="Religião" value={form.religion} onChange={(v: string) => set('religion', v)} />
                  <FormInput label="Naturalidade" value={form.naturalness} onChange={(v: string) => set('naturalness', v)} />
               </div>
            </div>
          </div>
        )}

        {activeTab === 'endereco' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CepInput value={form.zip} onChange={value => set('zip', value)} onAddress={address => setForm(prev => ({ ...prev, street: address.logradouro || '', neighborhood: address.bairro || '', city: address.localidade, state: address.uf, complement: prev.complement || address.complemento || '' }))} />
            <div />
            <FormInput label="Rua / Logradouro" value={form.street} onChange={(v: string) => set('street', v)} colSpan={2} />
            <FormInput label="Número" value={form.number} onChange={(v: string) => set('number', v)} />
            <FormInput label="Complemento" value={form.complement} onChange={(v: string) => set('complement', v)} />
            <FormInput label="Bairro" value={form.neighborhood} onChange={(v: string) => set('neighborhood', v)} />
            <FormInput label="Cidade" value={form.city} onChange={(v: string) => set('city', v)} />
            <FormSelect label="Estado" value={form.state} onChange={(v: string) => set('state', v)} options={['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']} />
            <FormSelect label="CONDIR" value={form.condir} onChange={(v: string) => set('condir', v)} options={['Norte','Nordeste','Centro-Oeste','Sudeste','Sul']} />
          </div>
        )}

        {activeTab === 'saude' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormCheck label="Fumante" checked={form.smoker} onChange={(v: boolean) => set('smoker', v)} />
            <FormCheck label="PCD (Deficiência)" checked={form.pcd} onChange={(v: boolean) => set('pcd', v)} />
            {form.pcd && <FormInput label="Descrição PCD" value={form.pcdDescription} onChange={(v: string) => set('pcdDescription', v)} colSpan={2} />}
            <FormInput label="Dificuldade de Locomoção" value={form.mobilityIssue} onChange={(v: string) => set('mobilityIssue', v)} />
            <FormInput label="Plano de Saúde" value={form.healthPlan} onChange={(v: string) => set('healthPlan', v)} />
            <FormInput label="Restrição Alimentar" value={form.diet} onChange={(v: string) => set('diet', v)} />
            <FormInput label="Medicação em Uso" value={form.medication} onChange={(v: string) => set('medication', v)} />
            <FormInput label="Alergia Conhecida" value={form.allergy} onChange={(v: string) => set('allergy', v)} colSpan={2} />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
        <Button variant="ghost" size="sm" disabled={saving} onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" size="sm" loading={saving} onClick={save}>Salvar Alterações</Button>
      </div>
    </div>
  );
};
