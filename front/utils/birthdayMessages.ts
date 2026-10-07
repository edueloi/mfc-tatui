/**
 * Mensagens prontas de aniversário para o WhatsApp.
 * O grupo é escolhido pela idade (menores e idosos têm texto próprio) e, nos demais casos, pelo sexo cadastrado.
 */
export type BirthdayGroup = 'jovem' | 'mulher' | 'homem' | 'idoso' | 'geral';

export const BIRTHDAY_GROUP_LABEL: Record<BirthdayGroup, string> = {
  jovem: 'Jovem',
  mulher: 'Mulher do MFC',
  homem: 'Homem do MFC',
  idoso: 'Terceira idade',
  geral: 'Mensagem geral',
};

export function birthdayGroup(age: number | null, gender?: string | null): BirthdayGroup {
  if (age !== null && age < 18) return 'jovem';
  if (age !== null && age >= 60) return 'idoso';
  if (gender === 'Feminino') return 'mulher';
  if (gender === 'Masculino') return 'homem';
  return 'geral';
}

const treatment = (gender?: string | null) => gender === 'Feminino' ? 'Querida' : gender === 'Masculino' ? 'Querido' : 'Olá';

export function birthdayMessage(group: BirthdayGroup, name: string, gender?: string | null, age?: number | null) {
  const first = name.trim().split(/\s+/)[0] || name;
  const years = age && age > 0 ? ` pelos seus ${age} anos` : '';
  switch (group) {
    case 'jovem':
      return `Oi, ${first}! 🎉 Feliz aniversário! Que Deus abençoe sua vida com muita alegria, saúde e paz, e que você continue crescendo na fé e na amizade. Você faz parte da nossa turma do MFC e é muito especial pra gente! 🙏`;
    case 'mulher':
      return `Querida ${first}, feliz aniversário! 🌹 Que Deus te abençoe e te guarde, derramando saúde, paz e muita alegria sobre você e sua família. Que alegria ter você, com seu exemplo de fé e carinho, no MFC! 🙏`;
    case 'homem':
      return `Querido ${first}, feliz aniversário! 🎉 Que Deus te conceda saúde, paz e sabedoria, e abençoe você e sua família neste novo ano de vida. Que bom ter você no MFC! 🙏`;
    case 'idoso':
      return `${treatment(gender)} ${first}, parabéns${years}! 🙏 Que Deus continue abençoando sua vida com saúde, paz e a companhia de quem você ama. Seu exemplo de fé e sua caminhada inspiram toda a nossa comunidade do MFC. Um abraço carinhoso!`;
    default:
      return `Olá, ${first}! 🎉 Feliz aniversário! Que Deus abençoe você e sua família com saúde, paz e alegria. Um abraço de toda a comunidade do MFC! 🙏`;
  }
}

export function weddingMessage(names: string, years: number) {
  const time = years > 0 ? `pelos ${years} ${years === 1 ? 'ano' : 'anos'} de casamento` : 'pelo casamento';
  return `Olá, ${names}! 💍 Parabéns ${time}! Que Deus continue abençoando a união de vocês com amor, paz e muita fé. Vocês são exemplo de família cristã para o MFC! 🙏`;
}
