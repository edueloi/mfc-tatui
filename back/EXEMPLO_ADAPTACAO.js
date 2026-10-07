// EXEMPLO DE COMO ADAPTAR AS ROTAS PARA MySQL (async/await)

// ========================================
// LINHA 5 - Mudar import
// ========================================
// ANTES:
const { db } = require('./db');

// DEPOIS:
const { db, initDatabase } = require('./db-mysql');


// ========================================
// FINAL DO ARQUIVO - Mudar app.listen
// ========================================
// ANTES:
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ MFC back rodando em http://localhost:${PORT}`);
});

// DEPOIS:
async function start() {
  await initDatabase();
  
  let port = parseInt(process.env.PORT) || 4000;
  const maxPort = port + 10;
  
  while (port < maxPort) {
    try {
      await new Promise((resolve, reject) => {
        const server = app.listen(port)
          .on('listening', () => resolve(server))
          .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
              console.log(`⚠️  Porta ${port} em uso, tentando ${port + 1}...`);
              port++;
              resolve(null);
            } else {
              reject(err);
            }
          });
      }).then(server => {
        if (server) {
          console.log(`✅ MFC back rodando em http://localhost:${port}`);
          return true;
        }
        return false;
      });
      
      if (port < maxPort) break;
    } catch (error) {
      console.error('❌ Erro ao iniciar servidor:', error);
      process.exit(1);
    }
  }
}

start().catch(console.error);


// ========================================
// EXEMPLO: ADAPTAR ROTA GET
// ========================================
// ANTES (síncrono):
app.get('/members', (req, res) => {
  const rows = db.prepare('SELECT * FROM members ORDER BY name').all();
  res.json(rows.map(rowToMember));
});

// DEPOIS (assíncrono):
app.get('/members', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT * FROM members ORDER BY name').all();
    res.json(rows.map(rowToMember));
  } catch (error) {
    console.error('Erro ao buscar membros:', error);
    res.status(500).json({ error: 'Erro ao buscar membros' });
  }
});


// ========================================
// EXEMPLO: ADAPTAR ROTA POST
// ========================================
// ANTES (síncrono):
app.post('/members', (req, res) => {
  const data = req.body || {};
  const id = uuid();
  
  db.prepare(`INSERT INTO members (...) VALUES (...)`).run({
    id,
    name: data.name,
    // ...outros campos
  });
  
  const row = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  res.status(201).json(rowToMember(row));
});

// DEPOIS (assíncrono):
app.post('/members', async (req, res) => {
  try {
    const data = req.body || {};
    const id = uuid();
    
    await db.prepare(`INSERT INTO members (...) VALUES (...)`).run({
      id,
      name: data.name,
      // ...outros campos
    });
    
    const row = await db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    res.status(201).json(rowToMember(row));
  } catch (error) {
    console.error('Erro ao criar membro:', error);
    res.status(500).json({ error: 'Erro ao criar membro' });
  }
});


// ========================================
// EXEMPLO: ADAPTAR ROTA DELETE
// ========================================
// ANTES (síncrono):
app.delete('/members/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM members WHERE id = ?').run(id);
  res.status(204).end();
});

// DEPOIS (assíncrono):
app.delete('/members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM members WHERE id = ?').run(id);
    res.status(204).end();
  } catch (error) {
    console.error('Erro ao deletar membro:', error);
    res.status(500).json({ error: 'Erro ao deletar membro' });
  }
});


// ========================================
// RESUMO DAS MUDANÇAS NECESSÁRIAS:
// ========================================
// 1. Mudar require('./db') para require('./db-mysql')
// 2. Adicionar async nas funções de rota: (req, res) => {...}  →  async (req, res) => {...}
// 3. Adicionar await antes de db.prepare(...).run/get/all
// 4. Adicionar try/catch para tratar erros
// 5. Substituir app.listen pelo código de start() assíncrono
