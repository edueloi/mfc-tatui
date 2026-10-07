// Funções utilitárias

const nowIso = () => new Date().toISOString();

const calcYears = (dateString) => {
  if (!dateString) return 0;
  const today = new Date();
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return 0;
  let years = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) years--;
  return years;
};

const toBool = (value) => !!value;
const toInt = (value) => (value ? 1 : 0);

module.exports = {
  nowIso,
  calcYears,
  toBool,
  toInt
};
