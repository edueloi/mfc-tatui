/**
 * MFC System - Backend API
 * Servidor principal com rotas organizadas por módulos
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./db-mysql');

// Importar rotas
const authRoutes = require('./routes/auth.routes');
const citiesRoutes = require('./routes/cities.routes');
const teamsRoutes = require('./routes/teams.routes');
const rolesRoutes = require('./routes/roles.routes');
const membersRoutes = require('./routes/members.routes');
const usersRoutes = require('./routes/users.routes');
const eventsRoutes = require('./routes/events.routes');
const financeRoutes = require('./routes/finance.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const externalRoutes = require('./routes/external.routes');
const configRoutes = require('./routes/config.routes');
const dailyEntriesRoutes = require('./routes/daily-entries.routes');
const bridalCouplesRoutes = require('./routes/bridal-couples.routes');
const bridalMeetingsRoutes = require('./routes/bridal-meetings.routes');
const nucleationRoutes = require('./routes/nucleation.routes');

const app = express();

// Middlewares globais
app.use(cors());
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// Garantir UTF-8 em todas as respostas
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Registrar rotas
app.use('/auth', authRoutes);
app.use('/cities', citiesRoutes);
app.use('/teams', teamsRoutes);
app.use('/roles', rolesRoutes);
app.use('/members', membersRoutes);
app.use('/member-photos', require('./routes/member-photos.routes'));
app.use('/users', usersRoutes);
app.use('/events', eventsRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/config', configRoutes);
app.use('/api', externalRoutes);
app.use('/daily-entries', dailyEntriesRoutes);
app.use('/bridal-couples', bridalCouplesRoutes);
app.use('/bridal-meetings', bridalMeetingsRoutes);
app.use('/nucleation', nucleationRoutes);

// Rotas de finanças (reutiliza o mesmo router para múltiplos endpoints)
app.use('/', financeRoutes);

// Rota de saúde
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Servir arquivos anexados (documentos do Encontro de Noivos, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, filePath) => {
    res.type(filePath);
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// Servir o front buildado (produção / VPS)
const frontDistPath = path.join(__dirname, '../../front/dist');
app.use(express.static(frontDistPath));
app.get(/^(?!\/(auth|cities|teams|roles|members|users|events|dashboard|config|api|daily-entries|bridal-couples|bridal-meetings|nucleation|uploads|health)).*/, (req, res) => {
  res.sendFile(path.join(frontDistPath, 'index.html'));
});

// Tratamento de erros 404
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Tratamento global de erros
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

/**
 * Inicialização do servidor
 */
async function start() {
  try {
    // Inicializar conexão com banco de dados
    await initDatabase();
    
    // Porta configurável via env
    const PORT = parseInt(process.env.PORT) || 4000;
    
    // Tentar iniciar na porta especificada, ou na próxima disponível
    const tryListen = (port) => {
      const server = app.listen(port)
        .on('listening', () => {
          console.log(`🚀 MFC back rodando em http://localhost:${port}`);
        })
        .on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`⚠️  Porta ${port} em uso, tentando ${port + 1}...`);
            tryListen(port + 1);
          } else {
            console.error('❌ Erro ao iniciar servidor:', err);
            process.exit(1);
          }
        });
    };
    
    tryListen(PORT);
  } catch (error) {
    console.error('❌ Erro ao iniciar aplicação:', error);
    process.exit(1);
  }
}

// Iniciar aplicação
start();
