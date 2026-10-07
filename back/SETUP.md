# 🚀 SETUP RÁPIDO - MySQL

## Execute apenas 2 comandos:

### 1️⃣ Configurar banco de dados
```bash
node setup-db.js
```

Este comando vai:
- ✅ Criar o banco `mfc_system`
- ✅ Criar todas as tabelas
- ✅ Criar o usuário admin
- ✅ Configurar tudo automaticamente

### 2️⃣ Iniciar o servidor
```bash
node src/server.js
```

## 🎉 Pronto!

Login:
- **Usuário**: admin
- **Senha**: admin123

## ⚙️ Configuração

O arquivo `.env` já está configurado:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Edu@06051992
DB_NAME=mfc_system
PORT=4000
```

## 🐛 Problemas?

### "Access denied"
→ Verifique a senha no `.env`

### "Cannot connect to MySQL server"
→ Certifique-se que o MySQL está rodando

### Porta 4000 em uso
→ O servidor tentará automaticamente a próxima porta disponível (4001, 4002...)
