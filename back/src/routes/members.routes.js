// Rotas de membros

const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');
const { rowToMember } = require('../models/converters');
const { nowIso, toInt } = require('../utils/helpers');
const { monthlyFlagFor } = require('../utils/payment-rules');

const router = express.Router();

router.get('/', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM members ORDER BY name').all();
  res.json(rows.map(rowToMember));
});

router.post('/', async (req, res) => {
  try {
    const data = req.body || {};
    const id = uuid();
    const ts = nowIso();
    const stmt = await db.prepare(`
      INSERT INTO members (
        id, name, nickname, dob, rg, cpf, blood_type, gender, marital_status,
        spouse_name, spouse_cpf, marriage_date, mfc_date, phone, emergency_phone,
        status, team_id, street, number, neighborhood, zip, complement, city, state,
        condir, naturalness, father, mother, smoker, mobility_issue, health_plan, diet,
        medication, allergy, pcd, pcd_description, profession, religion, education,
        photo_url, movement_roles, family_name, relationship_type, pays_monthly, created_at, updated_at, is_payment_inactive
      ) VALUES (
        @id, @name, @nickname, @dob, @rg, @cpf, @bloodType, @gender, @maritalStatus,
        @spouseName, @spouseCpf, @marriageDate, @mfcDate, @phone, @emergencyPhone,
        @status, @teamId, @street, @number, @neighborhood, @zip, @complement, @city, @state,
        @condir, @naturalness, @father, @mother, @smoker, @mobilityIssue, @healthPlan, @diet,
        @medication, @allergy, @pcd, @pcdDescription, @profession, @religion, @education,
        @photoUrl, @movementRoles, @familyName, @relationshipType, @paysMonthly, @createdAt, @updatedAt, @isPaymentInactive
      )
    `);

    // Se está vinculando a uma equipe, status automaticamente vira "Ativo"
    const finalStatus = data.teamId ? 'Ativo' : (data.status || 'Aguardando');

    await stmt.run({
      id,
      name: data.name || '',
      nickname: data.nickname || '',
      dob: data.dob || '',
      rg: data.rg || '',
      cpf: data.cpf || '',
      bloodType: data.bloodType || '',
      gender: data.gender || '',
      maritalStatus: data.maritalStatus || '',
      spouseName: data.spouseName || '',
      spouseCpf: data.spouseCpf || '',
      marriageDate: data.marriageDate || '',
      mfcDate: data.mfcDate || '',
      phone: data.phone || '',
      emergencyPhone: data.emergencyPhone || '',
      status: finalStatus,
      teamId: data.teamId || null,
      street: data.street || '',
      number: data.number || '',
      neighborhood: data.neighborhood || '',
      zip: data.zip || '',
      complement: data.complement || '',
      city: data.city || '',
      state: data.state || '',
      condir: data.condir || '',
      naturalness: data.naturalness || '',
      father: data.father || '',
      mother: data.mother || '',
      smoker: toInt(data.smoker),
      mobilityIssue: data.mobilityIssue || '',
      healthPlan: data.healthPlan || '',
      diet: data.diet || '',
      medication: data.medication || '',
      allergy: data.allergy || '',
      pcd: toInt(data.pcd),
      pcdDescription: data.pcdDescription || '',
      profession: data.profession || '',
      religion: data.religion || '',
      education: data.education || '',
      photoUrl: data.photoUrl || '',
      movementRoles: JSON.stringify(data.movementRoles || []),
      familyName: data.familyName || '',
      relationshipType: data.relationshipType || 'Titular',
      // Dependentes (filhos e outros vínculos familiares) nunca entram na cobrança.
      paysMonthly: monthlyFlagFor(data),
      createdAt: ts,
      updatedAt: ts,
      isPaymentInactive: toInt(data.isPaymentInactive)
    });

    const row = await db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    res.status(201).json(rowToMember(row));
  } catch (error) {
    console.error('Erro ao criar membro:', error);
    res.status(500).json({ error: 'Erro ao criar membro: ' + error.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body || {};
  const ts = nowIso();
  
  // Se está vinculando a uma equipe, status automaticamente vira "Ativo"
  // Se está removendo da equipe (teamId null/undefined), status vira "Aguardando"
  let finalStatus = data.status;
  if (data.teamId) {
    finalStatus = 'Ativo';
  } else if (data.hasOwnProperty('teamId') && !data.teamId && !data.status) {
    finalStatus = 'Aguardando';
  }
  
  await db.prepare(`
    UPDATE members SET
      name = @name,
      nickname = @nickname,
      dob = @dob,
      rg = @rg,
      cpf = @cpf,
      blood_type = @bloodType,
      gender = @gender,
      marital_status = @maritalStatus,
      spouse_name = @spouseName,
      spouse_cpf = @spouseCpf,
      marriage_date = @marriageDate,
      mfc_date = @mfcDate,
      phone = @phone,
      emergency_phone = @emergencyPhone,
      status = @status,
      team_id = @teamId,
      street = @street,
      number = @number,
      neighborhood = @neighborhood,
      zip = @zip,
      complement = @complement,
      city = @city,
      state = @state,
      condir = @condir,
      naturalness = @naturalness,
      father = @father,
      mother = @mother,
      smoker = @smoker,
      mobility_issue = @mobilityIssue,
      health_plan = @healthPlan,
      diet = @diet,
      medication = @medication,
      allergy = @allergy,
      pcd = @pcd,
      pcd_description = @pcdDescription,
      profession = @profession,
      religion = @religion,
      education = @education,
      photo_url = @photoUrl,
      movement_roles = @movementRoles,
      family_name = @familyName,
      relationship_type = @relationshipType,
      pays_monthly = @paysMonthly,
      updated_at = @updatedAt,
      is_payment_inactive = @isPaymentInactive
    WHERE id = @id
  `).run({
    id,
    name: data.name || '',
    nickname: data.nickname || '',
    dob: data.dob || '',
    rg: data.rg || '',
    cpf: data.cpf || '',
    bloodType: data.bloodType || '',
    gender: data.gender || '',
    maritalStatus: data.maritalStatus || '',
    spouseName: data.spouseName || '',
    spouseCpf: data.spouseCpf || '',
    marriageDate: data.marriageDate || '',
    mfcDate: data.mfcDate || '',
    phone: data.phone || '',
    emergencyPhone: data.emergencyPhone || '',
    status: finalStatus,
    teamId: data.teamId || null,
    street: data.street || '',
    number: data.number || '',
    neighborhood: data.neighborhood || '',
    zip: data.zip || '',
    complement: data.complement || '',
    city: data.city || '',
    state: data.state || '',
    condir: data.condir || '',
    naturalness: data.naturalness || '',
    father: data.father || '',
    mother: data.mother || '',
    smoker: toInt(data.smoker),
    mobilityIssue: data.mobilityIssue || '',
    healthPlan: data.healthPlan || '',
    diet: data.diet || '',
    medication: data.medication || '',
    allergy: data.allergy || '',
    pcd: toInt(data.pcd),
    pcdDescription: data.pcdDescription || '',
    profession: data.profession || '',
    religion: data.religion || '',
    education: data.education || '',
    photoUrl: data.photoUrl || '',
    movementRoles: JSON.stringify(data.movementRoles || []),
    familyName: data.familyName || '',
    relationshipType: data.relationshipType || 'Titular',
    // A isenção e a composição familiar são aplicadas também pela API.
    paysMonthly: monthlyFlagFor(data),
    updatedAt: ts,
    isPaymentInactive: toInt(data.isPaymentInactive)
  });

  const row = await db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  res.json(rowToMember(row));
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  await db.prepare('DELETE FROM members WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
