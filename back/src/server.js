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
const blogRoutes = require('./routes/blog.routes');

const app = express();

// Middlewares globais
app.use(cors());
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// Garantir UTF-8 em todas as respostas
app.use((req, res, next) => {
  // Arquivos estáticos precisam conservar seu tipo correto (CSS, PNG, fontes etc.).
  if (!req.path.startsWith('/site/') && !req.path.startsWith('/uploads/') && !req.path.startsWith('/images/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
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
app.use('/blog', blogRoutes);

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
const publicSitePath = path.join(__dirname, '../../sites/mfc-encontros/dist');
app.use('/images', express.static(path.join(__dirname, '../../images')));
app.use('/site', express.static(publicSitePath));
const frontDistPath = path.join(__dirname, '../../front/dist');
app.use(express.static(frontDistPath));
// Só é API quando o caminho é exatamente a raiz (ou começa com ela + "/"): antes "/configuracoes" era tratado como "/config" e dava erro ao atualizar a página.
app.get(/^(?!\/(?:auth|cities|teams|roles|members|member-photos|users|events|dashboard|config|api|daily-entries|bridal-couples|bridal-meetings|nucleation|blog|payments|event-sales|ledger|ledger-entities|uploads|health)(?:[/?]|$)).*/, (req, res) => {
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
            // Subir em outra porta em silêncio já causou confusão: o front continua falando com a porta antiga (a do outro processo).
            console.warn(`\n⚠️  A porta ${port} já está em uso, provavelmente por um backend antigo ainda aberto.\n` +
              `   Esta instância vai subir em ${port + 1}, mas o front usa VITE_API_URL (normalmente ${PORT}) e NÃO vai falar com ela.\n` +
              `   Feche o processo antigo (PowerShell: Get-NetTCPConnection -LocalPort ${port} | Select OwningProcess; Stop-Process -Id <PID>) e reinicie.\n`);
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
