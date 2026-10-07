/** 'YYYY-MM-DD…' → 'DD/MM/AAAA'. Vazio se a data for inválida. */
export function dateLabel(value?: string) {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

/** Anos completos desde a data (idade, tempo de casa). null se inválida ou futura. */
export function yearsSince(value?: string) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  const today = new Date();
  if (Number.isNaN(date.getTime()) || date > today) return null;
  let years = today.getFullYear() - date.getFullYear();
  if (today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())) years--;
  return years;
}
