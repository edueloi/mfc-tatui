const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configuração do Multer para upload temporário
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `import-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Função para converter data do Excel para formato YYYY-MM-DD
function excelDateToISODate(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') return excelDate;
  // Excel base date is 1899-12-30
  const date = new Date((excelDate - 25569) * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

// Rota para importar planilha
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Importando ${data.length} registros...`);

    // Limpar registros anteriores se necessário (opcional - dependendo da regra de negócio)
    // Para simplificar, vamos apenas adicionar. O usuário pode querer resetar a base.
    // Se quiser resetar: await db.prepare('DELETE FROM mfc_daily_entries').run();

    for (const row of data) {
      const id = uuid();
      const date = excelDateToISODate(row['Dia']);
      const costCenter = row['C. Custo'] || row['C.Custo'] || '';
      const synthetic = row['Sintético'] || '';
      const analytic = row['Analítico'] || '';
      const amount = parseFloat(row['Valor']) || 0;
      const account = row['Conta'] || '';
      const observation = row['Observação'] || '';

      if (!date || isNaN(amount)) continue;

      await db.prepare(`
        INSERT INTO mfc_daily_entries (id, date, cost_center, synthetic, analytic, amount, account, observation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, date, costCenter, synthetic, analytic, amount, account, observation);
    }

    // Remover arquivo temporário
    fs.unlinkSync(req.file.path);

    res.json({ message: 'Planilha importada com sucesso!', count: data.length });
  } catch (error) {
    console.error('❌ Erro na importação:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Erro ao processar planilha: ' + error.message });
  }
});

// Rota para listar lançamentos
router.get('/', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT * FROM mfc_daily_entries ORDER BY date DESC').all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para estatísticas e relatórios
router.get('/stats', async (req, res) => {
  try {
    const [summary] = await db.prepare(`
      SELECT 
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as total_expenses,
        SUM(amount) as balance
      FROM mfc_daily_entries
    `).all();

    const byCostCenter = await db.prepare(`
      SELECT cost_center, SUM(amount) as total
      FROM mfc_daily_entries
      GROUP BY cost_center
      ORDER BY total DESC
    `).all();

    const byMonth = await db.prepare(`
      SELECT DATE_FORMAT(date, '%Y-%m') as month, SUM(amount) as total
      FROM mfc_daily_entries
      GROUP BY month
      ORDER BY month DESC
    `).all();

    res.json({ summary, byCostCenter, byMonth });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para deletar todos os registros (re-importação limpa)
router.delete('/clear', async (req, res) => {
  try {
    await db.prepare('DELETE FROM mfc_daily_entries').run();
    res.json({ message: 'Registros removidos com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
