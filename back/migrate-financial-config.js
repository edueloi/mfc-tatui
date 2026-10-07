/**
 * Script de migração: Adicionar tabela financial_config
 * Executa: node migrate-financial-config.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mfc_system',
  charset: 'utf8mb4',
  multipleStatements: true
};

async function runMigration() {
  let connection;
  
  try {
    console.log('🔄 Conectando ao MySQL...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Conectado!');
    
    console.log('📋 Criando tabela financial_config...');
    
    // Criar tabela
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS financial_config (
        id INT PRIMARY KEY DEFAULT 1,
        monthly_payment_amount DECIMAL(10,2) DEFAULT 50.00,
        event_ticket_default_value DECIMAL(10,2) DEFAULT 100.00,
        currency VARCHAR(10) DEFAULT 'BRL',
        updated_at DATETIME NOT NULL,
        updated_by VARCHAR(36)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ Tabela criada!');
    
    // Inserir valores padrão
    console.log('📝 Inserindo configuração padrão...');
    await connection.execute(`
      INSERT IGNORE INTO financial_config 
      (id, monthly_payment_amount, event_ticket_default_value, currency, updated_at) 
      VALUES (1, 50.00, 100.00, 'BRL', NOW())
    `);
    
    console.log('✅ Configuração padrão inserida!');
    
    // Verificar resultado
    const [rows] = await connection.execute('SELECT * FROM financial_config WHERE id = 1');
    console.log('\n📊 Configuração atual:');
    console.log(rows[0]);
    
    console.log('\n✨ Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
