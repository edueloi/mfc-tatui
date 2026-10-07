// Rotas de casais do Encontro de Noivos

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { rowToBridalCouple, rowToBridalPartner, rowToBridalDocument } = require('../models/converters');
const { nowIso, toInt } = require('../utils/helpers');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/bridal');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

async function loadCoupleFull(id) {
  const coupleRow = await db.prepare('SELECT * FROM bridal_couples WHERE id = ?').get(id);
  if (!coupleRow) return null;

  const partnerRows = await db.prepare('SELECT * FROM bridal_partners WHERE couple_id = ? ORDER BY role').all(id);
  const documentRows = await db.prepare('SELECT * FROM bridal_documents WHERE couple_id = ? ORDER BY uploaded_at DESC').all(id);

  return {
    ...rowToBridalCouple(coupleRow),
    partners: partnerRows.map(rowToBridalPartner),
    documents: documentRows.map(rowToBridalDocument)
  };
}

async function savePartner(coupleId, role, data) {
  const id = uuid();
  await db.prepare(`
    INSERT INTO bridal_partners (
      id, couple_id, role, name, dob, profession, education, religion, parish, phone, email,
      street, number, neighborhood, zip, complement, city, state
    ) VALUES (
      @id, @coupleId, @role, @name, @dob, @profession, @education, @religion, @parish, @phone, @email,
      @street, @number, @neighborhood, @zip, @complement, @city, @state
    )
  `).run({
    id,
    coupleId,
    role,
    name: data.name || '',
    dob: data.dob || '',
    profession: data.profession || '',
    education: data.education || '',
    religion: data.religion || '',
    parish: data.parish || '',
    phone: data.phone || '',
    email: data.email || '',
    street: data.street || '',
    number: data.number || '',
    neighborhood: data.neighborhood || '',
    zip: data.zip || '',
    complement: data.complement || '',
    city: data.city || '',
    state: data.state || ''
  });
  return id;
}

async function updatePartner(id, data) {
  await db.prepare(`
    UPDATE bridal_partners SET
      name = @name, dob = @dob, profession = @profession, education = @education, religion = @religion,
      parish = @parish, phone = @phone, email = @email, street = @street,
      number = @number, neighborhood = @neighborhood, zip = @zip,
      complement = @complement, city = @city, state = @state
    WHERE id = @id
  `).run({
    id,
    name: data.name || '',
    dob: data.dob || '',
    profession: data.profession || '',
    education: data.education || '',
    religion: data.religion || '',
    parish: data.parish || '',
    phone: data.phone || '',
    email: data.email || '',
    street: data.street || '',
    number: data.number || '',
    neighborhood: data.neighborhood || '',
    zip: data.zip || '',
    complement: data.complement || '',
    city: data.city || '',
    state: data.state || ''
  });
}

// Listagem (com nomes dos parceiros para o grid)
router.get('/', async (req, res) => {
  const rows = await db.prepare(`
    SELECT
      c.*,
      p1.name AS noivo_name,
      p2.name AS noiva_name
    FROM bridal_couples c
    LEFT JOIN bridal_partners p1 ON p1.couple_id = c.id AND p1.role = 'noivo'
    LEFT JOIN bridal_partners p2 ON p2.couple_id = c.id AND p2.role = 'noiva'
    ORDER BY c.created_at DESC
  `).all();

  res.json(rows.map(row => ({
    ...rowToBridalCouple(row),
    noivoName: row.noivo_name || '',
    noivaName: row.noiva_name || ''
  })));
});

// Detalhe completo (casal + os 2 partners + documentos)
router.get('/:id', async (req, res) => {
  try {
    const couple = await loadCoupleFull(req.params.id);
    if (!couple) return res.status(404).json({ error: 'Casal não encontrado.' });
    res.json(couple);
  } catch (error) {
    console.error('Erro ao buscar casal:', error);
    res.status(500).json({ error: 'Erro ao buscar casal: ' + error.message });
  }
});

// Rota pública — resolve pelo token do link externo
router.get('/public/:token', async (req, res) => {
  try {
    const coupleRow = await db.prepare('SELECT * FROM bridal_couples WHERE public_token = ?').get(req.params.token);
    if (!coupleRow) return res.status(404).json({ error: 'Ficha não encontrada.' });
    const couple = await loadCoupleFull(coupleRow.id);
    res.json(couple);
  } catch (error) {
    console.error('Erro ao buscar ficha pública:', error);
    res.status(500).json({ error: 'Erro ao buscar ficha: ' + error.message });
  }
});

router.put('/public/:token', async (req, res) => {
  try {
    const coupleRow = await db.prepare('SELECT * FROM bridal_couples WHERE public_token = ?').get(req.params.token);
    if (!coupleRow) return res.status(404).json({ error: 'Ficha não encontrada.' });

    const data = req.body || {};
    const ts = nowIso();

    await db.prepare(`
      UPDATE bridal_couples SET status = @status, filled_externally = 1, updated_at = @updatedAt
      WHERE id = @id
    `).run({
      id: coupleRow.id,
      status: data.status || coupleRow.status,
      updatedAt: ts
    });

    const partnerRows = await db.prepare('SELECT * FROM bridal_partners WHERE couple_id = ? ORDER BY role').all(coupleRow.id);
    if (data.noivo && partnerRows[0]) await updatePartner(partnerRows[0].id, data.noivo);
    if (data.noiva && partnerRows[1]) await updatePartner(partnerRows[1].id, data.noiva);

    const couple = await loadCoupleFull(coupleRow.id);
    res.json(couple);
  } catch (error) {
    console.error('Erro ao atualizar ficha pública:', error);
    res.status(500).json({ error: 'Erro ao atualizar ficha: ' + error.message });
  }
});

// Criar casal + 2 partners
router.post('/', async (req, res) => {
  try {
    const data = req.body || {};
    const id = uuid();
    const ts = nowIso();
    const token = uuid();

    await db.prepare(`
      INSERT INTO bridal_couples (
        id, city_id, event_id, status, public_token, filled_externally,
        payment_status, payment_amount, payment_date, payment_method, payment_observation,
        created_at, updated_at
      ) VALUES (
        @id, @cityId, @eventId, @status, @publicToken, @filledExternally,
        @paymentStatus, @paymentAmount, @paymentDate, @paymentMethod, @paymentObservation,
        @createdAt, @updatedAt
      )
    `).run({
      id,
      cityId: data.cityId || null,
      eventId: data.eventId || null,
      status: data.status || 'Rascunho',
      publicToken: token,
      filledExternally: toInt(data.filledExternally),
      paymentStatus: data.paymentStatus || 'Pendente',
      paymentAmount: data.paymentAmount ?? null,
      paymentDate: data.paymentDate || '',
      paymentMethod: data.paymentMethod || '',
      paymentObservation: data.paymentObservation || '',
      createdAt: ts,
      updatedAt: ts
    });

    await savePartner(id, 'noivo', data.noivo || {});
    await savePartner(id, 'noiva', data.noiva || {});

    const couple = await loadCoupleFull(id);
    res.status(201).json(couple);
  } catch (error) {
    console.error('Erro ao criar casal:', error);
    res.status(500).json({ error: 'Erro ao criar casal: ' + error.message });
  }
});

// Atualizar casal + partners
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body || {};
    const ts = nowIso();

    await db.prepare(`
      UPDATE bridal_couples SET
        city_id = @cityId, event_id = @eventId, status = @status,
        payment_status = @paymentStatus, payment_amount = @paymentAmount,
        payment_date = @paymentDate, payment_method = @paymentMethod,
        payment_observation = @paymentObservation, updated_at = @updatedAt
      WHERE id = @id
    `).run({
      id,
      cityId: data.cityId || null,
      eventId: data.eventId || null,
      status: data.status || 'Rascunho',
      paymentStatus: data.paymentStatus || 'Pendente',
      paymentAmount: data.paymentAmount ?? null,
      paymentDate: data.paymentDate || '',
      paymentMethod: data.paymentMethod || '',
      paymentObservation: data.paymentObservation || '',
      updatedAt: ts
    });

    const partnerRows = await db.prepare('SELECT * FROM bridal_partners WHERE couple_id = ? ORDER BY role').all(id);
    if (data.noivo && partnerRows[0]) await updatePartner(partnerRows[0].id, data.noivo);
    if (data.noiva && partnerRows[1]) await updatePartner(partnerRows[1].id, data.noiva);

    const couple = await loadCoupleFull(id);
    res.json(couple);
  } catch (error) {
    console.error('Erro ao atualizar casal:', error);
    res.status(500).json({ error: 'Erro ao atualizar casal: ' + error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM bridal_couples WHERE id = ?').run(req.params.id);
    res.status(204).end();
  } catch (error) {
    console.error('Erro ao excluir casal:', error);
    res.status(500).json({ error: 'Erro ao excluir casal: ' + error.message });
  }
});

// Upload de documentos
router.post('/:id/documents', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

  try {
    const { id } = req.params;
    const docId = uuid();
    const relativePath = `/uploads/bridal/${req.file.filename}`;

    await db.prepare(`
      INSERT INTO bridal_documents (id, couple_id, partner_id, file_name, file_path, mime_type, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(docId, id, req.body.partnerId || null, req.file.originalname, relativePath, req.file.mimetype, nowIso());

    const row = await db.prepare('SELECT * FROM bridal_documents WHERE id = ?').get(docId);
    res.status(201).json(rowToBridalDocument(row));
  } catch (error) {
    console.error('Erro ao anexar documento:', error);
    res.status(500).json({ error: 'Erro ao anexar documento: ' + error.message });
  }
});

router.delete('/:id/documents/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    const doc = await db.prepare('SELECT * FROM bridal_documents WHERE id = ?').get(docId);
    if (doc) {
      const filePath = path.join(__dirname, '../..', doc.file_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await db.prepare('DELETE FROM bridal_documents WHERE id = ?').run(docId);
    res.status(204).end();
  } catch (error) {
    console.error('Erro ao remover documento:', error);
    res.status(500).json({ error: 'Erro ao remover documento: ' + error.message });
  }
});

module.exports = router;
