-- Atualização do banco de dados: Adicionar tabela de configurações financeiras
-- Execute este script no MySQL para adicionar a nova funcionalidade

USE mfc_system;

-- Criar tabela de configurações financeiras
CREATE TABLE IF NOT EXISTS financial_config (
  id INT PRIMARY KEY DEFAULT 1,
  monthly_payment_amount DECIMAL(10,2) DEFAULT 50.00,
  event_ticket_default_value DECIMAL(10,2) DEFAULT 100.00,
  currency VARCHAR(10) DEFAULT 'BRL',
  updated_at DATETIME NOT NULL,
  updated_by VARCHAR(36)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserir configuração padrão (se não existir)
INSERT IGNORE INTO financial_config (id, monthly_payment_amount, event_ticket_default_value, currency, updated_at) 
VALUES (1, 50.00, 100.00, 'BRL', NOW());

-- Verificar se foi criado com sucesso
SELECT * FROM financial_config;
