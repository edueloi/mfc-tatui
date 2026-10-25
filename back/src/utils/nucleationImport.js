// Leitura da planilha de inscrições do Encontro de Noivos para importar na Nucleação.
// Formato esperado (igual ao arquivo "MFC Tatuí — Encontro de Noivos"): uma linha por pessoa, duas por casal
// (a primeira é o noivo, a segunda a noiva), ligadas pelo número da coluna "Casal".

const XLSX = require('xlsx'); // leitura: aceita planilhas de qualquer origem (inclusive XML com prefixo x:)
const ExcelJS = require('exceljs'); // só para gerar a planilha modelo

const norm = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Cada campo aceita alguns títulos de coluna (sem acento e sem diferença de maiúscula).
const HEADERS = {
  casal: ['casal', 'n casal', 'no casal', 'numero do casal'],
  name: ['nome completo', 'nome'],
  dob: ['nascimento', 'data de nascimento', 'data nascimento'],
  birthplace: ['naturalidade'],
  education: ['escolaridade'],
  profession: ['profissao'],
  religion: ['religiao'],
  parish: ['paroquia'],
  address: ['endereco'],
  city: ['cidade'],
  phone: ['telefone', 'celular', 'whatsapp', 'telefone whatsapp'],
  email: ['e mail', 'email'],
  weddingDate: ['data do casamento', 'casamento'],
  weddingParish: ['paroquia do casamento'],
  meetingDate: ['data do encontro', 'encontro'],
  notes: ['observacoes', 'observacao', 'obs'],
};

const pad = (n) => String(n).padStart(2, '0');
const isoFromParts = (y, m, d) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return '';
  return `${y}-${pad(m)}-${pad(d)}`;
};

/** Valor de uma célula como texto (sem espaços sobrando; números inteiros, como telefone, sem ".0"). */
function cellText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return isoFromParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  return String(value).replace(/ /g, ' ').trim();
}

function toIsoDate(raw, date1904 = false) {
  // Data guardada como número do Excel (ex.: 33684.9997 = 22/03/1992). A fração é só a hora e é ignorada.
  if (typeof raw === 'number' || /^\d{4,6}(\.\d+)?$/.test(String(raw ?? '').trim())) {
    const serial = Number(raw);
    if (serial > 1 && serial < 2958466) {
      // Algumas ferramentas gravam a data alguns segundos ANTES da meia-noite (ex.: 33684,99967 para 22/03/1992) e o Excel
      // mostra o dia seguinte. Fração colada na meia-noite conta como o dia seguinte; o resto é só a hora e é ignorado.
      const whole = Math.floor(serial);
      const day = serial - whole >= 0.99 ? whole + 1 : whole;
      const parts = XLSX.SSF.parse_date_code(day, { date1904 });
      if (parts && parts.y) { const iso = isoFromParts(parts.y, parts.m, parts.d); if (iso) return { value: iso }; }
    }
    return { value: '', invalid: true };
  }
  const text = String(raw ?? '').trim();
  if (!text) return { value: '' };
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) { const iso = isoFromParts(+match[1], +match[2], +match[3]); return iso ? { value: iso } : { value: '', invalid: true }; }
  match = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (match) {
    let year = +match[3];
    if (match[3].length === 2) year += year > (new Date().getFullYear() % 100) ? 1900 : 2000;
    const iso = isoFromParts(year, +match[2], +match[1]);
    return iso ? { value: iso } : { value: '', invalid: true };
  }
  return { value: '', invalid: true };
}

function toPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2);
  return digits;
}

const emailOk = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function normalizeEducation(raw) {
  const text = norm(raw);
  if (!text) return '';
  const incomplete = /incomplet/.test(text);
  if (/doutor/.test(text)) return 'Doutorado';
  if (/mestr/.test(text)) return 'Mestrado';
  if (/\bpos\b|especializ|mba/.test(text)) return 'Pós-graduação';
  if (/superior|faculdade|graduac|universit/.test(text)) return incomplete ? 'Superior Incompleto' : 'Superior Completo';
  if (/medio|2 grau|segundo grau|colegial/.test(text)) return incomplete ? 'Médio Incompleto' : 'Médio Completo';
  if (/fundamental|1 grau|primeiro grau|ginasio|primario/.test(text)) return incomplete ? 'Fundamental Incompleto' : 'Fundamental Completo';
  return String(raw).trim();
}

function normalizeReligion(raw) {
  const text = norm(raw);
  if (!text) return '';
  if (/catolic/.test(text)) return 'Católica';
  if (/espirit/.test(text)) return 'Espírita';
  if (/evangel|protestante|crente/.test(text)) return 'Evangélica - Outra';
  if (/sem religiao|nenhuma|ateu|agnostic/.test(text)) return 'Sem religião';
  return String(raw).trim();
}

function splitCity(raw) {
  const text = String(raw || '').trim();
  const match = text.match(/^(.*?)\s*[/\-,]\s*([A-Za-z]{2})$/);
  return match ? { city: match[1].trim(), state: match[2].toUpperCase() } : { city: text, state: '' };
}

/** Lê o .xlsx e devolve os casais encontrados, com avisos por linha (nada é gravado aqui). */
async function parseNucleationWorkbook(buffer) {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, cellNF: false, cellText: false });
  } catch (error) {
    const wrapped = new Error('Não foi possível abrir o arquivo. Confira se é uma planilha do Excel (.xlsx).');
    wrapped.status = 400;
    throw wrapped;
  }
  const date1904 = !!(workbook.Workbook && workbook.Workbook.WBProps && workbook.Workbook.WBProps.date1904);

  // Usa a primeira aba que tenha a coluna "Nome completo" (a aba se chama "Inscrições" no arquivo do Encontro).
  let sheetName = ''; let matrix = []; let firstRow = 0; let headerIndex = -1; let columns = null;
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    if (!ws || !ws['!ref']) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true });
    const start = XLSX.utils.decode_range(ws['!ref']).s.r;
    for (let r = 0; r < Math.min(rows.length, 15); r += 1) {
      const found = {};
      rows[r].forEach((cell, col) => {
        const title = norm(cellText(cell));
        for (const [field, aliases] of Object.entries(HEADERS)) if (aliases.includes(title) && found[field] === undefined) found[field] = col;
      });
      if (found.name !== undefined) { sheetName = name; matrix = rows; firstRow = start; headerIndex = r; columns = found; break; }
    }
    if (columns) break;
  }
  if (!columns) {
    const error = new Error('Não encontrei a coluna "Nome completo" na planilha. Use o modelo (botão "Baixar planilha modelo") ou confira os títulos da linha de cabeçalho.');
    error.status = 400;
    throw error;
  }

  const raw = (row, field) => (columns[field] === undefined ? '' : row[columns[field]]);
  const get = (row, field) => cellText(raw(row, field));
  const rows = [];
  for (let r = headerIndex + 1; r < matrix.length; r += 1) {
    const row = matrix[r];
    const name = get(row, 'name');
    if (!name) continue;
    rows.push({ line: firstRow + r + 1, row, name });
  }

  // Agrupa por número do casal; sem número, junta de duas em duas linhas.
  const groups = []; const byKey = new Map(); let auto = null;
  for (const item of rows) {
    const key = get(item.row, 'casal');
    let group;
    if (key) {
      group = byKey.get(key);
      if (!group) { group = { key, items: [] }; byKey.set(key, group); groups.push(group); }
      auto = null;
    } else {
      if (!auto || auto.items.length >= 2) { auto = { key: `linha ${item.line}`, items: [] }; groups.push(auto); }
      group = auto;
    }
    group.items.push(item);
  }

  const couples = groups.map((group, index) => {
    const warnings = [];
    const [first, second] = group.items;
    if (group.items.length > 2) warnings.push(`O casal ${group.key} tem ${group.items.length} linhas; só as 2 primeiras foram usadas.`);
    if (!second) warnings.push('Só uma pessoa na ficha (faltou a segunda linha do casal).');

    const person = (item, label) => {
      if (!item) return { name: '', dob: '', birthplace: '', education: '', profession: '', religion: '', parish: '', phone: '', email: '' };
      const dob = toIsoDate(raw(item.row, 'dob'), date1904);
      if (dob.invalid) warnings.push(`${label}: data de nascimento "${get(item.row, 'dob')}" não reconhecida.`);
      const phone = toPhone(get(item.row, 'phone'));
      if (phone && ![10, 11].includes(phone.length)) warnings.push(`${label}: telefone "${get(item.row, 'phone')}" incompleto.`);
      let email = get(item.row, 'email').toLowerCase();
      let emailNote = '';
      if (email && !emailOk(email)) {
        emailNote = `E-mail informado na ficha (${label.toLowerCase()}): ${email}`;
        warnings.push(`${label}: e-mail "${email}" incompleto (ficou nas observações).`);
        email = '';
      }
      return {
        name: item.name, dob: dob.value, birthplace: get(item.row, 'birthplace'),
        education: normalizeEducation(get(item.row, 'education')), profession: get(item.row, 'profession'),
        religion: normalizeReligion(get(item.row, 'religion')), parish: get(item.row, 'parish'),
        phone, email, emailNote,
      };
    };

    const noivo = person(first, 'Noivo');
    const noiva = person(second, 'Noiva');
    const firstRaw = (field) => { for (const item of group.items) { const value = raw(item.row, field); if (cellText(value)) return value; } return ''; };
    const firstText = (field) => cellText(firstRaw(field));
    const { city, state } = splitCity(firstText('city'));
    const wedding = toIsoDate(firstRaw('weddingDate'), date1904);
    const meeting = toIsoDate(firstRaw('meetingDate'), date1904);
    if (wedding.invalid) warnings.push(`Data do casamento "${firstText('weddingDate')}" não reconhecida.`);
    if (meeting.invalid) warnings.push(`Data do encontro "${firstText('meetingDate')}" não reconhecida.`);
    if (!noivo.phone && !noiva.phone) warnings.push('Nenhum telefone informado.');

    const notes = [...new Set([...group.items.map((item) => get(item.row, 'notes')), noivo.emailNote, noiva.emailNote].filter(Boolean))].join(' | ');
    delete noivo.emailNote; delete noiva.emailNote;
    return {
      id: `c${index + 1}`, number: group.key, lines: group.items.map((item) => item.line),
      noivo, noiva,
      street: firstText('address'), city, state,
      weddingDate: wedding.value, weddingParish: firstText('weddingParish'), meetingDate: meeting.value,
      notes, warnings,
    };
  });

  return { sheet: sheetName, peopleRows: rows.length, couples };
}

/** Planilha modelo com os títulos certos e um casal de exemplo. */
async function buildTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Inscrições');
  sheet.addRow(['MFC Tatuí — Encontro de Noivos']).font = { bold: true, size: 14 };
  sheet.addRow(['Uma linha por pessoa: a primeira do casal é o noivo e a segunda é a noiva (mesmo número na coluna Casal).']).font = { italic: true, color: { argb: 'FF666666' } };
  sheet.addRow([]);
  const header = sheet.addRow(['Casal', 'Nome completo', 'Nascimento', 'Naturalidade', 'Escolaridade', 'Profissão', 'Religião', 'Paróquia', 'Endereço', 'Cidade', 'Telefone', 'E-mail', 'Data do casamento', 'Paróquia do casamento', 'Data do encontro', 'Observações']);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3557' } };
  sheet.addRow([1, 'João da Silva', '22/03/1992', 'Tatuí/SP', 'Superior completo', 'Engenheiro', 'Católico', 'Basílica Nossa Senhora das Graças', 'Rua Exemplo, 100', 'Tatuí', '(15) 99999-0001', 'joao@exemplo.com', '14/11/2026', 'Basílica Nossa Senhora das Graças', '07/11/2026', '']);
  sheet.addRow([1, 'Maria de Souza', '30/12/1993', 'Tietê/SP', 'Superior completo', 'Professora', 'Católica', 'Basílica Nossa Senhora das Graças', 'Rua Exemplo, 100', 'Tatuí', '(15) 99999-0002', 'maria@exemplo.com', '14/11/2026', 'Basílica Nossa Senhora das Graças', '07/11/2026', '']);
  [8, 28, 14, 16, 20, 20, 14, 30, 34, 14, 18, 28, 18, 30, 16, 36].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  return workbook;
}

module.exports = { parseNucleationWorkbook, buildTemplateWorkbook, norm };
