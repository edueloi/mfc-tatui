import type { Member, Payment } from '../types';
import { isMonthlyContributor, monthlyAmountForMember } from './paymentRules';
import { isPaidPayment, matchesReference, monthlySettlement } from './paymentAccounting';

/**
 * Unidade de cobrança: uma família (titular + cônjuge pagam juntos) ou um membro sem família.
 * A mensalidade configurada é da unidade; no casal ela é dividida entre os dois contribuintes.
 */
export interface BillingUnit {
  key: string;
  displayName: string;
  familyName?: string;
  type: 'couple' | 'single';
  /** Quem de fato paga (titular/cônjuge ativos e não isentos). */
  payingMembers: Member[];
  /** Família sem cobrança: dependentes e isentos. Nunca aparecem como pendência nem recebem "confirmar". */
  exemptMembers: Member[];
  amountPerPerson: number;
  /** Valor mensal da unidade (soma dos contribuintes). */
  monthlyTotal: number;
}

const firstName = (member: Member) => member.nickname || member.name.split(' ')[0];

export function buildBillingUnits(teamMembers: Member[], monthlyAmount: number): BillingUnit[] {
  const groups = new Map<string, Member[]>();
  teamMembers.forEach(member => {
    const family = member.familyName?.trim();
    const key = family ? `f:${family}` : `m:${member.id}`;
    groups.set(key, [...(groups.get(key) || []), member]);
  });

  const units: BillingUnit[] = [];
  groups.forEach((members, key) => {
    const family = members[0].familyName?.trim();
    const paying = members.filter(member => isMonthlyContributor(member));
    // Sem família, só entra quem é responsável ativo (isento fica visível como "Sem cobrança"); inativos sem família não são listados.
    if (!family && members[0].status !== 'Ativo') return;
    const exempt = members.filter(member => !paying.includes(member));
    const amountPerPerson = paying.length ? monthlyAmountForMember(paying[0], paying, monthlyAmount) : 0;
    const titular = members.find(member => member.relationshipType === 'Titular') || members[0];
    const spouse = members.find(member => member.relationshipType === 'Cônjuge');
    units.push({
      key,
      familyName: family,
      displayName: !family ? members[0].name : spouse ? `${firstName(titular)} & ${firstName(spouse)}` : `Família ${family}`,
      type: paying.length > 1 ? 'couple' : 'single',
      payingMembers: paying.sort((a, b) => (a.relationshipType === 'Titular' ? -1 : 0) - (b.relationshipType === 'Titular' ? -1 : 0)),
      exemptMembers: exempt,
      amountPerPerson,
      monthlyTotal: paying.reduce((sum, member) => sum + monthlyAmountForMember(member, paying, monthlyAmount), 0),
    });
  });
  return units.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
}

/** Meses (1..upTo) do ano sem quitação completa da unidade. Unidade sem contribuintes nunca atrasa. */
export function overdueMonths(unit: BillingUnit, payments: Payment[], year: number, upTo: number) {
  if (!unit.payingMembers.length) return [];
  const ids = unit.payingMembers.map(member => member.id);
  return Array.from({ length: upTo }, (_, index) => index + 1).filter(month => {
    const status = monthlySettlement(ids, payments, month, year).status;
    return status === 'pending' || status === 'partial';
  });
}

/** Contribuintes da unidade que ainda não pagaram a referência. */
export const unpaidForMonth = (unit: Pick<BillingUnit, 'payingMembers'>, payments: Payment[], month: number, year: number) =>
  unit.payingMembers.filter(member => !payments.some(payment => payment.memberId === member.id && isPaidPayment(payment) && matchesReference(payment, month, year)));
