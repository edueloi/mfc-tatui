import { Member } from '../types';

/**
 * Regras de cobrança do MFC:
 * somente o titular e o cônjuge podem ser responsáveis por mensalidade.
 * Filhos e demais dependentes fazem parte da família, mas não geram cobrança.
 */
const normalize = (value?: string) =>
  (value || 'Titular')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const isBillingResponsible = (member: Pick<Member, 'relationshipType'>) => {
  const relationship = normalize(member.relationshipType);
  return relationship === 'titular' || relationship === 'conjuge';
};

const isCouplePair = (first: Member, second: Member) => {
  const firstRelationship = normalize(first.relationshipType);
  const secondRelationship = normalize(second.relationshipType);
  return (firstRelationship === 'titular' && secondRelationship === 'conjuge') ||
    (firstRelationship === 'conjuge' && secondRelationship === 'titular');
};

export const isMonthlyContributor = (member: Member, requireActive = true) =>
  (!requireActive || member.status === 'Ativo') &&
  isBillingResponsible(member) &&
  member.paysMonthly !== false &&
  member.isPaymentInactive !== true;

export const monthlyContributors = (members: Member[], requireActive = true) =>
  members.filter(member => isMonthlyContributor(member, requireActive));

/** O valor configurado é da unidade de contribuição: casal ou membro individual. */
export const monthlyAmountForMember = (member: Member, contributors: Member[], monthlyAmount: number) => {
  const formsCouple = Boolean(member.familyName?.trim()) && contributors.some(other =>
    other.id !== member.id && other.familyName === member.familyName && isCouplePair(member, other)
  );
  return formsCouple ? monthlyAmount / 2 : monthlyAmount;
};

export const isDependentForBilling = (member: Pick<Member, 'relationshipType'>) =>
  !isBillingResponsible(member);
