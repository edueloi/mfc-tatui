-- Schema MySQL para MFC System

-- Tabela de Cidades
CREATE TABLE IF NOT EXISTS cities (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  uf VARCHAR(2) NOT NULL,
  mfc_since VARCHAR(20),
  active TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  city_id VARCHAR(36),
  role VARCHAR(100) NOT NULL,
  team_id VARCHAR(36),
  password_hash TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  active TINYINT(1) DEFAULT 1,
  FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Roles
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  is_system TINYINT(1) DEFAULT 0,
  permissions_json TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Equipes
CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  state VARCHAR(2) NOT NULL,
  is_youth TINYINT(1) DEFAULT 0,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Membros
CREATE TABLE IF NOT EXISTS members (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  nickname VARCHAR(255),
  dob VARCHAR(20),
  rg VARCHAR(20),
  cpf VARCHAR(20),
  blood_type VARCHAR(10),
  gender VARCHAR(20),
  marital_status VARCHAR(50),
  spouse_name VARCHAR(255),
  spouse_cpf VARCHAR(20),
  marriage_date VARCHAR(20),
  mfc_date VARCHAR(20),
  phone VARCHAR(30),
  emergency_phone VARCHAR(30),
  status VARCHAR(50),
  team_id VARCHAR(36),
  street VARCHAR(255),
  number VARCHAR(20),
  neighborhood VARCHAR(255),
  zip VARCHAR(20),
  complement VARCHAR(255),
  city VARCHAR(255),
  state VARCHAR(2),
  condir VARCHAR(50),
  naturalness VARCHAR(255),
  father VARCHAR(255),
  mother VARCHAR(255),
  smoker TINYINT(1) DEFAULT 0,
  mobility_issue VARCHAR(255),
  health_plan VARCHAR(255),
  diet TEXT,
  medication TEXT,
  allergy TEXT,
  pcd TINYINT(1) DEFAULT 0,
  pcd_description TEXT,
  profession VARCHAR(255),
  religion VARCHAR(100),
  education VARCHAR(100),
  movement_roles TEXT,
  photo_url TEXT,
  family_name VARCHAR(255),
  relationship_type VARCHAR(50) DEFAULT 'Titular',
  pays_monthly TINYINT(1) DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  is_payment_inactive TINYINT(1) DEFAULT 0,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Eventos
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  date VARCHAR(20) NOT NULL,
  cost_value DECIMAL(10,2) DEFAULT 0,
  goal_value DECIMAL(10,2) DEFAULT 0,
  city_id VARCHAR(36),
  is_active TINYINT(1) DEFAULT 1,
  show_on_dashboard TINYINT(1) DEFAULT 1,
  ticket_quantity INT,
  ticket_value DECIMAL(10,2),
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  location VARCHAR(255),
  description TEXT,
  responsible VARCHAR(255),
  FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Despesas de Eventos
CREATE TABLE IF NOT EXISTS event_expenses (
  id VARCHAR(36) PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Quotas de Equipe por Evento
CREATE TABLE IF NOT EXISTS event_team_quotas (
  id VARCHAR(36) PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  team_id VARCHAR(36) NOT NULL,
  quota_value DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Vendas de Eventos
CREATE TABLE IF NOT EXISTS event_sales (
  id VARCHAR(36) PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  team_id VARCHAR(36) NOT NULL,
  member_id VARCHAR(36) NOT NULL,
  buyer_name VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  date VARCHAR(20) NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Pagamentos
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  member_id VARCHAR(36) NOT NULL,
  team_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date VARCHAR(20) NOT NULL,
  reference_month VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL,
  launched_by VARCHAR(36),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Livro Caixa
CREATE TABLE IF NOT EXISTS ledger (
  id VARCHAR(36) PRIMARY KEY,
  team_id VARCHAR(36),
  type VARCHAR(20) NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date VARCHAR(20) NOT NULL,
  category VARCHAR(100),
  created_by VARCHAR(36),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Entidades Financeiras
CREATE TABLE IF NOT EXISTS financial_entities (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  year INT NOT NULL,
  created_by VARCHAR(36),
  observations TEXT,
  initial_balance DECIMAL(10,2) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Configurações Financeiras
CREATE TABLE IF NOT EXISTS financial_config (
  id INT PRIMARY KEY DEFAULT 1,
  monthly_payment_amount DECIMAL(10,2) DEFAULT 50.00,
  event_ticket_default_value DECIMAL(10,2) DEFAULT 100.00,
  currency VARCHAR(10) DEFAULT 'BRL',
  updated_at DATETIME NOT NULL,
  updated_by VARCHAR(36)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Lançamentos Diários (Importados de Planilha)
CREATE TABLE IF NOT EXISTS mfc_daily_entries (
  id VARCHAR(36) PRIMARY KEY,
  date DATE NOT NULL,
  cost_center VARCHAR(100),
  synthetic VARCHAR(255),
  analytic VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  account VARCHAR(100),
  observation TEXT,
  imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Encontros (turmas/edições do Encontro de Noivos)
CREATE TABLE IF NOT EXISTS bridal_meetings (
  id VARCHAR(36) PRIMARY KEY,
  city_id VARCHAR(36),
  name VARCHAR(255) NOT NULL,
  date VARCHAR(20) NOT NULL,
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  location VARCHAR(255),
  pix_key VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Casais (Encontro de Noivos)
CREATE TABLE IF NOT EXISTS bridal_couples (
  id VARCHAR(36) PRIMARY KEY,
  city_id VARCHAR(36),
  event_id VARCHAR(36),
  status VARCHAR(30) NOT NULL DEFAULT 'Rascunho',
  public_token VARCHAR(36) NOT NULL UNIQUE,
  filled_externally TINYINT(1) DEFAULT 0,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'Pendente',
  payment_amount DECIMAL(10,2),
  payment_date VARCHAR(20),
  payment_method VARCHAR(30),
  payment_observation TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id) REFERENCES bridal_meetings(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Noivos/Noivas (2 por casal)
CREATE TABLE IF NOT EXISTS bridal_partners (
  id VARCHAR(36) PRIMARY KEY,
  couple_id VARCHAR(36) NOT NULL,
  role VARCHAR(10) NOT NULL,
  name VARCHAR(255) NOT NULL,
  dob VARCHAR(20),
  profession VARCHAR(255),
  education VARCHAR(50),
  religion VARCHAR(100),
  parish VARCHAR(255),
  phone VARCHAR(30),
  email VARCHAR(255),
  street VARCHAR(255),
  number VARCHAR(20),
  neighborhood VARCHAR(255),
  zip VARCHAR(20),
  complement VARCHAR(255),
  city VARCHAR(255),
  state VARCHAR(2),
  FOREIGN KEY (couple_id) REFERENCES bridal_couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Documentos Anexados (Encontro de Noivos)
CREATE TABLE IF NOT EXISTS bridal_documents (
  id VARCHAR(36) PRIMARY KEY,
  couple_id VARCHAR(36) NOT NULL,
  partner_id VARCHAR(36),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  uploaded_at DATETIME NOT NULL,
  FOREIGN KEY (couple_id) REFERENCES bridal_couples(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_id) REFERENCES bridal_partners(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Contatos de Nucleação
CREATE TABLE IF NOT EXISTS nucleation_contacts (
  id VARCHAR(36) PRIMARY KEY,
  couple_id VARCHAR(36),
  name VARCHAR(255) NOT NULL,
  phone_1 VARCHAR(30),
  phone_2 VARCHAR(30),
  status VARCHAR(30) NOT NULL DEFAULT 'Pendente',
  converted_member_id VARCHAR(36),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (couple_id) REFERENCES bridal_couples(id) ON DELETE SET NULL,
  FOREIGN KEY (converted_member_id) REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Tentativas de Contato (Nucleação)
CREATE TABLE IF NOT EXISTS nucleation_attempts (
  id VARCHAR(36) PRIMARY KEY,
  nucleation_id VARCHAR(36) NOT NULL,
  scheduled_date VARCHAR(20),
  contacted_by VARCHAR(36),
  result VARCHAR(20) NOT NULL DEFAULT 'Agendado',
  notes TEXT,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (nucleation_id) REFERENCES nucleation_contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (contacted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserir configuração padrão (se não existir)
INSERT IGNORE INTO financial_config (id, monthly_payment_amount, event_ticket_default_value, currency, updated_at)
VALUES (1, 50.00, 100.00, 'BRL', NOW());

