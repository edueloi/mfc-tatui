const { validReceiptDate } = require('./payment-accounting');

function validateLedger(data, year) {
  if (!['IN', 'OUT'].includes(data.type)) return 'Informe se o lançamento é entrada ou saída.';
  if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0 || Number(data.amount) > 999999999.99) return 'Informe um valor válido maior que zero.';
  if (!validReceiptDate(data.date)) return 'Informe uma data válida.';
  if (year && Number(data.date.slice(0, 4)) !== Number(year)) return `A data precisa estar em ${year}, o exercício deste livro.`;
  if (!['SETTLED', 'PENDING', 'CANCELLED'].includes(data.status || 'SETTLED')) return 'Situação inválida.';
  if (!['FIXED', 'VARIABLE'].includes(data.valueKind || 'VARIABLE')) return 'Classificação de valor inválida.';
  if (data.dueDate && !validReceiptDate(data.dueDate)) return 'Informe um vencimento válido.';
  if (data.status === 'PENDING' && !data.dueDate) return 'Informe o vencimento da conta pendente.';
  if (data.expectedAmount != null && (!Number.isFinite(Number(data.expectedAmount)) || Number(data.expectedAmount) <= 0 || Number(data.expectedAmount) > 999999999.99)) return 'Informe um valor previsto válido maior que zero.';
  return null;
}

module.exports = { validateLedger };
