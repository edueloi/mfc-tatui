import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { api, API_BASE_URL } from '../api';
import { NucleationGroup } from '../types';
import { Badge, Button, Modal, ModalFooter, Select } from './ui';
import { maskPhone } from '../utils/masks';

interface ImportPerson { name: string; dob: string; birthplace: string; education: string; profession: string; religion: string; parish: string; phone: string; email: string; }
interface ImportCouple {
  id: string; number: string; lines: number[];
  noivo: ImportPerson; noiva: ImportPerson;
  street: string; city: string; state: string;
  weddingDate: string; weddingParish: string; meetingDate: string; notes: string;
  warnings: string[]; duplicate: boolean; duplicateReason: string; duplicateOf: string;
}
interface Preview { fileName: string; sheet: string; peopleRows: number; couples: ImportCouple[]; }
interface ImportResult { imported: number; skipped: string[]; failed: { label: string; error: string }[]; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  groups: NucleationGroup[];
  /** Chamado depois de importar, para recarregar a lista. */
  onImported: () => void;
}

type Step = 'arquivo' | 'revisao' | 'resultado';
const STEP_LABEL: Record<Step, string> = { arquivo: '1. Arquivo', revisao: '2. Conferir', resultado: '3. Pronto' };

export const NucleationImportModal: React.FC<Props> = ({ isOpen, onClose, groups, onImported }) => {
  const [step, setStep] = useState<Step>('arquivo');
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupId, setGroupId] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = reading || saving;

  useEffect(() => {
    if (!isOpen) return;
    setStep('arquivo'); setPreview(null); setSelected(new Set()); setResult(null); setError(''); setGroupId('');
  }, [isOpen]);

  const readFile = async (file?: File | null) => {
    if (!file || busy) return;
    setError('');
    if (!/\.xlsx$/i.test(file.name)) { setError('Use uma planilha do Excel no formato .xlsx.'); return; }
    setReading(true);
    try {
      const data: Preview = await api.previewNucleationImport(file);
      setPreview(data);
      setSelected(new Set(data.couples.filter(couple => !couple.duplicate).map(couple => couple.id)));
      setStep('revisao');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler a planilha.');
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const stats = useMemo(() => {
    const couples = preview?.couples || [];
    return {
      total: couples.length,
      fresh: couples.filter(couple => !couple.duplicate).length,
      duplicates: couples.filter(couple => couple.duplicate).length,
      withWarnings: couples.filter(couple => !couple.duplicate && couple.warnings.length).length,
    };
  }, [preview]);

  const toggle = (id: string) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allFresh = preview ? preview.couples.filter(couple => !couple.duplicate) : [];
  const allChecked = allFresh.length > 0 && allFresh.every(couple => selected.has(couple.id));

  const confirm = async () => {
    if (!preview || saving || !selected.size) return;
    setSaving(true);
    try {
      const couples = preview.couples.filter(couple => selected.has(couple.id));
      const data: ImportResult = await api.commitNucleationImport({ couples, groupId: groupId || undefined });
      setResult(data);
      setStep('resultado');
      if (data.imported) { toast.success(`${data.imported} ${data.imported === 1 ? 'casal importado' : 'casais importados'}.`); onImported(); }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível importar.');
    } finally {
      setSaving(false);
    }
  };

  const close = () => { if (!busy) onClose(); };

  const footer = <ModalFooter>
    {step === 'arquivo' && <Button variant="ghost" size="sm" disabled={busy} onClick={close}>Cancelar</Button>}
    {step === 'revisao' && <>
      <Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancelar</Button>
      <Button variant="outline" size="sm" disabled={saving} onClick={() => { setStep('arquivo'); setPreview(null); }}>Trocar arquivo</Button>
      <Button size="sm" loading={saving} disabled={!selected.size} iconLeft={<Upload size={14} />} onClick={confirm}>
        Importar {selected.size} {selected.size === 1 ? 'casal' : 'casais'}
      </Button>
    </>}
    {step === 'resultado' && <Button size="sm" onClick={onClose}>Concluir</Button>}
  </ModalFooter>;

  return <Modal isOpen={isOpen} onClose={close} title="Importar planilha de inscrições" size="2xl" footer={footer}>
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-2" aria-label="Etapas da importação">
        {(Object.keys(STEP_LABEL) as Step[]).map(key => <li key={key}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${key === step ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-500'}`}>{STEP_LABEL[key]}</li>)}
      </ol>

      {step === 'arquivo' && <div className="space-y-4">
        <label onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={event => { event.preventDefault(); setDragging(false); readFile(event.dataTransfer.files?.[0]); }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'}`}>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-blue-100 text-blue-600"><FileSpreadsheet size={24} /></span>
          <span className="text-sm font-semibold text-slate-800">{reading ? 'Lendo a planilha…' : 'Escolha ou arraste a planilha aqui'}</span>
          <span className="text-xs text-slate-500">Arquivo do Excel (.xlsx) com as inscrições do Encontro de Noivos.</span>
          <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={busy}
            onChange={event => readFile(event.target.files?.[0])} />
        </label>
        {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{error}</p>}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
            <p className="mb-1.5 font-semibold text-slate-800">Como a planilha deve ser</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Uma linha por pessoa: a <b>primeira</b> do casal é o noivo e a <b>segunda</b> é a noiva.</li>
              <li>O número da coluna <b>Casal</b> liga as duas linhas.</li>
              <li>Colunas lidas: nome, nascimento, naturalidade, escolaridade, profissão, religião, paróquia, endereço, cidade, telefone, e-mail, data e paróquia do casamento, data do encontro e observações.</li>
              <li>Você confere tudo antes de gravar. Casais já cadastrados são reconhecidos e pulados.</li>
            </ul>
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <Select label="Colocar os casais em um grupo (opcional)" value={groupId} onChange={event => setGroupId(event.target.value)}
              options={[{ value: '', label: 'Sem grupo' }, ...groups.map(group => ({ value: group.id, label: group.name }))]} />
            <a href={`${API_BASE_URL}/nucleation/import/template`} download className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"><Download size={14} />Baixar planilha modelo</a>
          </div>
        </div>
      </div>}

      {step === 'revisao' && preview && <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-800">{preview.fileName}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600">aba “{preview.sheet}” · {preview.peopleRows} {preview.peopleRows === 1 ? 'pessoa' : 'pessoas'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge color="info">{stats.total} {stats.total === 1 ? 'casal encontrado' : 'casais encontrados'}</Badge>
          <Badge color="success">{stats.fresh} {stats.fresh === 1 ? 'novo' : 'novos'}</Badge>
          {stats.duplicates > 0 && <Badge color="warning">{stats.duplicates} já {stats.duplicates === 1 ? 'cadastrado' : 'cadastrados'} (pulados)</Badge>}
          {stats.withWarnings > 0 && <Badge color="default">{stats.withWarnings} com avisos</Badge>}
        </div>

        <ul className="max-h-[52vh] space-y-2 overflow-auto sm:hidden">
          {preview.couples.map(couple => <li key={couple.id} className={`rounded-xl border p-3 text-xs ${couple.duplicate ? 'border-amber-200 bg-amber-50/50 text-slate-500' : 'border-slate-200 bg-white'}`}>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-0.5" aria-label={`Importar casal ${couple.number}`} checked={selected.has(couple.id)} disabled={couple.duplicate} onChange={() => toggle(couple.id)} />
              <span className="min-w-0 flex-1">
                <span className="mb-1 flex items-center justify-between gap-2"><span className="font-semibold text-slate-700">Casal {couple.number}{[couple.city, couple.state].filter(Boolean).length ? ` · ${[couple.city, couple.state].filter(Boolean).join('/')}` : ''}</span>
                  {couple.duplicate ? <Badge size="sm" color="warning">{couple.duplicateReason}</Badge> : <Badge size="sm" color="success">Novo</Badge>}</span>
                <span className="block font-medium text-slate-800 [overflow-wrap:anywhere]">{couple.noivo.name || '—'} <span className="font-normal text-slate-500">· {couple.noivo.phone ? maskPhone(couple.noivo.phone) : 'sem telefone'}</span></span>
                <span className="block font-medium text-slate-800 [overflow-wrap:anywhere]">{couple.noiva.name || '—'} <span className="font-normal text-slate-500">· {couple.noiva.phone ? maskPhone(couple.noiva.phone) : 'sem telefone'}</span></span>
                {!couple.duplicate && couple.warnings.map(warning => <span key={warning} className="mt-1 flex items-start gap-1 text-[11px] text-amber-700"><AlertTriangle size={11} className="mt-0.5 shrink-0" />{warning}</span>)}
              </span>
            </label>
          </li>)}
        </ul>

        <div className="hidden max-h-[48vh] overflow-auto rounded-xl border border-slate-200 sm:block">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="w-9 px-3 py-2"><input type="checkbox" aria-label="Marcar todos os novos" checked={allChecked} disabled={!allFresh.length}
                  onChange={() => setSelected(allChecked ? new Set() : new Set(allFresh.map(couple => couple.id)))} /></th>
                <th className="px-2 py-2">Casal</th><th className="px-2 py-2">Noivo</th><th className="px-2 py-2">Noiva</th><th className="px-2 py-2">Cidade</th><th className="px-2 py-2">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.couples.map(couple => <tr key={couple.id} className={couple.duplicate ? 'bg-amber-50/40 text-slate-500' : ''}>
                <td className="px-3 py-2 align-top"><input type="checkbox" aria-label={`Importar casal ${couple.number}`} checked={selected.has(couple.id)} disabled={couple.duplicate} onChange={() => toggle(couple.id)} /></td>
                <td className="px-2 py-2 align-top font-semibold text-slate-700">{couple.number}</td>
                <td className="px-2 py-2 align-top"><p className="font-medium text-slate-800 [overflow-wrap:anywhere]">{couple.noivo.name || '—'}</p><p className="text-slate-500">{couple.noivo.phone ? maskPhone(couple.noivo.phone) : 'sem telefone'}</p></td>
                <td className="px-2 py-2 align-top"><p className="font-medium text-slate-800 [overflow-wrap:anywhere]">{couple.noiva.name || '—'}</p><p className="text-slate-500">{couple.noiva.phone ? maskPhone(couple.noiva.phone) : 'sem telefone'}</p></td>
                <td className="px-2 py-2 align-top text-slate-600">{[couple.city, couple.state].filter(Boolean).join('/') || '—'}</td>
                <td className="px-2 py-2 align-top">
                  {couple.duplicate
                    ? <Badge size="sm" color="warning">{couple.duplicateReason}</Badge>
                    : <Badge size="sm" color="success">Novo</Badge>}
                  {!couple.duplicate && couple.warnings.map(warning => <p key={warning} className="mt-1 flex items-start gap-1 text-[11px] text-amber-700"><AlertTriangle size={11} className="mt-0.5 shrink-0" />{warning}</p>)}
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500">Os contatos entram como “Pendente”. Dá para editar qualquer dado depois, na página do contato.</p>
      </div>}

      {step === 'resultado' && result && <div className="space-y-3 py-2 text-center">
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${result.imported ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{result.imported ? <CheckCircle2 size={29} /> : <AlertTriangle size={29} />}</span>
        <h3 className="text-lg font-bold text-slate-900">{result.imported ? `${result.imported} ${result.imported === 1 ? 'casal importado' : 'casais importados'}` : 'Nenhum casal foi importado'}</h3>
        {result.skipped.length > 0 && <div className="mx-auto max-w-md rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-800"><p className="font-semibold">Já cadastrados, pulados ({result.skipped.length}):</p><p className="mt-1 [overflow-wrap:anywhere]">{result.skipped.join(' · ')}</p></div>}
        {result.failed.length > 0 && <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-3 text-left text-xs text-red-700"><p className="font-semibold">Não foi possível importar ({result.failed.length}):</p><ul className="mt-1 list-disc pl-4">{result.failed.map(item => <li key={item.label}>{item.label}: {item.error}</li>)}</ul></div>}
      </div>}
    </div>
  </Modal>;
};
