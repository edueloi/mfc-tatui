require('dotenv').config();
const mysql = require('mysql2/promise');

async function addPhotoColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔍 Verificando se coluna photo_url existe...');
    
    const [columns] = await connection.execute(
      `SHOW COLUMNS FROM members LIKE 'photo_url'`
    );

    if (columns.length > 0) {
      console.log('✅ Coluna photo_url já existe!');
    } else {
      console.log('➕ Adicionando coluna photo_url...');
      await connection.execute(
        `ALTER TABLE members ADD COLUMN photo_url TEXT AFTER education`
      );
      console.log('✅ Coluna photo_url adicionada com sucesso!');
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await connection.end();
  }
}

addPhotoColumn();
