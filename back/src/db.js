// BANCO EM MEMÓRIA - better-sqlite3 removido
// const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// Armazenamento em memória
const storage = {
  cities: [],
  users: [],
  roles: [],
  teams: [],
  members: [],
  events: [],
  event_expenses: [],
  event_team_quotas: [],
  event_sales: [],
  payments: [],
  ledger_entries: [],
  financial_entities: []
};

// Simulador de DB com prepare
const db = {
  prepare: (sql) => {
    const sqlLower = sql.toLowerCase().trim();
    
    return {
      run: (...params) => {
        // INSERT
        if (sqlLower.startsWith('insert')) {
          if (/\binsert\s+into\s+cities\b/.test(sqlLower)) {
            const [id, name, uf, mfc_since, active] = params;
            storage.cities.push({ id, name, uf, mfc_since, active });
          } else if (/\binsert\s+into\s+users\b/.test(sqlLower)) {
            const [id, username, email, name, city_id, role, team_id, password_hash, created_at, updated_at, active] = params;
            storage.users.push({ id, username, email, name, city_id, role, team_id, password_hash, created_at, updated_at, active });
          } else if (/\binsert\s+into\s+roles\b/.test(sqlLower)) {
            const [id, name, is_system, permissions_json] = params;
            storage.roles.push({ id, name, is_system, permissions_json });
          } else if (/\binsert\s+into\s+teams\b/.test(sqlLower)) {
            const [id, name, city, state, is_youth, created_at] = params;
            storage.teams.push({ id, name, city, state, is_youth, created_at });
          } else if (/\binsert\s+into\s+members\b/.test(sqlLower)) {
            const [data] = params;
            if (data && typeof data === 'object' && !Array.isArray(data)) {
              storage.members.push({
                id: data.id,
                name: data.name,
                nickname: data.nickname,
                dob: data.dob,
                rg: data.rg,
                cpf: data.cpf,
                blood_type: data.bloodType,
                gender: data.gender,
                marital_status: data.maritalStatus,
                spouse_name: data.spouseName,
                spouse_cpf: data.spouseCpf,
                marriage_date: data.marriageDate,
                mfc_date: data.mfcDate,
                phone: data.phone,
                emergency_phone: data.emergencyPhone,
                status: data.status,
                team_id: data.teamId,
                street: data.street,
                number: data.number,
                neighborhood: data.neighborhood,
                zip: data.zip,
                complement: data.complement,
                city: data.city,
                state: data.state,
                condir: data.condir,
                naturalness: data.naturalness,
                father: data.father,
                mother: data.mother,
                smoker: data.smoker,
                mobility_issue: data.mobilityIssue,
                health_plan: data.healthPlan,
                diet: data.diet,
                medication: data.medication,
                allergy: data.allergy,
                pcd: data.pcd,
                pcd_description: data.pcdDescription,
                profession: data.profession,
                religion: data.religion,
                education: data.education,
                movement_roles: data.movementRoles,
                created_at: data.createdAt,
                updated_at: data.updatedAt,
                is_payment_inactive: data.isPaymentInactive
              });
            } else {
              storage.members.push(Object.fromEntries(params.map((v, i) => [`field${i}`, v])));
            }
          } else if (/\binsert\s+into\s+payments\b/.test(sqlLower)) {
            const [id, member_id, team_id, amount, date, reference_month, status, launched_by] = params;
            storage.payments.push({ id, member_id, team_id, amount, date, reference_month, status, launched_by });
          } else if (/\binsert\s+into\s+ledger_entries\b/.test(sqlLower)) {
            const [id, team_id, type, description, amount, date, category, created_by] = params;
            storage.ledger_entries.push({ id, team_id, type, description, amount, date, category, created_by });
          } else if (/\binsert\s+into\s+events\b/.test(sqlLower)) {
            storage.events.push(Object.fromEntries(params.map((v, i) => [`field${i}`, v])));
          } else if (/\binsert\s+into\s+financial_entities\b/.test(sqlLower)) {
            storage.financial_entities.push(Object.fromEntries(params.map((v, i) => [`field${i}`, v])));
          }
          return { changes: 1 };
        }
        
        // UPDATE
        if (sqlLower.startsWith('update')) {
          return { changes: 1 };
        }
        
        // DELETE
        if (sqlLower.startsWith('delete')) {
          if (sqlLower.includes('cities')) {
            const id = params[0];
            storage.cities = storage.cities.filter(c => c.id !== id);
          } else if (sqlLower.includes('users')) {
            const id = params[0];
            storage.users = storage.users.filter(u => u.id !== id);
          } else if (sqlLower.includes('teams')) {
            const id = params[0];
            storage.teams = storage.teams.filter(t => t.id !== id);
          } else if (sqlLower.includes('members')) {
            const id = params[0];
            storage.members = storage.members.filter(m => m.id !== id);
          }
          return { changes: 1 };
        }
        
        return { changes: 0 };
      },
      
      get: (...params) => {
        // SELECT com LIMIT 1 ou COUNT
        if (sqlLower.includes('cities')) {
          if (sqlLower.includes('count')) {
            return { count: storage.cities.length };
          }
          if (sqlLower.includes('where')) {
            const id = params[0];
            return storage.cities.find(c => c.id === id) || null;
          }
          return storage.cities[0] || null;
        }
        
        if (sqlLower.includes('users')) {
          if (sqlLower.includes('count')) {
            return { count: storage.users.length };
          }
          if (sqlLower.includes('where')) {
            if (sqlLower.includes('username')) {
              const username = params[0];
              return storage.users.find(u => u.username === username) || null;
            }
            if (sqlLower.includes('id')) {
              const id = params[0];
              return storage.users.find(u => u.id === id) || null;
            }
          }
          return storage.users[0] || null;
        }
        
        if (sqlLower.includes('teams')) {
          if (sqlLower.includes('count')) {
            return { count: storage.teams.length };
          }
          if (sqlLower.includes('where')) {
            const id = params[0];
            return storage.teams.find(t => t.id === id) || null;
          }
          return storage.teams[0] || null;
        }
        
        if (sqlLower.includes('members')) {
          if (sqlLower.includes('where')) {
            const id = params[0];
            return storage.members.find(m => m.id === id) || null;
          }
          return storage.members[0] || null;
        }
        
        if (sqlLower.includes('roles')) {
          if (sqlLower.includes('count')) {
            return { count: storage.roles.length };
          }
          return storage.roles[0] || null;
        }
        
        if (sqlLower.includes('events')) {
          if (sqlLower.includes('where')) {
            const id = params[0];
            return storage.events.find(e => e.id === id) || null;
          }
          return storage.events[0] || null;
        }
        
        return null;
      },
      
      all: (...params) => {
        // SELECT ALL
        if (sqlLower.includes('cities')) {
          return storage.cities;
        }
        
        if (sqlLower.includes('users')) {
          return storage.users;
        }
        
        if (sqlLower.includes('teams')) {
          return storage.teams;
        }
        
        if (sqlLower.includes('members')) {
          if (sqlLower.includes('where') && sqlLower.includes('team_id')) {
            const teamId = params[0];
            return storage.members.filter(m => m.team_id === teamId);
          }
          return storage.members;
        }
        
        if (sqlLower.includes('roles')) {
          return storage.roles;
        }
        
        if (sqlLower.includes('payments')) {
          return storage.payments;
        }
        
        if (sqlLower.includes('ledger_entries')) {
          return storage.ledger_entries;
        }
        
        if (sqlLower.includes('events')) {
          return storage.events;
        }
        
        if (sqlLower.includes('financial_entities')) {
          return storage.financial_entities;
        }
        
        return [];
      }
    };
  },
  
  exec: () => {},
  pragma: () => {}
};

const nowIso = () => new Date().toISOString();

// Inicializar cidade padrão
storage.cities.push({
  id: '1',
  name: 'Tatuí',
  uf: 'SP',
  mfc_since: '1965-07-01',
  active: 1
});

// Inicializar usuário admin
const adminPasswordHash = bcrypt.hashSync('admin123', 10);
const adminTs = nowIso();
storage.users.push({
  id: 'u1',
  username: 'admin',
  email: 'admin@mfc.org',
  name: 'Administrador Geral',
  city_id: '1',
  role: 'Administrador',
  team_id: null,
  password_hash: adminPasswordHash,
  created_at: adminTs,
  updated_at: adminTs,
  active: 1
});

// Inicializar roles
const allPermissions = {
  dashboard: { view: true, create: true, edit: true, delete: true, launch: true },
  mfcistas: { view: true, create: true, edit: true, delete: true, launch: true },
  equipes: { view: true, create: true, edit: true, delete: true, launch: true },
  financeiro: { view: true, create: true, edit: true, delete: true, launch: true },
  'livro-caixa': { view: true, create: true, edit: true, delete: true, launch: true },
  usuarios: { view: true, create: true, edit: true, delete: true, launch: true },
  configuracoes: { view: true, create: true, edit: true, delete: true, launch: true }
};

const tesPermissions = {
  dashboard: { view: true, create: false, edit: false, delete: false, launch: false },
  mfcistas: { view: false, create: false, edit: false, delete: false, launch: false },
  equipes: { view: false, create: false, edit: false, delete: false, launch: false },
  financeiro: { view: true, create: true, edit: true, delete: false, launch: true },
  'livro-caixa': { view: false, create: false, edit: false, delete: false, launch: false },
  usuarios: { view: false, create: false, edit: false, delete: false, launch: false },
  configuracoes: { view: false, create: false, edit: false, delete: false, launch: false }
};

storage.roles.push({
  id: 'r1',
  name: 'Administrador',
  is_system: 1,
  permissions_json: JSON.stringify(allPermissions)
});

storage.roles.push({
  id: 'r2',
  name: 'Tesoureiro de Equipe',
  is_system: 0,
  permissions_json: JSON.stringify(tesPermissions)
});

console.log('⚠️  Usando banco em memória temporário (better-sqlite3 removido)');
console.log('👤 Login: admin / admin123');

module.exports = { db };
