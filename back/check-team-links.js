require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkTeamLinks() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('\n📋 Verificando vínculos de usuários e equipes...\n');
    
    // Buscar todos os usuários ativos
    const [users] = await connection.execute(
      'SELECT id, username, name, team_id FROM users WHERE active = 1'
    );

    console.log(`👥 ${users.length} usuário(s) ativo(s):\n`);

    for (const user of users) {
      console.log(`📝 Usuário: ${user.name} (${user.username})`);
      
      // Buscar member com o mesmo nome
      const [members] = await connection.execute(
        'SELECT id, name, team_id FROM members WHERE name = ?',
        [user.name]
      );

      if (members.length > 0) {
        const member = members[0];
        console.log(`   ✓ Member encontrado: ${member.name}`);
        
        if (member.team_id) {
          // Buscar nome da equipe
          const [teams] = await connection.execute(
            'SELECT id, name FROM teams WHERE id = ?',
            [member.team_id]
          );
          
          if (teams.length > 0) {
            console.log(`   ✓ Equipe do member: ${teams[0].name} (${member.team_id})`);
            
            // Verificar se user.team_id está sincronizado
            if (user.team_id !== member.team_id) {
              console.log(`   ⚠️  User.team_id está diferente (${user.team_id})`);
              console.log(`   📝 Atualizando user.team_id para ${member.team_id}...`);
              
              await connection.execute(
                'UPDATE users SET team_id = ? WHERE id = ?',
                [member.team_id, user.id]
              );
              
              console.log(`   ✅ Atualizado!`);
            } else {
              console.log(`   ✓ User.team_id sincronizado!`);
            }
          } else {
            console.log(`   ❌ Equipe ${member.team_id} não encontrada no banco`);
          }
        } else {
          console.log(`   ⚠️  Member não tem equipe (team_id null)`);
        }
      } else {
        console.log(`   ❌ Nenhum member encontrado com o nome "${user.name}"`);
      }
      
      console.log('');
    }

    console.log('✅ Verificação completa!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await connection.end();
  }
}

checkTeamLinks();
