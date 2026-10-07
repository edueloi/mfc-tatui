import type { BaseTeam } from '../types';
import { normalizeDirectoryText } from './memberDirectory';

export const slugify = (value?: string | null) => normalizeDirectoryText(value)
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Slug usado na URL da equipe (/equipes/equipe-sao-jose).
 * Nomes repetidos ganham a cidade e, se ainda colidirem, o id — assim a URL sempre aponta para uma só equipe.
 */
export function teamSlug(team: Pick<BaseTeam, 'id' | 'name' | 'city'>, teams: Pick<BaseTeam, 'id' | 'name' | 'city'>[]) {
  const base = slugify(team.name) || 'equipe';
  const others = teams.filter(item => item.id !== team.id);
  if (!others.some(item => (slugify(item.name) || 'equipe') === base)) return base;
  const withCity = `${base}-${slugify(team.city)}`.replace(/-$/, '');
  return others.some(item => `${slugify(item.name) || 'equipe'}-${slugify(item.city)}`.replace(/-$/, '') === withCity) ? `${withCity}-${team.id}` : withCity;
}

/** Aceita o slug atual e, por compatibilidade com links antigos, o id da equipe. */
export function findTeamByParam<T extends Pick<BaseTeam, 'id' | 'name' | 'city'>>(teams: T[], param?: string) {
  if (!param) return null;
  return teams.find(team => teamSlug(team, teams) === param) || teams.find(team => team.id === param) || null;
}

export const teamPath = (team: Pick<BaseTeam, 'id' | 'name' | 'city'>, teams: Pick<BaseTeam, 'id' | 'name' | 'city'>[]) => `/equipes/${teamSlug(team, teams)}`;
