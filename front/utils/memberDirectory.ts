import type { Member } from '../types';

export const normalizeDirectoryText = (value?: string | null) => (value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ');

export const professionKey = (value?: string | null) => normalizeDirectoryText(value) || '__missing__';

export function groupProfessions(members: Pick<Member, 'profession'>[]) {
  const groups = new Map<string, { key: string; label: string; count: number }>();
  for (const member of members) {
    const key = professionKey(member.profession);
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { key, label: member.profession?.trim().replace(/\s+/g, ' ') || 'Não informada', count: 1 });
  }
  return [...groups.values()].sort((a, b) => a.key === '__missing__' ? 1 : b.key === '__missing__' ? -1 : a.label.localeCompare(b.label, 'pt-BR'));
}

export function matchesDirectorySearch(member: Partial<Member>, search: string) {
  const query = normalizeDirectoryText(search);
  if (!query) return true;
  const text = normalizeDirectoryText([member.name, member.nickname, member.familyName, member.profession].filter(Boolean).join(' '));
  // Telefones e CPF também podem ser procurados com ou sem pontuação.
  const digits = search.replace(/\D/g, '');
  const isNumberQuery = /^[\d\s()+.\-]+$/.test(query) && digits.length > 0;
  return query.split(' ').every(part => text.includes(part)) || (isNumberQuery && [member.phone, member.cpf].some(value => (value || '').replace(/\D/g, '').includes(digits)));
}
