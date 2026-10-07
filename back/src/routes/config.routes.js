// Rotas de configurações financeiras

const express = require('express');
const { db } = require('../db-mysql');

const router = express.Router();

// GET - Buscar configurações financeiras
router.get('/', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT * FROM financial_config WHERE id = 1').all();
    
    if (rows.length === 0) {
      // Se não existe, criar com valores padrão
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      await db.prepare(
        'INSERT INTO financial_config (id, monthly_payment_amount, event_ticket_default_value, currency, updated_at) VALUES (1, 50.00, 100.00, ?, ?)'
      ).run('BRL', now);
      
      return res.json({
        monthlyPaymentAmount: 50.00,
        eventTicketDefaultValue: 100.00,
        currency: 'BRL'
      });
    }

    const config = rows[0];
    res.json({
      monthlyPaymentAmount: config.monthly_payment_amount,
      eventTicketDefaultValue: config.event_ticket_default_value,
      currency: config.currency
    });
  } catch (error) {
    console.error('Erro ao buscar configurações financeiras:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

// PUT - Atualizar configurações financeiras
router.put('/', async (req, res) => {
  try {
    const { monthlyPaymentAmount, eventTicketDefaultValue, currency } = req.body;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const monthlyValue = Number(monthlyPaymentAmount);
    const eventValue = Number(eventTicketDefaultValue);

    if (!Number.isFinite(monthlyValue) || monthlyValue < 0 || !Number.isFinite(eventValue) || eventValue < 0) {
      return res.status(400).json({ error: 'Os valores financeiros precisam ser números iguais ou maiores que zero.' });
    }

    await db.prepare(
      `INSERT INTO financial_config (id, monthly_payment_amount, event_ticket_default_value, currency, updated_at)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         monthly_payment_amount = VALUES(monthly_payment_amount),
         event_ticket_default_value = VALUES(event_ticket_default_value),
         currency = VALUES(currency),
         updated_at = VALUES(updated_at)`
    ).run(monthlyValue, eventValue, currency || 'BRL', now);

    res.json({
      monthlyPaymentAmount: monthlyValue,
      eventTicketDefaultValue: eventValue,
      currency: currency || 'BRL'
    });
  } catch (error) {
    console.error('Erro ao atualizar configurações financeiras:', error);
    res.status(500).json({ error: 'Erro ao atualizar configurações' });
  }
});

module.exports = router;
