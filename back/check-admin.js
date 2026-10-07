require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function checkAndFixAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mfc_system'
  });

  try {
    console.log('🔍 Verificando usuário admin...\n');

    // Buscar admin
    const [users] = await connection.execute(
      'SELECT id, username, email, password_hash, role FROM users WHERE username = ?',
      ['admin']
    );

    if (users.length === 0) {
      console.log('❌ Usuário admin não encontrado!');
      console.log('🔧 Criando usuário admin...');
      
      const adminPasswordHash = bcrypt.hashSync('admin123', 10);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      
      await connection.execute(
        `INSERT INTO users (id, username, email, name, city_id, role, team_id, password_hash, created_at, updated_at, active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['u1', 'admin', 'admin@mfc.org', 'Administrador Geral', '1', 'Administrador', null, adminPasswordHash, now, now, 1]
      );
      
      console.log('✅ Usuário admin criado com sucesso!');
    } else {
      const user = users[0];
      console.log('✅ Usuário encontrado:');
      console.log('   ID:', user.id);
      console.log('   Username:', user.username);
      console.log('   Email:', user.email);
      console.log('   Role:', user.role);
      console.log('   Hash:', user.password_hash.substring(0, 20) + '...');

      // Testar senha
      console.log('\n🔐 Testando senha...');
      const isValid = bcrypt.compareSync('admin123', user.password_hash);
      
      if (isValid) {
        console.log('✅ Senha "admin123" está CORRETA!');
      } else {
        console.log('❌ Senha "admin123" NÃO confere com o hash!');
        console.log('🔧 Atualizando hash da senha...');
        
        const newHash = bcrypt.hashSync('admin123', 10);
        await connection.execute(
          'UPDATE users SET password_hash = ? WHERE id = ?',
          [newHash, user.id]
        );
        
        console.log('✅ Hash atualizado com sucesso!');
        console.log('   Novo hash:', newHash.substring(0, 20) + '...');
        
        // Testar novamente
        const isValidNow = bcrypt.compareSync('admin123', newHash);
        console.log('   Validação:', isValidNow ? '✅ OK' : '❌ ERRO');
      }
    }

    console.log('\n📝 Teste de login:');
    console.log('   Usuário: admin');
    console.log('   Senha: admin123');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

checkAndFixAdmin().catch(error => {
  console.error('\n❌ Falha:', error.message);
  process.exit(1);
});
