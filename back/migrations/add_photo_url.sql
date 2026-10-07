-- Migração para adicionar coluna photo_url
-- Execute este script no banco de dados MySQL

USE mfc_system;

-- Adicionar coluna photo_url à tabela members se não existir
ALTER TABLE members ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Confirmação
SELECT 'Migração concluída: coluna photo_url adicionada à tabela members' AS status;
