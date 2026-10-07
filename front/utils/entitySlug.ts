import { slugify } from './teamSlug';

/**
 * Slug genérico para URLs com nome em vez de id.
 * `bases` devolve candidatos do menos ao mais específico (ex.: nome, nome + data). Vence o primeiro que
 * não colide com os demais itens; se todos colidirem, o id curto desempata e o endereço continua único.
 */
type Bases<T> = (item: T) => string[];

export function entitySlug<T extends { id: string }>(item: T, items: T[], bases: Bases<T>) {
  const mine = bases(item).map(slugify);
  const others = items.filter(other => other.id !== item.id).map(other => bases(other).map(slugify));
  for (let tier = 0; tier < mine.length; tier++) {
    if (mine[tier] && !others.some(other => other[tier] === mine[tier])) return mine[tier];
  }
  return `${mine.filter(Boolean).pop() || 'item'}-${item.id.slice(0, 8)}`;
}

/** Aceita o slug atual e, por compatibilidade com links antigos, o id. */
export function findBySlug<T extends { id: string }>(items: T[], param: string | undefined, bases: Bases<T>, slugOf = (item: T) => entitySlug(item, items, bases)) {
  if (!param) return null;
  return items.find(item => slugOf(item) === param) || items.find(item => item.id === param) || null;
}
