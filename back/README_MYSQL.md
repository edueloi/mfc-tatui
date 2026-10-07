# 🚀 GUIA RÁPIDO - Migração para MySQL

## ⚡ Passo a Passo

### 1️⃣ Instalar MySQL
- **Windows**: Baixe o MySQL Installer ou use XAMPP
  - MySQL Installer: https://dev.mysql.com/downloads/installer/
  - XAMPP: https://www.apachefriends.org/pt_br/download.html

### 2️⃣ Criar o Banco de Dados

Abra o MySQL:
```bash
mysql -u root -p
```

Execute:
```sql
CREATE DATABASE mfc_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### 3️⃣ Importar o Schema

No terminal:
```bash
cd back
mysql -u root -p mfc_system < schema.sql
```

Ou se estiver usando XAMPP, abra o phpMyAdmin:
1. Acesse: http://localhost/phpmyadmin
2. Crie o banco `mfc_system`
3. Selecione o banco
4. Clique em "Importar"
5. Escolha o arquivo `schema.sql`
6. Clique em "Executar"

### 4️⃣ Configurar o `.env`

Edite o arquivo `back/.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha_aqui
DB_NAME=mfc_system
PORT=4000
```

**⚠️ IMPORTANTE**: Se você usa XAMPP, a senha do MySQL geralmente é vazia:
```env
DB_PASSWORD=
```

### 5️⃣ Atualizar o código

Em `back/src/server.js`, na linha 5, mude:
```javascript
// ANTES:
const { db } = require('./db');

// DEPOIS:
const { db } = require('./db-mysql');
```

### 6️⃣ Inicializar

No mesmo arquivo `server.js`, adicione no início (antes do `app.listen`):
```javascript
const { initDatabase } = require('./db-mysql');

// Adicione antes do app.listen
async function start() {
  await initDatabase();
  
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`✅ MFC back rodando em http://localhost:${PORT}`);
  });
}

start().catch(console.error);
```

### 7️⃣ Rodar o Servidor

```bash
node src/server.js
```

## ✅ Login Padrão
- **Usuário**: admin
- **Senha**: admin123

## 🐛 Problemas Comuns

### "Access denied for user"
→ Verifique usuário e senha no `.env`

### "Unknown database 'mfc_system'"
→ Execute o comando CREATE DATABASE novamente

### "Client does not support authentication"
```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'sua_senha';
FLUSH PRIVILEGES;
```

### Porta 4000 em uso
→ Mude PORT no `.env` ou mate o processo:
```bash
# Windows
netstat -ano | findstr :4000
taskkill /F /PID numero_do_processo
```

## 📝 Vantagens do MySQL

✅ Dados persistem entre reinicializações
✅ Melhor performance
✅ Suporte a múltiplas conexões
✅ Pronto para produção
✅ Backup e recuperação facilitados
