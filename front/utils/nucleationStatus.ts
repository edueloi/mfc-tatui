export const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  Pendente: 'warning',
  'Em Andamento': 'info',
  Convertido: 'success',
  'Sem Sucesso': 'danger',
};

export const RESULT_COLOR: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
  Sucesso: 'success',
  'Sem Sucesso': 'danger',
  Reagendado: 'warning',
  Agendado: 'info',
};

export const RESULT_OPTIONS = ['Agendado', 'Sucesso', 'Sem Sucesso', 'Reagendado'].map(value => ({ value, label: value }));
