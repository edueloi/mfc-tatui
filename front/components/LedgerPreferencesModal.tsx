import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Modal, ModalFooter, Select } from './ui';
import { LedgerPreferences, defaultLedgerPreferences } from '../src/hooks/useLedgerPreferences';
import { monthNames } from '../utils/ledger';

export function LedgerPreferencesModal({ isOpen, onClose, value, onSave, years }: { isOpen: boolean; onClose: () => void; value: LedgerPreferences; onSave: (next: LedgerPreferences) => void; years: number[] }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (isOpen) setDraft(value); }, [isOpen, value]);
  return <Modal isOpen={isOpen} onClose={onClose} title="Preferências do Livro Caixa" size="md" footer={<ModalFooter>
    <Button variant="ghost" size="sm" onClick={() => setDraft(defaultLedgerPreferences)}>Restaurar padrão</Button>
    <Button size="sm" onClick={() => { try { onSave(draft); toast.success('Preferências salvas.'); onClose(); } catch { toast.error('O navegador não permitiu salvar as preferências.'); } }}>Salvar preferências</Button>
  </ModalFooter>}><div className="space-y-3">
    <p className="text-xs text-slate-500">Preferências deste usuário neste navegador. “Ano atual” acompanha automaticamente a mudança de ano.</p>
    <Select label="Ano ao abrir a lista" value={draft.year} onChange={e => setDraft({ ...draft, year: e.target.value })} options={[{ value: 'current', label: 'Ano atual (recomendado)' }, { value: 'all', label: 'Todos os anos' }, ...years.map(year => ({ value: String(year), label: String(year) }))]} />
    <Select label="Aba inicial do livro" value={draft.tab} onChange={e => setDraft({ ...draft, tab: e.target.value as LedgerPreferences['tab'] })} options={[{ value: 'lancamentos', label: 'Lançamentos' }, { value: 'pagar', label: 'Contas a pagar' }, { value: 'receber', label: 'Contas a receber' }, { value: 'balancete', label: 'Balancete' }, { value: 'grafico', label: 'Gráfico' }]} />
    <Select label="Mês inicial" value={draft.month} onChange={e => setDraft({ ...draft, month: e.target.value })} options={[{ value: 'all', label: 'Todos os meses' }, ...monthNames.map((label, i) => ({ value: String(i + 1), label }))]} />
    <Select label="Linhas por página" value={String(draft.pageSize)} onChange={e => setDraft({ ...draft, pageSize: Number(e.target.value) })} options={[10, 15, 25, 50, 100].map(n => ({ value: String(n), label: String(n) }))} />
  </div></Modal>;
}
