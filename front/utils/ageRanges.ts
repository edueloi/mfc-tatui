import { yearsSince } from './dates';

/**
 * Faixas etárias do perfil dos MFCistas. Contíguas, para ninguém ficar de fora
 * (11 e 12 anos entram em "11 a 17"; os limites repetidos viram 25–34, 35–49 e 50–60).
 */
export const AGE_RANGES = [
  { label: 'Até 10 anos', min: 0, max: 10 },
  { label: '11 a 17 anos', min: 11, max: 17 },
  { label: '18 a 24 anos', min: 18, max: 24 },
  { label: '25 a 34 anos', min: 25, max: 34 },
  { label: '35 a 49 anos', min: 35, max: 49 },
  { label: '50 a 60 anos', min: 50, max: 60 },
  { label: '61 anos ou mais', min: 61, max: Infinity },
] as const;

export function ageDistribution(members: { dob?: string | null }[]) {
  const rows = AGE_RANGES.map(range => ({ label: range.label, value: 0 }));
  let unknown = 0;
  members.forEach(member => {
    const age = yearsSince(member.dob || undefined);
    const index = age === null ? -1 : AGE_RANGES.findIndex(range => age >= range.min && age <= range.max);
    if (index < 0) unknown++; else rows[index].value++;
  });
  return { rows, unknown };
}
