const ExcelJS = require('exceljs');
const { attachLedgerCharts } = require('./ledger-charts');
const { teamMemberReport } = require('./team-member-report');

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const late = row => { const [m, y] = String(row.referenceMonth).split('/').map(Number); return row.date.slice(0, 7) > `${y}-${String(m).padStart(2, '0')}`; };
const MONEY = '#,##0.00;[Red](#,##0.00);"—"';
const RECEIPT_COLORS = ['DBEAFE', 'EDE9FE', 'CFFAFE', 'D1FAE5', 'ECFCCB', 'FEF3C7', 'FFEDD5', 'FEE2E2', 'FAE8FF', 'FCE7F3', 'E0E7FF', 'CCFBF1'];
const colors = { blue: '173C78', light: 'EBF2FC', green: '15803D', red: 'B91C1C', gray: '64748B' };
const round = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const sum = (rows, field) => round(rows.reduce((n, row) => n + row[field], 0));
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const text = value => String(value || '').trim() || 'Não informado';
const excelDate = value => value ? new Date(String(value).slice(0, 10) + 'T00:00:00Z') : null;
const todayInBrazil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function filterLedgerEntries(entries, filters = {}, today = todayInBrazil()) {
  const { tab, type, month, status, kind, search, costCenter, financialAccount } = filters;
  const accountTab = tab === 'pagar' || tab === 'receber';
  return entries.filter(e => (!accountTab || (e.status === 'PENDING' && e.type === (tab === 'pagar' ? 'OUT' : 'IN')))
    && (accountTab || !type || type === 'all' || e.type === type)
    && (!month || month === 'all' || Number((accountTab ? e.dueDate || e.date : e.date).slice(5, 7)) === Number(month))
    && (!status || status === 'all' || (status === 'overdue' ? e.status === 'PENDING' && (e.dueDate || e.date) < today : (e.status || 'SETTLED') === status))
    && (!kind || kind === 'all' || (e.valueKind || 'VARIABLE') === kind)
    && (!costCenter || e.costCenter === costCenter) && (!financialAccount || e.financialAccount === financialAccount)
    && (!search || normalize([e.description, e.category, e.counterparty, e.notes, e.costCenter, e.analytic, e.financialAccount].join(' ')).includes(normalize(search))));
}

async function buildLedgerWorkbook(book, entries, { report = 'ledger', scope = 'all', filters = {}, generatedAt = new Date(), teams = [], members = [], payments = [], monthlyAmount = 0 } = {}) {
  if (report === 'teams') { entries = entries.filter(entry => entry.paymentId); book = { ...book, name: 'Equipes Base', initialBalance: 0 }; }
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MFC Gestão'; wb.title = `Livro Caixa — ${book.name} — ${book.year}`;
  wb.created = generatedAt; wb.modified = generatedAt; wb.calcProperties.fullCalcOnLoad = true;
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).map(e => {
    const settled = !e.status || e.status === 'SETTLED';
    const amount = round(e.amount); const pending = e.status === 'PENDING';
    return { ...e, amount, costCenter: text(e.costCenter), category: text(e.category), analytic: text(e.analytic), financialAccount: text(e.financialAccount),
      settled, statusLabel: e.status === 'CANCELLED' ? 'Cancelado' : settled ? e.type === 'IN' ? 'Recebido' : 'Pago' : e.type === 'IN' ? 'A receber' : 'A pagar',
      expected: round(e.expectedAmount ?? amount), income: settled && e.type === 'IN' ? amount : 0, expenses: settled && e.type === 'OUT' ? amount : 0,
      receivable: pending && e.type === 'IN' ? amount : 0, payable: pending && e.type === 'OUT' ? amount : 0,
      month: Number(e.date.slice(5, 7)), net: settled ? (e.type === 'IN' ? amount : -amount) : 0 };
  });
  const opening = scope === 'all' ? Number(book.initialBalance) || 0 : 0;
  const centers = [...new Set(rows.map(r => r.costCenter))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const accounts = [...new Set(rows.map(r => r.financialAccount))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  let tableIndex = 0;
  const sheets = new Set();
  const safeName = name => {
    const clean = name.replace(/[\\/*?:\[\]]/g, ' ').replace(/^'+|'+$/g, '').trim() || 'Centro';
    let value = clean.slice(0, 31); let n = 2;
    while (sheets.has(value.toLowerCase())) { const suffix = ` (${n++})`; value = clean.slice(0, 31 - suffix.length) + suffix; }
    sheets.add(value.toLowerCase()); return value;
  };
  function sheet(name, title, columns, note = '') {
    const ws = wb.addWorksheet(safeName(name), { properties: { tabColor: { argb: colors.blue }, defaultRowHeight: 21 }, views: [{ state: 'frozen', xSplit: 1, ySplit: 6, showGridLines: false }], pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:6', margins: { left: .3, right: .3, top: .4, bottom: .4, header: .2, footer: .2 } } });
    ws.mergeCells(1, 1, 2, columns); const cell = ws.getCell('A1'); cell.value = title;
    cell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.blue } }; cell.alignment = { vertical: 'middle', indent: 1 };
    ws.mergeCells(3, 1, 3, columns); ws.getCell('A3').value = `${book.name} · Exercício ${book.year} · ${scope === 'all' ? 'Livro completo' : 'Recorte dos filtros da tela'} · ${generatedAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
    ws.getCell('A3').font = { name: 'Calibri', size: 10, color: { argb: colors.gray } };
    if (note) { ws.mergeCells(4, 1, 5, columns); ws.getCell('A4').value = note; ws.getCell('A4').alignment = { wrapText: true, vertical: 'middle' }; ws.getCell('A4').font = { name: 'Calibri', size: 10, color: { argb: colors.gray } }; }
    ws.headerFooter.oddFooter = '&LMFC Gestão — Livro Caixa&C&P / &N&R' + book.year;
    return ws;
  }
  function table(ws, headings, data, widths, moneyColumns = [], totals = true, startRow = 6) {
    const numeric = new Set(moneyColumns);
    const model = { name: `MFC_Tabela_${++tableIndex}`, ref: `A${startRow}`, headerRow: true, totalsRow: totals, style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: headings.map((name, index) => ({ name, filterButton: true, ...(index === 0 ? { totalsRowLabel: 'Total listado' } : numeric.has(index + 1) ? { totalsRowFunction: 'sum' } : {}) })), rows: data.length ? data : [headings.map(() => null)] };
    ws.addTable(model);
    widths.forEach((width, index) => { ws.getColumn(index + 1).width = width; });
    ws.getRow(startRow).height = 30;
    ws.eachRow((row, rowNumber) => { if (rowNumber < startRow) return; row.eachCell(cell => {
      cell.font = { name: 'Calibri', size: 11, ...(rowNumber === startRow ? { bold: true, color: { argb: 'FFFFFF' } } : {}) };
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (rowNumber > startRow && numeric.has(cell.col)) cell.numFmt = MONEY;
    }); });
    moneyColumns.forEach(index => ws.getColumn(index).numFmt = MONEY);
    ws.pageSetup.printArea = `A1:${ws.getColumn(headings.length).letter}${ws.rowCount}`;
  }
  const panel = sheet('Painel', report === 'teams' ? 'LIVRO CAIXA | Equipes base' : 'LIVRO CAIXA | Visão financeira', 17);
  const daily = sheet('Diário', 'DIÁRIO | Lançamentos', 17, 'Use as setas dos títulos para filtrar. Vermelho = saída. Pago/recebido compõe o caixa; pendências e cancelamentos não compõem o saldo. Colunas técnicas R:X sustentam os relatórios.');
  const headings = ['Dia', 'Centro de custo', 'Sintético', 'Analítico', 'Valor', 'Conta financeira', 'Observação', 'Descrição', 'Pessoa / fornecedor', 'Tipo', 'Situação', 'Vencimento', 'Classificação', 'Previsto', 'Realizado', 'Variação', 'Forma de pagamento', 'Entradas realizadas', 'Saídas realizadas', 'A receber', 'A pagar', 'Mês', 'Resultado realizado', 'ID', 'ID equipe', 'Referência quitada'];
  const dailyRows = rows.map(e => [excelDate(e.date), e.costCenter, e.category, e.analytic, e.type === 'IN' ? e.amount : -e.amount, e.financialAccount, e.notes || '', e.description || '', e.counterparty || '', e.type === 'IN' ? 'Entrada' : 'Saída', e.statusLabel, excelDate(e.dueDate || e.date), e.valueKind === 'FIXED' ? 'Fixo' : 'Variável', e.expected, e.settled ? e.amount : 0, e.settled ? round(e.amount - e.expected) : 0, e.paymentMethod || '', e.income, e.expenses, e.receivable, e.payable, e.month, e.net, e.id, e.teamId || '', e.referenceMonth || '']);
  table(daily, headings, dailyRows, [14, 25, 30, 32, 18, 22, 48, 38, 30, 14, 17, 14, 16, 18, 18, 18, 22, 18, 18, 18, 18, 8, 18, 38], [5, 14, 15, 16, 18, 19, 20, 21, 23]);
  daily.getColumn(1).numFmt = 'dd/mm/yyyy'; daily.getColumn(12).numFmt = 'dd/mm/yyyy';
  for (let c = 18; c <= 26; c++) daily.getColumn(c).hidden = true;
  rows.forEach((e, i) => {
    const r = i + 7;
    const formulas = { R: ['IF(AND(K' + r + '="Recebido",J' + r + '="Entrada"),ABS(E' + r + '),0)', e.income], S: ['IF(AND(K' + r + '="Pago",J' + r + '="Saída"),ABS(E' + r + '),0)', e.expenses], T: [`IF(K${r}="A receber",ABS(E${r}),0)`, e.receivable], U: [`IF(K${r}="A pagar",ABS(E${r}),0)`, e.payable], V: [`MONTH(A${r})`, e.month], W: [`R${r}-S${r}`, e.net], O: [`R${r}+S${r}`, e.settled ? e.amount : 0], P: [`IF(OR(K${r}="Pago",K${r}="Recebido"),O${r}-N${r},0)`, e.settled ? round(e.amount - e.expected) : 0] };
    Object.entries(formulas).forEach(([col, [formula, result]]) => { daily.getCell(col + r).value = { formula, result }; });
  });
  const end = Math.max(7, rows.length + 6);
  daily.addConditionalFormatting({ ref: `A7:Q${end}`, rules: [{ type: 'expression', formulae: ['AND(OR($K7="A pagar",$K7="A receber"),$L7<TODAY(),$L7<>"")'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF1CE' } }, font: { color: { argb: '92400E' } } } }] });
  const range = column => `'Diário'!$${column}$7:$${column}$${end}`;
  const exact = cell => `SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(${cell},"~","~~"),"*","~*"),"?","~?")`;
  const sumif = (column, criteria = []) => `SUMIFS(${range(column)}${criteria.map(([col, criterion]) => `,${range(col)},${criterion}`).join('')})`;
  const cash = (target, formula, result) => { target.value = { formula, result: round(result) }; target.numFmt = MONEY; };

  // Filtros do painel controlam fórmulas e gráficos nativos.
  const lists = wb.addWorksheet(safeName('Listas'), { state: 'hidden' });
  ['Todos', ...centers].forEach((value, i) => { lists.getCell(i + 1, 1).value = value; });
  ['Todas', ...accounts].forEach((value, i) => { lists.getCell(i + 1, 2).value = value; });
  panel.getCell('A4').value = 'Centro de custo'; panel.mergeCells('B4:D4'); panel.getCell('B4').value = 'Todos';
  panel.getCell('A5').value = 'Conta financeira'; panel.mergeCells('B5:D5'); panel.getCell('B5').value = 'Todas';
  panel.getCell('B4').dataValidation = { type: 'list', allowBlank: false, formulae: [`'Listas'!$A$1:$A$${centers.length + 1}`], showErrorMessage: true, error: 'Selecione um centro da lista.' };
  panel.getCell('B5').dataValidation = { type: 'list', allowBlank: false, formulae: [`'Listas'!$B$1:$B$${accounts.length + 1}`], showErrorMessage: true, error: 'Selecione uma conta da lista.' };
  for (const address of ['B4', 'B5']) { panel.getCell(address).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } }; panel.getCell(address).font = { name: 'Calibri', color: { argb: colors.blue }, bold: true }; }
  const criteria = [['B', `IF($B$4="Todos","*",${exact('$B$4')})`], ['F', `IF($B$5="Todas","*",${exact('$B$5')})`]];
  const cards = [['Recebido', 'R', 'income'], ['Pago', 'S', 'expenses'], ['A receber', 'T', 'receivable'], ['A pagar', 'U', 'payable']];
  cards.forEach(([label, col, key], i) => { const c = i * 2 + 1; panel.mergeCells(7, c, 7, c + 1); panel.mergeCells(8, c, 9, c + 1); panel.getCell(7, c).value = label; panel.getCell(7, c).font = { name: 'Calibri', bold: true, color: { argb: colors.blue } }; cash(panel.getCell(8, c), sumif(col, criteria), sum(rows, key)); panel.getCell(8, c).font = { name: 'Calibri', size: 20, bold: true, color: { argb: i % 2 ? colors.red : colors.green } }; panel.getCell(8, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } }; });
  ['Mês', 'Recebido', 'Pago', 'Resultado', scope === 'all' ? 'Saldo acumulado*' : 'Resultado acumulado', 'A receber', 'A pagar'].forEach((label, i) => { panel.getCell(12, i + 1).value = label; panel.getCell(12, i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.blue } }; panel.getCell(12, i + 1).font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFF' } }; });
  let running = opening;
  const monthly = MONTHS.map((label, index) => {
    const own = rows.filter(e => e.month === index + 1); const income = sum(own, 'income'); const expenses = sum(own, 'expenses'); running = round(running + income - expenses);
    const r = index + 13; panel.getCell('A' + r).value = label;
    cash(panel.getCell('B' + r), sumif('R', [...criteria, ['V', String(index + 1)]]), income);
    cash(panel.getCell('C' + r), sumif('S', [...criteria, ['V', String(index + 1)]]), expenses);
    cash(panel.getCell('D' + r), `B${r}-C${r}`, income - expenses);
    cash(panel.getCell('E' + r), `SUM($D$13:D${r})+IF(AND($B$4="Todos",$B$5="Todas"),${opening},0)`, running);
    cash(panel.getCell('F' + r), sumif('T', [...criteria, ['V', String(index + 1)]]), sum(own, 'receivable'));
    cash(panel.getCell('G' + r), sumif('U', [...criteria, ['V', String(index + 1)]]), sum(own, 'payable'));
    if (index % 2 === 0) for (let c = 1; c <= 7; c++) panel.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
    return { income, expenses, balance: running };
  });
  panel.mergeCells('A27:G29'); panel.getCell('A27').value = '* O saldo inicial entra somente no livro completo, sem filtro de centro/conta. Com filtros, o acumulado representa a movimentação líquida do recorte. Pendências seguem o mês da data no exercício; consulte os vencimentos nas abas A pagar e A receber.'; panel.getCell('A27').alignment = { wrapText: true, vertical: 'top' };
  for (let c = 1; c <= 17; c++) panel.getColumn(c).width = c === 1 ? 22 : 18;
  panel.pageSetup.printArea = 'A1:Q43'; panel.pageSetup.fitToHeight = 1;

  function balanceSheet(name, title, groups, dimensions) {
    const ws = sheet(name, title, dimensions.length + 13, 'Valores realizados por mês. Entradas positivas; saídas negativas em vermelho. Use os filtros dos cabeçalhos. Pendências não entram neste balancete.');
    const keys = [...new Map(groups.map(e => { const values = dimensions.map(d => e[d.key]); return [JSON.stringify(values), values]; })).values()].sort((a, b) => a.join(' ').localeCompare(b.join(' '), 'pt-BR'));
    const data = keys.map(values => { const own = groups.filter(e => dimensions.every((d, i) => e[d.key] === values[i])); return [...values, ...MONTHS.map((_, i) => sum(own.filter(e => e.month === i + 1), 'net')), sum(own, 'net')]; });
    const start = dimensions.length + 1;
    table(ws, [...dimensions.map(d => d.label), ...MONTHS, 'Total'], data, [...dimensions.map(() => 30), ...Array(13).fill(18)], Array.from({ length: 13 }, (_, i) => start + i));
    keys.forEach((values, index) => {
      const r = index + 7; const criteria = dimensions.map((d, i) => [d.column, exact('$' + ws.getColumn(i + 1).letter + r)]);
      const own = groups.filter(e => dimensions.every((d, i) => e[d.key] === values[i]));
      MONTHS.forEach((_, month) => cash(ws.getCell(r, start + month), sumif('W', [...criteria, ['V', String(month + 1)]]), sum(own.filter(e => e.month === month + 1), 'net')));
      cash(ws.getCell(r, start + 12), `SUM(${ws.getColumn(start).letter}${r}:${ws.getColumn(start + 11).letter}${r})`, sum(own, 'net'));
    });
    return ws;
  }
  const center = { key: 'costCenter', label: 'Centro de custo', column: 'B' };
  const category = { key: 'category', label: 'Sintético', column: 'C' };
  const analytic = { key: 'analytic', label: 'Analítico', column: 'D' };
  balanceSheet('Balancete Geral', 'BALANCETE | Sintético e analítico', rows, [category, analytic]);
  balanceSheet('Balancete c.custo', 'BALANCETE | Centros de custo', rows, [center, category, analytic]);
  const accountSheet = sheet('Saldo Contas', 'CONTAS | Movimentação financeira', 6, 'Movimentação registrada por conta. O saldo inicial do livro não foi dividido entre contas: resultado realizado não representa o saldo bancário inicial + movimentação.');
  const accountData = accounts.map(account => { const own = rows.filter(e => e.financialAccount === account); return [account, sum(own, 'income'), sum(own, 'expenses'), sum(own, 'net'), sum(own, 'receivable'), sum(own, 'payable')]; });
  table(accountSheet, ['Conta financeira', 'Recebido', 'Pago', 'Resultado realizado', 'A receber', 'A pagar'], accountData, [32, 22, 22, 25, 22, 22], [2, 3, 4, 5, 6]);
  accounts.forEach((_, i) => ['R', 'S', 'W', 'T', 'U'].forEach((col, c) => cash(accountSheet.getCell(i + 7, c + 2), sumif(col, [['F', exact('$A' + (i + 7))]]), accountData[i][c + 1])));
  for (const [type, name] of [['OUT', 'A pagar'], ['IN', 'A receber']]) {
    const own = rows.filter(e => e.status === 'PENDING' && e.type === type).sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date));
    const ws = sheet(name, `PENDÊNCIAS | ${name}`, 9, 'Contas pendentes na data da exportação, ordenadas pelo vencimento. Nenhuma baixa é realizada por esta planilha.');
    table(ws, ['Vencimento', 'Centro de custo', 'Sintético', 'Analítico', 'Conta financeira', 'Pessoa / fornecedor', 'Valor', 'Descrição', 'Observação'], own.map(e => [excelDate(e.dueDate || e.date), e.costCenter, e.category, e.analytic, e.financialAccount, e.counterparty || '', e.amount, e.description || '', e.notes || '']), [15, 26, 30, 30, 24, 30, 20, 40, 45], [7]);
    ws.getColumn(1).numFmt = 'dd/mm/yyyy';
    ws.addConditionalFormatting({ ref: `A7:I${Math.max(7, own.length + 6)}`, rules: [{ type: 'expression', formulae: ['AND($A7<TODAY(),$A7<>"")'], style: { font: { color: { argb: colors.red } }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FEE2E2' } } } }] });
  }
  centers.forEach(value => balanceSheet(value, `CENTRO DE CUSTO | ${value}`, rows.filter(e => e.costCenter === value), [center, category, analytic]));
  // Balancete por equipe e uma aba própria para cada grupo, inclusive sem movimento.
  const teamReceipts = rows.filter(row => row.paymentId && row.income > 0);
  const teamMap = new Map(teams.map(team => [team.id, team.name]));
  const teamSheets = [];
  if (teams.length || report === 'teams') teamReceipts.forEach(row => { if (!teamMap.has(row.teamId)) teamMap.set(row.teamId, row.analytic); });
  if (teamMap.size) {
    const legend = sheet('Legenda recebimentos', 'LEGENDA | Mês do recebimento', 3, 'A cor nas mensalidades indica quando o dinheiro entrou. Outubro é rosa, inclusive nas referências antigas quitadas em outubro. Consulte comentários e detalhes para datas completas. Com recebimentos em meses diferentes na mesma família, a célula usa a cor do mais recente.');
    table(legend, ['Mês', 'Cor de identificação', 'Como ler'], MONTHS.map(label => [label, label, 'Cor do mês em que o pagamento foi recebido']), [22, 24, 70], [], false);
    MONTHS.forEach((_, i) => { legend.getCell(i + 7, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RECEIPT_COLORS[i] } }; });
    const groups = [...teamMap].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
    const general = sheet('Balancete Equipes', 'MENSALIDADES | Balancete por equipe', 14, 'Cada linha é uma equipe. Janeiro a dezembro seguem a data de entrada no caixa, não a referência quitada. Recebimentos de meses anteriores pagos em outubro aparecem em outubro.');
    teamSheets.push(general);
    const data = groups.map(([id, name]) => {
      const own = teamReceipts.filter(row => row.teamId === id);
      return [name, ...MONTHS.map((_, i) => sum(own.filter(row => row.month === i + 1), 'income')), sum(own, 'income')];
    });
    table(general, ['Equipe base', ...MONTHS, 'Total anual'], data, [34, ...Array(13).fill(18)], Array.from({ length: 13 }, (_, i) => i + 2));
    groups.forEach(([id, name], index) => {
      const r = index + 7;
      general.getCell(`O${r}`).value = id;
      MONTHS.forEach((_, i) => cash(general.getCell(r, i + 2), sumif('R', [['Y', exact(`$O${r}`)], ['X', '"payment:*"'], ['V', String(i + 1)]]), data[index][i + 1]));
      cash(general.getCell(r, 14), `SUM(B${r}:M${r})`, data[index][13]);
      const own = teamReceipts.filter(row => row.teamId === id);
      const ws = sheet(name, `EQUIPE | ${name}`, 14, 'Uma linha por família pagante. A cor indica o mês do recebimento (outubro = rosa). Datas e situações estão nos comentários e no detalhamento. Abaixo, entradas por data real do caixa; não confunda total quitado com entrada no ano.');
      teamSheets.push(ws);
      general.getCell(r, 1).value = { text: name, hyperlink: `#'${ws.name.replace(/'/g, "''")}'!A1` };
      const fallbackPayments = own.map(row => ({ id: row.paymentId, member_id: row.memberId, team_id: id, member_name: row.counterparty, amount: row.income, date: row.date, reference_month: row.referenceMonth, status: 'Pago' }));
      const memberRows = teamMemberReport({ teamId: id, year: book.year, members, payments: payments.length ? payments : fallbackPayments, entries: own, monthlyAmount });
      table(ws, ['Família', ...MONTHS, 'Total quitado'], memberRows.map(row => [row.name, ...row.months.map(month => month.amount), row.referenceTotal]), [28, ...Array(12).fill(16), 20], Array.from({ length: 13 }, (_, i) => i + 2));
      memberRows.forEach((row, index) => {
        ws.getRow(index + 7).height = 28;
        row.months.forEach((month, i) => { const cell = ws.getCell(index + 7, i + 2); cell.font = { name: 'Calibri', size: 10, color: { argb: '334155' } }; cell.note = month.note; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: month.receiptMonth >= 0 ? RECEIPT_COLORS[month.receiptMonth] : 'F8FAFC' } }; if (month.partial) cell.border = { bottom: { style: 'dashed', color: { argb: '64748B' } } }; });
      });
      const cashStart = Math.max(1, memberRows.length) + 11;
      ws.mergeCells(cashStart - 2, 1, cashStart - 2, 14); ws.getCell(cashStart - 2, 1).value = 'ENTRADAS NO CAIXA POR FAMÍLIA · DATA DO RECEBIMENTO';
      table(ws, ['Família / casal', ...MONTHS, 'Total recebido'], memberRows.map(row => [row.name, ...row.cash, row.cash.reduce((sum, value) => sum + value, 0)]), [34, ...Array(12).fill(18), 20], Array.from({ length: 13 }, (_, i) => i + 2), true, cashStart);
      const detailStart = cashStart + Math.max(1, memberRows.length) + 5;
      ws.mergeCells(detailStart - 2, 1, detailStart - 2, 14); ws.getCell(detailStart - 2, 1).value = 'DETALHAMENTO DOS RECEBIMENTOS';
      const familyReceipts = new Map();
      own.forEach(row => {
        const family = memberRows.find(family => family.memberIds.includes(row.memberId));
        const key = JSON.stringify([family?.id || row.memberId, row.referenceMonth, row.date.slice(0, 10)]);
        const receipt = familyReceipts.get(key) || { ...row, familyName: family?.name || row.counterparty, income: 0 };
        receipt.income = round(receipt.income + row.income);
        familyReceipts.set(key, receipt);
      });
      table(ws, ['Recebido em', 'Mensalidade quitada', 'Família / casal', 'Valor recebido'], [...familyReceipts.values()].map(row => [excelDate(row.date), row.referenceMonth, row.familyName, row.income]), [28, 20, 28, 20], [4], true, detailStart);
      for (let i = detailStart + 1; i <= familyReceipts.size + detailStart; i++) ws.getCell(i, 1).numFmt = 'dd/mm/yyyy';
      ws.pageSetup.printArea = `A1:N${ws.rowCount}`;
      ws.pageSetup.printTitlesRow = '1:5';
    });
    general.getColumn(15).hidden = true;
  }
  const guide = sheet('Leia-me', 'GUIA | Como usar este arquivo', 7);
  const instructions = [
    ['Conteúdo', `${rows.length} lançamentos exportados. ${scope === 'all' ? 'Livro completo.' : 'Somente os lançamentos que correspondem aos filtros da tela.'}`],
    ['Filtros de origem', scope === 'all' ? 'Sem filtros.' : JSON.stringify(filters)],
    ['Painel', 'Selecione centro de custo e conta financeira nas células azuis. Fórmulas e gráficos nativos acompanham essas seleções no Excel.'],
    ['Diário', 'As primeiras sete colunas seguem o modelo informado. Há tabelas com filtros, cabeçalhos congelados, valores numéricos, datas e totais.'],
    ['Balancetes', 'Resumos por mês, sintético, analítico e centro de custo. São tabelas com fórmulas, não tabelas dinâmicas.'],
    ['Contas financeiras', 'BB c/c, Poupança, caixas e outras contas são classificações informadas no cadastro. Valores sem classificação aparecem como Não informado.'],
    ['Saldo inicial', `Saldo inicial do livro: ${opening.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. No recorte e nos filtros do painel o acumulado é apenas movimentação, sem distribuir saldo inicial.`],
    ['Edição', 'O arquivo é um retrato dos dados. Alterações no Excel não são enviadas ao sistema. Novos lançamentos e novas classificações devem ser cadastrados no sistema e exportados novamente.'],
    ['Pendências', 'A pagar e A receber são listas na data da exportação. Para atualizar baixas ou vencimentos, altere no sistema e exporte novamente.'],
  ];
  table(guide, ['Assunto', 'Orientação'], instructions, [28, 125], [], false);
  guide.eachRow((row, i) => { if (i > 6) row.height = 44; });
  panel.views = [{ state: 'frozen', ySplit: 5, showGridLines: false, zoomScale: 75 }];
  // Abas de equipes ficam logo após o painel, sem alterar os IDs usados pelos gráficos.
  [panel, ...teamSheets, ...wb.worksheets.filter(ws => ws !== panel && !teamSheets.includes(ws))].forEach((ws, index) => { ws.orderNo = index; });
  if (report === 'teams') {
    const keep = new Set([panel, daily, lists, guide, ...teamSheets, wb.getWorksheet('Legenda recebimentos')]);
    wb.worksheets.filter(ws => !keep.has(ws)).forEach(ws => wb.removeWorksheet(ws.id));
    daily.state = 'hidden';
    guide.getCell('B7').value = 'Relatório exclusivo das mensalidades. Painel geral, balancete e uma aba por equipe. Os lançamentos manuais dos outros livros não entram neste arquivo.';
  }
  wb.views = [{ activeTab: 0 }];
  return attachLedgerCharts(await wb.xlsx.writeBuffer(), [
    { title: 'Recebimentos e pagamentos por mês', months: MONTHS, series: [{ name: 'Recebido', column: 'B', color: '15803D', values: monthly.map(m => m.income) }, { name: 'Pago', column: 'C', color: 'DC2626', values: monthly.map(m => m.expenses) }] },
    { title: scope === 'all' ? 'Evolução do saldo acumulado' : 'Evolução do resultado do recorte', line: true, months: MONTHS, series: [{ name: 'Acumulado', column: 'E', color: '2563EB', values: monthly.map(m => m.balance) }] },
  ]);
}
module.exports = { buildLedgerWorkbook, filterLedgerEntries };
