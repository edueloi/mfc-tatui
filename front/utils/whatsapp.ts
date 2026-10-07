/** Número no formato do WhatsApp (55 + DDD + número) ou '' se o telefone estiver incompleto. */
export function whatsappNumber(phone?: string | null) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : '';
}

/** Link que abre a conversa já com a mensagem escrita. '' quando não há telefone válido. */
export function whatsappUrl(phone: string | null | undefined, message: string) {
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : '';
}
