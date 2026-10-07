require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('🔧 Configurando banco de dados MySQL...\n');

  // Primeiro conecta sem especificar o banco para poder criá-lo
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    console.log('✅ Conectado ao MySQL');

    // Criar banco de dados se não existir
    const dbName = process.env.DB_NAME || 'mfc_system';
    console.log(`📦 Criando banco de dados: ${dbName}`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log('✅ Banco de dados criado/verificado');

    // Usar o banco
    await connection.query(`USE ${dbName}`);

    // Ler e executar schema
    console.log('📋 Importando schema...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // Remover a primeira linha USE e dividir por ponto-e-vírgula
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('USE '));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.query(statement);
        } catch (err) {
          if (!err.message.includes('Duplicate entry') && !err.message.includes('already exists')) {
            console.warn('⚠️  Aviso:', err.message.substring(0, 100));
          }
        }
      }
    }

    console.log('✅ Schema importado');

    // Verificar se usuário admin existe
    const [users] = await connection.query('SELECT id FROM users WHERE username = ?', ['admin']);
    
    if (users.length === 0) {
      console.log('👤 Criando usuário admin...');
      
      // Verificar se cidade existe
      const [cities] = await connection.query('SELECT id FROM cities WHERE id = ?', ['1']);
      if (cities.length === 0) {
        await connection.query(
          'INSERT INTO cities (id, name, uf, mfc_since, active) VALUES (?, ?, ?, ?, ?)',
          ['1', 'Tatuí', 'SP', '1965-07-01', 1]
        );
      }
      
      const adminPasswordHash = bcrypt.hashSync('admin123', 10);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      
      await connection.query(
        `INSERT INTO users (id, username, email, name, city_id, role, team_id, password_hash, created_at, updated_at, active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['u1', 'admin', 'admin@mfc.org', 'Administrador Geral', '1', 'Administrador', null, adminPasswordHash, now, now, 1]
      );
      
      console.log('✅ Usuário admin criado');
    } else {
      console.log('ℹ️  Usuário admin já existe');
      
      // Verificar se o hash está correto
      const [adminUser] = await connection.query('SELECT password_hash FROM users WHERE username = ?', ['admin']);
      if (adminUser.length > 0) {
        const isValid = bcrypt.compareSync('admin123', adminUser[0].password_hash);
        if (!isValid) {
          console.log('🔧 Corrigindo hash da senha...');
          const newHash = bcrypt.hashSync('admin123', 10);
          await connection.query('UPDATE users SET password_hash = ? WHERE username = ?', [newHash, 'admin']);
          console.log('✅ Hash corrigido');
        }
      }
    }

    console.log('\n🎉 Banco de dados configurado com sucesso!');
    console.log('\n📝 Informações de login:');
    console.log('   Usuário: admin');
    console.log('   Senha: admin123');
    console.log('\n🚀 Agora execute: node src/server.js');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

setupDatabase().catch(error => {
  console.error('\n❌ Falha na configuração:', error.message);
  process.exit(1);
});
