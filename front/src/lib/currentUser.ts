import type { User } from '../../types';

/** Usuário logado, guardado pelo login em localStorage. null se não houver ou estiver corrompido. */
export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem('mfc.currentUser');
    return raw ? JSON.parse(raw) as User : null;
  } catch { return null; }
}
