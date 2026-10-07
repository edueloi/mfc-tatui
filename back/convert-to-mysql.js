// Script para converter server.js para usar MySQL
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src', 'server.js');
const backupPath = path.join(__dirname, 'src', 'server.js.backup');

console.log('🔄 Convertendo server.js para MySQL...\n');

// Ler arquivo
let content = fs.readFileSync(serverPath, 'utf-8');

// Backup
fs.writeFileSync(backupPath, content, 'utf-8');
console.log('✅ Backup criado em:', backupPath);

// 1. Mudar import do db
content = content.replace(
  /const { db } = require\('\.\/db'\);/,
  "const { db, initDatabase } = require('./db-mysql');"
);
console.log('✅ Import do db atualizado');

// 2. Converter rotas para async
const routes = [
  'app.get\\(',
  'app.post\\(',
  'app.put\\(',
  'app.delete\\(',
  'app.patch\\('
];

routes.forEach(routePattern => {
  // Padrão: app.METHOD('path', (req, res) => {
  const regex1 = new RegExp(`(${routePattern}'[^']+',\\s*)\\((req,\\s*res)\\)\\s*=>\\s*{`, 'g');
  content = content.replace(regex1, '$1async ($2) => {');
  
  // Padrão: app.METHOD('path', function(req, res) {
  const regex2 = new RegExp(`(${routePattern}'[^']+',\\s*)function\\s*\\((req,\\s*res)\\)\\s*{`, 'g');
  content = content.replace(regex2, '$1async function($2) {');
});
console.log('✅ Rotas convertidas para async');

// 3. Adicionar await antes de db.prepare
content = content.replace(/(\s+)(const\s+\w+\s*=\s*)?db\.prepare\(/g, '$1$2await db.prepare(');
content = content.replace(/(\s+)db\.prepare\(/g, '$1await db.prepare(');
console.log('✅ Chamadas db.prepare com await adicionado');

// 4. Adicionar try/catch nas rotas (simplificado - adicionar manualmente se necessário)
console.log('⚠️  Adicione try/catch manualmente nas rotas se necessário');

// 5. Mudar app.listen para start() assíncrono
const listenPattern = /const PORT[^;]+;[\s\S]*?app\.listen\(PORT[^}]+}\);/;
const newListen = `async function start() {
  await initDatabase();
  
  let port = parseInt(process.env.PORT) || 4000;
  const maxPort = port + 10;
  
  while (port < maxPort) {
    try {
      const server = await new Promise((resolve, reject) => {
        const srv = app.listen(port)
          .on('listening', () => resolve(srv))
          .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
              console.log(\`⚠️  Porta \${port} em uso, tentando \${port + 1}...\`);
              port++;
              resolve(null);
            } else {
              reject(err);
            }
          });
      });
      
      if (server) {
        console.log(\`✅ MFC back rodando em http://localhost:\${port}\`);
        break;
      }
    } catch (error) {
      console.error('❌ Erro ao iniciar servidor:', error);
      process.exit(1);
    }
  }
}

start().catch(console.error);`;

content = content.replace(listenPattern, newListen);
console.log('✅ app.listen substituído por start() assíncrono');

// Salvar
fs.writeFileSync(serverPath, content, 'utf-8');
console.log('✅ server.js atualizado!\n');

console.log('📝 Próximos passos:');
console.log('1. Configure o .env com suas credenciais MySQL');
console.log('2. Crie o banco: mysql -u root -p -e "CREATE DATABASE mfc_system"');
console.log('3. Importe o schema: mysql -u root -p mfc_system < schema.sql');
console.log('4. Execute: node src/server.js');
