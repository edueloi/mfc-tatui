import { useState } from 'react';

export interface LedgerPreferences {
  year: string;
  month: string;
  pageSize: number;
  tab: 'lancamentos' | 'pagar' | 'receber' | 'balancete' | 'grafico';
}
export const defaultLedgerPreferences: LedgerPreferences = { year: 'current', month: 'all', pageSize: 15, tab: 'lancamentos' };

export function useLedgerPreferences(userId?: string) {
  const key = `mfc.ledger.preferences.v1.${userId || 'local'}`;
  const [preferences, setPreferences] = useState<LedgerPreferences>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      return {
        year: /^(current|all|\d{4})$/.test(saved.year) ? saved.year : 'current',
        month: /^(all|[1-9]|1[0-2])$/.test(saved.month) ? saved.month : 'all',
        pageSize: [10, 15, 25, 50, 100].includes(saved.pageSize) ? saved.pageSize : 15,
        tab: ['lancamentos', 'pagar', 'receber', 'balancete', 'grafico'].includes(saved.tab) ? saved.tab : 'lancamentos',
      };
    } catch { return defaultLedgerPreferences; }
  });
  const savePreferences = (next: LedgerPreferences) => {
    localStorage.setItem(key, JSON.stringify(next));
    setPreferences(next);
  };
  return { preferences, savePreferences };
}
