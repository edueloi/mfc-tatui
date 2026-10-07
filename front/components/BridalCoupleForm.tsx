import React, { useState, useEffect } from 'react';
import {
  User,
  MapPin,
  CreditCard,
  FileText,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Heart,
  Calendar,
} from 'lucide-react';
import { BridalPartner, BridalCoupleStatus, BridalPaymentStatus, BridalMeeting } from '../types';
import { Button, Input, Select, DatePicker, Combobox, FileUpload, CepInput } from './ui';
import type { CepAddress } from './ui';
import type { UploadedFileItem } from './ui';
import { maskPhone, maskCEP, unmask } from '../utils/masks';
import { EDUCATION_LEVELS, RELIGIONS } from '../utils/domainLists';
import { api } from '../api';
import toast from 'react-hot-toast';

const blankPartner = (role: 'noivo' | 'noiva'): BridalPartner => ({
  role,
  name: '',
  dob: '',
  profession: '',
  education: '',
  religion: '',
  parish: '',
  phone: '',
  email: '',
  street: '',
  number: '',
  neighborhood: '',
  zip: '',
  complement: '',
  city: '',
  state: '',
});

export interface BridalCoupleFormData {
  status: BridalCoupleStatus;
  eventId: string | null;
  paymentStatus: BridalPaymentStatus;
  paymentAmount: number | null;
  paymentDate: string;
  paymentMethod: string;
  paymentObservation: string;
  noivo: BridalPartner;
  noiva: BridalPartner;
}

interface BridalCoupleFormProps {
  initialData?: Partial<BridalCoupleFormData>;
  mode: 'internal' | 'public';
  /** Pré-seleciona o Encontro ao criar uma nova ficha de dentro de uma turma específica. */
  defaultEventId?: string | null;
  onSave: (data: BridalCoupleFormData) => Promise<void> | void;
  onCancel?: () => void;
  saving?: boolean;
  documents?: UploadedFileItem[];
  onUploadDocument?: (file: File) => Promise<void> | void;
  onRemoveDocument?: (id: string) => Promise<void> | void;
}

type Step = 'casal' | 'endereco' | 'pagamento' | 'documentos' | 'revisao';

const PARTNER_ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
].map(uf => ({ value: uf, label: uf }));

const PartnerBlock = ({
  role,
  partner,
  onChange,
}: {
  role: 'noivo' | 'noiva';
  partner: BridalPartner;
  onChange: (field: keyof BridalPartner, value: any) => void;
}) => (
  <div className="flex-1 space-y-4">
    <div className="flex items-center gap-2 text-blue-600">
      <Heart className="w-4 h-4" />
      <h4 className="text-xs font-bold uppercase tracking-normal">{role === 'noivo' ? 'Noivo' : 'Noiva'}</h4>
    </div>
    <Input
      label="Nome Completo"
      value={partner.name}
      onChange={(e) => onChange('name', e.target.value)}
      placeholder="Nome completo"
    />
    <div className="grid grid-cols-2 gap-3">
      <DatePicker
        label="Data de Nascimento"
        value={partner.dob}
        onChange={(v) => onChange('dob', v || '')}
      />
      <Input
        label="Telefone"
        value={partner.phone}
        onChange={(e) => onChange('phone', maskPhone(e.target.value))}
        placeholder="(00) 00000-0000"
      />
    </div>
    <Input
      label="Profissão"
      value={partner.profession}
      onChange={(e) => onChange('profession', e.target.value)}
      placeholder="Profissão"
    />
    <Select
      label="Escolaridade"
      value={partner.education}
      onChange={(e) => onChange('education', e.target.value)}
      options={EDUCATION_LEVELS}
      placeholder="Selecione"
    />
    <div className="flex flex-col gap-1.5">
      <label className="ds-label">Religião</label>
      <Combobox
        value={partner.religion}
        onChange={(v) => onChange('religion', v as string)}
        options={RELIGIONS}
        allowCustom
        placeholder="Selecione ou busque"
        searchPlaceholder="Buscar religião..."
      />
    </div>
    <Input
      label="Paróquia"
      value={partner.parish}
      onChange={(e) => onChange('parish', e.target.value)}
      placeholder="Nome da paróquia"
    />
    <Input
      label="E-mail"
      type="email"
      value={partner.email}
      onChange={(e) => onChange('email', e.target.value)}
      placeholder="email@exemplo.com"
    />
  </div>
);

const AddressBlock = ({
  role,
  partner,
  onChange,
  onAddress,
}: {
  role: 'noivo' | 'noiva';
  partner: BridalPartner;
  onChange: (field: keyof BridalPartner, value: any) => void;
  onAddress: (address: CepAddress) => void;
}) => (
  <div className="flex-1 space-y-4">
    <div className="flex items-center gap-2 text-blue-600">
      <MapPin className="w-4 h-4" />
      <h4 className="text-xs font-bold uppercase tracking-normal">{role === 'noivo' ? 'Noivo' : 'Noiva'}</h4>
    </div>
    <CepInput
      value={partner.zip}
      onChange={value => onChange('zip', value)}
      onAddress={onAddress}
    />
    <div className="grid grid-cols-3 gap-3">
      <Input
        label="Rua"
        value={partner.street}
        onChange={(e) => onChange('street', e.target.value)}
        wrapperClassName="col-span-2"
      />
      <Input
        label="Número"
        value={partner.number}
        onChange={(e) => onChange('number', e.target.value)}
      />
    </div>
    <Input
      label="Bairro"
      value={partner.neighborhood}
      onChange={(e) => onChange('neighborhood', e.target.value)}
    />
    <Input label="Complemento" value={partner.complement || ''} onChange={e => onChange('complement', e.target.value)} />
    <div className="grid grid-cols-2 gap-3">
      <Input
        label="Cidade"
        value={partner.city}
        onChange={(e) => onChange('city', e.target.value)}
      />
      <Select
        label="Estado"
        value={partner.state}
        onChange={(e) => onChange('state', e.target.value)}
        options={PARTNER_ESTADOS}
        placeholder="UF"
      />
    </div>
  </div>
);

export const BridalCoupleForm: React.FC<BridalCoupleFormProps> = ({
  initialData,
  mode,
  defaultEventId = null,
  onSave,
  onCancel,
  saving = false,
  documents = [],
  onUploadDocument,
  onRemoveDocument,
}) => {
  const steps: Step[] = mode === 'public'
    ? ['casal', 'endereco', 'documentos', 'revisao']
    : ['casal', 'endereco', 'pagamento', 'documentos', 'revisao'];

  const [stepIndex, setStepIndex] = useState(0);
  const [noivo, setNoivo] = useState<BridalPartner>({ ...blankPartner('noivo'), ...initialData?.noivo });
  const [noiva, setNoiva] = useState<BridalPartner>({ ...blankPartner('noiva'), ...initialData?.noiva });
  const [status, setStatus] = useState<BridalCoupleStatus>(initialData?.status || 'Rascunho');
  const [eventId, setEventId] = useState<string | null>(initialData?.eventId ?? defaultEventId);
  const [paymentStatus, setPaymentStatus] = useState<BridalPaymentStatus>(initialData?.paymentStatus || 'Pendente');
  const [paymentAmount, setPaymentAmount] = useState<number | null>(initialData?.paymentAmount ?? null);
  const [paymentDate, setPaymentDate] = useState(initialData?.paymentDate || '');
  const [paymentMethod, setPaymentMethod] = useState(initialData?.paymentMethod || '');
  const [paymentObservation, setPaymentObservation] = useState(initialData?.paymentObservation || '');
  const [meetings, setMeetings] = useState<BridalMeeting[]>([]);

  useEffect(() => {
    if (mode === 'internal') {
      api.getBridalMeetings().then(setMeetings).catch(() => setMeetings([]));
    }
  }, [mode]);

  const currentStep = steps[stepIndex];

  const setPartner = (role: 'noivo' | 'noiva', field: keyof BridalPartner, value: any) => {
    const setter = role === 'noivo' ? setNoivo : setNoiva;
    setter(prev => ({ ...prev, [field]: value }));
  };

  const applyAddress = (role: 'noivo' | 'noiva', data: CepAddress) => {
    const setter = role === 'noivo' ? setNoivo : setNoiva;
    setter(prev => ({ ...prev, street: data.logradouro || '', neighborhood: data.bairro || '', city: data.localidade, state: data.uf, complement: prev.complement || data.complemento || '' }));
  };

  const goNext = () => setStepIndex(i => Math.min(i + 1, steps.length - 1));
  const goBack = () => setStepIndex(i => Math.max(i - 1, 0));

  const handleSubmit = async () => {
    await onSave({
      status,
      eventId,
      paymentStatus,
      paymentAmount,
      paymentDate,
      paymentMethod,
      paymentObservation,
      noivo,
      noiva,
    });
  };

  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  const stepLabels: Record<Step, string> = {
    casal: 'Dados do Casal',
    endereco: 'Endereço',
    pagamento: 'Pagamento',
    documentos: 'Documentos',
    revisao: 'Revisão',
  };

  const stepIcons: Record<Step, React.ElementType> = {
    casal: User,
    endereco: MapPin,
    pagamento: CreditCard,
    documentos: FileText,
    revisao: CheckCircle2,
  };

  return (
    <div className="space-y-4">
      {/* Progresso */}
      <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
        <div className="flex items-center justify-between mb-2">
          {steps.map((s, i) => {
            const Icon = stepIcons[s];
            const active = i === stepIndex;
            const done = i < stepIndex;
            return (
              <div key={s} className="flex items-center gap-1.5 flex-1">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
                  active ? 'bg-blue-600 text-white' : done ? 'bg-blue-100 text-blue-600' : 'bg-zinc-200 text-zinc-400'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wide hidden sm:inline ${active ? 'text-blue-600' : 'text-zinc-400'}`}>
                  {stepLabels[s]}
                </span>
              </div>
            );
          })}
        </div>
        <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="min-h-[320px]">
        {currentStep === 'casal' && (
          <div className="space-y-5">
            {mode === 'internal' && (
              <div className="max-w-sm">
                <Select
                  label="Encontro"
                  value={eventId || ''}
                  onChange={(e) => setEventId(e.target.value || null)}
                  options={meetings.map(m => ({ value: m.id, label: `${m.name} — ${m.date}` }))}
                  placeholder="Selecione o encontro"
                  iconLeft={<Calendar className="w-4 h-4" />}
                />
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-6">
              <PartnerBlock role="noivo" partner={noivo} onChange={(field, value) => setPartner('noivo', field, value)} />
              <div className="hidden sm:block w-px bg-zinc-100" />
              <PartnerBlock role="noiva" partner={noiva} onChange={(field, value) => setPartner('noiva', field, value)} />
            </div>
          </div>
        )}

        {currentStep === 'endereco' && (
          <div className="flex flex-col sm:flex-row gap-6">
            <AddressBlock
              role="noivo"
              partner={noivo}
              onChange={(field, value) => setPartner('noivo', field, value)}
              onAddress={(address) => applyAddress('noivo', address)}
            />
            <div className="hidden sm:block w-px bg-zinc-100" />
            <AddressBlock
              role="noiva"
              partner={noiva}
              onChange={(field, value) => setPartner('noiva', field, value)}
              onAddress={(address) => applyAddress('noiva', address)}
            />
          </div>
        )}

        {currentStep === 'pagamento' && (
          <div className="space-y-4 max-w-md">
            <Select
              label="Status do Pagamento"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as BridalPaymentStatus)}
              options={[
                { value: 'Pendente', label: 'Pendente' },
                { value: 'Parcial', label: 'Parcial' },
                { value: 'Pago', label: 'Pago' },
                { value: 'Isento', label: 'Isento' },
              ]}
            />
            <Input
              label="Valor"
              type="number"
              addonLeft="R$"
              value={paymentAmount ?? ''}
              onChange={(e) => setPaymentAmount(e.target.value ? parseFloat(e.target.value) : null)}
            />
            <DatePicker
              label="Data do Pagamento"
              value={paymentDate}
              onChange={(v) => setPaymentDate(v || '')}
            />
            <Input
              label="Forma de Pagamento"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="Pix, dinheiro, cartão..."
            />
          </div>
        )}

        {currentStep === 'documentos' && (
          <div className="max-w-md space-y-2">
            {onUploadDocument && onRemoveDocument ? (
              <FileUpload
                label="Documentos do Casal"
                hint="RG, certidão de nascimento, comprovante de residência, etc."
                files={documents}
                onUpload={onUploadDocument}
                onRemove={onRemoveDocument}
              />
            ) : (
              <p className="text-sm text-zinc-400 italic">Salve a ficha antes de anexar documentos.</p>
            )}
          </div>
        )}

        {currentStep === 'revisao' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[noivo, noiva].map((p) => (
                <div key={p.role} className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-normal text-blue-600">{p.role === 'noivo' ? 'Noivo' : 'Noiva'}</p>
                  <p className="text-sm font-semibold text-zinc-800">{p.name || '—'}</p>
                  <p className="text-xs text-zinc-500">{p.phone || '—'} · {p.email || '—'}</p>
                  <p className="text-xs text-zinc-500">{p.profession || '—'}</p>
                  <p className="text-xs text-zinc-500">{p.city ? `${p.city}/${p.state}` : '—'}</p>
                </div>
              ))}
            </div>
            {mode === 'internal' && (
              <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200">
                <p className="text-xs font-bold uppercase tracking-normal text-blue-600 mb-1">Pagamento</p>
                <p className="text-sm text-zinc-700">{paymentStatus} {paymentAmount ? `— R$ ${paymentAmount.toFixed(2)}` : ''}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
        <div>
          {stepIndex > 0 ? (
            <Button variant="ghost" onClick={goBack} iconLeft={<ChevronLeft className="w-4 h-4" />}>
              Voltar
            </Button>
          ) : onCancel ? (
            <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          ) : null}
        </div>
        <div>
          {stepIndex < steps.length - 1 ? (
            <Button variant="primary" onClick={goNext} iconRight={<ChevronRight className="w-4 h-4" />}>
              Próximo
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSubmit} loading={saving}>
              {mode === 'public' ? 'Enviar Inscrição' : 'Salvar Ficha'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
