# Migração para MySQL - MFC System

## Pré-requisitos

1. **MySQL instalado e rodando**
   - Download: https://dev.mysql.com/downloads/mysql/
   - Ou use XAMPP/WAMP que já inclui MySQL

2. **Criar o banco de dados**
   ```bash
   mysql -u root -p
   ```
   
   Dentro do MySQL:
   ```sql
   CREATE DATABASE mfc_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   EXIT;
   ```

3. **Importar o schema**
   ```bash
   mysql -u root -p mfc_system < schema.sql
   ```

## Configuração

1. **Copie o arquivo de exemplo**
   ```bash
   cp .env.example .env
   ```

2. **Edite o arquivo `.env` com suas credenciais**
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=sua_senha_aqui
   DB_NAME=mfc_system
   PORT=4000
   ```

## Mudanças no Código

### Atual (SQLite/Memória)
```javascript
const { db } = require('./db');
```

### Novo (MySQL)
```javascript
const { db } = require('./db-mysql');
```

## Importante

- O sistema agora usa **MySQL** ao invés de banco em memória
- Todas as queries são **assíncronas** - use `await` nas rotas
- As rotas precisam ser `async` functions
- Dados persistem entre reinicializações do servidor

## Login Padrão

- Usuário: `admin`
- Senha: `admin123`

## Troubleshooting

### Erro: "Client does not support authentication protocol"
```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'sua_senha';
FLUSH PRIVILEGES;
```

### Erro: "Access denied"
Verifique usuário e senha no arquivo `.env`

### Erro: "Unknown database"
Execute o comando CREATE DATABASE novamente
