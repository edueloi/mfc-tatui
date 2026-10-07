require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  console.log('🔄 Executando migração: adicionar photo_url...\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mfc_system'
  });

  try {
    console.log('✅ Conectado ao MySQL');

    // Verificar se a coluna já existe
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM members LIKE 'photo_url'"
    );

    if (columns.length > 0) {
      console.log('⚠️  Coluna photo_url já existe. Nada a fazer.');
    } else {
      // Adicionar a coluna
      await connection.query(
        'ALTER TABLE members ADD COLUMN photo_url TEXT AFTER education'
      );
      console.log('✅ Coluna photo_url adicionada com sucesso!');
    }

    await connection.end();
    console.log('\n✅ Migração concluída!');
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    await connection.end();
    process.exit(1);
  }
}

migrate();
