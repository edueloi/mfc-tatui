/**
 * Script de migração: Adicionar sistema de famílias
 * Executa: node migrate-family-system.js
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
    
    console.log('📋 Adicionando campos de família na tabela members...');
    
    // Verificar se os campos já existem
    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM members LIKE 'family_name'
    `);
    
    if (columns.length > 0) {
      console.log('⚠️  Campos já existem, pulando migração...');
      return;
    }
    
    // Adicionar campos
    await connection.execute(`
      ALTER TABLE members
      ADD COLUMN family_name VARCHAR(255) AFTER photo_url,
      ADD COLUMN relationship_type VARCHAR(50) DEFAULT 'Titular' AFTER family_name,
      ADD COLUMN pays_monthly TINYINT(1) DEFAULT 1 AFTER relationship_type
    `);
    
    console.log('✅ Campos adicionados com sucesso!');
    
    // Preencher family_name inicial baseado no sobrenome
    console.log('📝 Preenchendo nomes de família iniciais...');
    await connection.execute(`
      UPDATE members 
      SET family_name = SUBSTRING_INDEX(name, ' ', -1)
      WHERE family_name IS NULL
    `);
    
    console.log('✅ Nomes de família preenchidos!');
    
    // Marcar cônjuges existentes
    console.log('💑 Identificando cônjuges...');
    await connection.execute(`
      UPDATE members m1
      JOIN members m2 ON m1.spouse_name = m2.name AND m1.id != m2.id
      SET m1.relationship_type = 'Cônjuge'
      WHERE m1.spouse_name IS NOT NULL AND m1.spouse_name != ''
    `);
    
    console.log('✅ Cônjuges identificados!');
    
    // Verificar resultado
    const [stats] = await connection.execute(`
      SELECT 
        relationship_type,
        COUNT(*) as total
      FROM members
      GROUP BY relationship_type
    `);
    
    console.log('\n📊 Estatísticas:');
    console.table(stats);
    
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
