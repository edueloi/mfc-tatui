require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Configuração do MySQL
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mfc_system',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

// Criar pool de conexões
async function initDatabase() {
  try {
    pool = mysql.createPool(DB_CONFIG);
    
    // Testar conexão
    const connection = await pool.getConnection();
    console.log('✅ Conectado ao MySQL');
    connection.release();
    
    // Inicializar dados se necessário
    await initializeData();
    
    return pool;
  } catch (error) {
    console.error('❌ Erro ao conectar ao MySQL:', error.message);
    console.log('💡 Verifique se o MySQL está rodando e se as credenciais estão corretas');
    console.log('📝 Configuração atual:', { ...DB_CONFIG, password: '***' });
    process.exit(1);
  }
}

async function initializeData() {
  try {
    // Verificar se já existe o usuário admin
    const [users] = await pool.execute('SELECT id FROM users WHERE username = ?', ['admin']);
    
    if (users.length === 0) {
      console.log('📦 Inicializando dados padrão...');
      
      // Criar cidade padrão se não existir
      const [cities] = await pool.execute('SELECT id FROM cities WHERE id = ?', ['1']);
      if (cities.length === 0) {
        await pool.execute(
          'INSERT INTO cities (id, name, uf, mfc_since, active) VALUES (?, ?, ?, ?, ?)',
          ['1', 'Tatuí', 'SP', '1965-07-01', 1]
        );
      }
      
      // Criar usuário admin
      const adminPasswordHash = bcrypt.hashSync('admin123', 10);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      await pool.execute(
        `INSERT INTO users (id, username, email, name, city_id, role, team_id, password_hash, created_at, updated_at, active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['u1', 'admin', 'admin@mfc.org', 'Administrador Geral', '1', 'Administrador', null, adminPasswordHash, now, now, 1]
      );
      
      console.log('✅ Dados padrão criados');
      console.log('👤 Login: admin / admin123');
    }
  } catch (error) {
    console.error('⚠️  Erro ao inicializar dados:', error.message);
  }
}

// Wrapper para manter compatibilidade com código existente
const db = {
  prepare: (sql) => {
    return {
      run: async (...params) => {
        try {
          // Função auxiliar para converter datas ISO para formato MySQL
          const formatDateForMySQL = (value) => {
            if (value instanceof Date) {
              return value.toISOString().replace('T', ' ').substring(0, 19);
            }
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
              return value.replace('T', ' ').substring(0, 19);
            }
            return value;
          };

          // Se o último parâmetro é um objeto (named params), usar ele
          const lastParam = params[params.length - 1];
          if (lastParam && typeof lastParam === 'object' && !Array.isArray(lastParam)) {
            // Named parameters - converter para array na ordem correta
            const match = sql.match(/@(\w+)/g);
            if (match) {
              const orderedParams = match.map(m => {
                const key = m.substring(1);
                const value = lastParam[key];
                return formatDateForMySQL(value);
              });
              const cleanSql = sql.replace(/@\w+/g, '?');
              const [result] = await pool.execute(cleanSql, orderedParams);
              return result;
            }
          }
          
          // Positional parameters - também converter datas
          const formattedParams = params.map(formatDateForMySQL);
          const [result] = await pool.execute(sql, formattedParams);
          return result;
        } catch (error) {
          console.error('Erro no SQL:', sql);
          console.error('Params:', params);
          throw error;
        }
      },
      
      get: async (...params) => {
        try {
          const [rows] = await pool.execute(sql, params);
          return rows[0] || null;
        } catch (error) {
          console.error('Erro no SQL:', sql);
          console.error('Params:', params);
          throw error;
        }
      },
      
      all: async (...params) => {
        try {
          const [rows] = await pool.execute(sql, params);
          return rows;
        } catch (error) {
          console.error('Erro no SQL:', sql);
          console.error('Params:', params);
          throw error;
        }
      }
    };
  }
};

module.exports = { db, initDatabase, pool };
