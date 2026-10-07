// Regras de mensalidade: apenas titular e cônjuge podem responder pela cobrança.

const normalize = (value) => String(value || 'Titular')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const isBillingResponsible = (member) => {
  const relationship = normalize(member.relationship_type || member.relationshipType);
  return relationship === 'titular' || relationship === 'conjuge';
};

const canBeChargedMonthly = (member) =>
  isBillingResponsible(member) &&
  Number(member.pays_monthly ?? member.paysMonthly ?? 1) === 1 &&
  Number(member.is_payment_inactive ?? member.isPaymentInactive ?? 0) !== 1;

const monthlyFlagFor = (data) =>
  canBeChargedMonthly({
    relationshipType: data.relationshipType || 'Titular',
    paysMonthly: data.paysMonthly !== false,
    isPaymentInactive: data.isPaymentInactive
  }) ? 1 : 0;

module.exports = {
  isBillingResponsible,
  canBeChargedMonthly,
  monthlyFlagFor
};
