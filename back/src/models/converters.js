// Conversores de dados do banco para o formato da API

const { toBool } = require('../utils/helpers');

const rowToCity = (row) => ({
  id: row.id,
  name: row.name,
  uf: row.uf,
  mfcSince: row.mfc_since || undefined,
  active: toBool(row.active)
});

const rowToUser = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email || '',
  name: row.name,
  cityId: row.city_id,
  role: row.role,
  teamId: row.team_id || undefined,
  active: row.active === undefined || row.active === null ? true : Boolean(Number(row.active)),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const rowToTeam = (row) => ({
  id: row.id,
  name: row.name,
  city: row.city,
  state: row.state,
  isYouth: toBool(row.is_youth),
  memberCount: row.member_count || 0,
  createdAt: row.created_at
});

const rowToMember = (row) => ({
  id: row.id,
  name: row.name,
  nickname: row.nickname || '',
  dob: row.dob || '',
  rg: row.rg || '',
  cpf: row.cpf || '',
  bloodType: row.blood_type || '',
  gender: row.gender || '',
  maritalStatus: row.marital_status || '',
  spouseName: row.spouse_name || '',
  spouseCpf: row.spouse_cpf || '',
  marriageDate: row.marriage_date || '',
  mfcDate: row.mfc_date || '',
  phone: row.phone || '',
  emergencyPhone: row.emergency_phone || '',
  status: row.status || '',
  teamId: row.team_id || undefined,
  street: row.street || '',
  number: row.number || '',
  neighborhood: row.neighborhood || '',
  zip: row.zip || '',
  complement: row.complement || '',
  city: row.city || '',
  state: row.state || '',
  condir: row.condir || '',
  naturalness: row.naturalness || '',
  father: row.father || '',
  mother: row.mother || '',
  smoker: toBool(row.smoker),
  mobilityIssue: row.mobility_issue || '',
  healthPlan: row.health_plan || '',
  diet: row.diet || '',
  medication: row.medication || '',
  allergy: row.allergy || '',
  pcd: toBool(row.pcd),
  pcdDescription: row.pcd_description || '',
  profession: row.profession || '',
  religion: row.religion || '',
  education: row.education || '',
  photoUrl: row.photo_url || '',
  movementRoles: row.movement_roles ? JSON.parse(row.movement_roles) : [],
  familyName: row.family_name || '',
  relationshipType: row.relationship_type || 'Titular',
  paysMonthly: toBool(row.pays_monthly),
  isPaymentInactive: toBool(row.is_payment_inactive),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const rowToEvent = (row) => ({
  id: row.id,
  name: row.name,
  date: row.date,
  costValue: parseFloat(row.cost_value) || 0,
  goalValue: parseFloat(row.goal_value) || 0,
  cityId: row.city_id,
  isActive: toBool(row.is_active),
  showOnDashboard: toBool(row.show_on_dashboard),
  ticketQuantity: row.ticket_quantity || null,
  ticketValue: parseFloat(row.ticket_value) || null,
  location: row.location || '',
  description: row.description || '',
  responsible: row.responsible || ''
});

const rowToEventSale = (row) => ({
  id: row.id,
  eventId: row.event_id,
  teamId: row.team_id,
  memberId: row.member_id,
  buyerName: row.buyer_name,
  amount: parseFloat(row.amount) || 0,
  status: row.status,
  date: row.date
});

const rowToPayment = (row) => ({
  id: row.id,
  memberId: row.member_id,
  teamId: row.team_id,
  amount: parseFloat(row.amount) || 0,
  date: row.date,
  referenceMonth: row.reference_month,
  status: row.status,
  launchedBy: row.launched_by || null,
  memberName: row.member_name || '',
  familyName: row.family_name || ''
});

const rowToLedger = (row) => ({
  id: row.id,
  teamId: row.team_id || null,
  entityId: row.entity_id || null,
  type: row.type,
  description: row.description || '',
  amount: parseFloat(row.amount) || 0,
  date: row.date,
  category: row.category || null,
  createdBy: row.created_by || null
});

const rowToLedgerEntity = (row) => ({
  id: row.id,
  name: row.name,
  year: row.year,
  createdBy: row.created_by || null,
  observations: row.observations || null,
  initialBalance: parseFloat(row.initial_balance) || 0
});

const rowToBridalPartner = (row) => ({
  id: row.id,
  coupleId: row.couple_id,
  role: row.role,
  name: row.name || '',
  dob: row.dob || '',
  profession: row.profession || '',
  education: row.education || '',
  religion: row.religion || '',
  parish: row.parish || '',
  phone: row.phone || '',
  email: row.email || '',
  street: row.street || '',
  number: row.number || '',
  neighborhood: row.neighborhood || '',
  zip: row.zip || '',
  complement: row.complement || '',
  city: row.city || '',
  state: row.state || ''
});

const rowToBridalDocument = (row) => ({
  id: row.id,
  coupleId: row.couple_id,
  partnerId: row.partner_id || null,
  fileName: row.file_name,
  filePath: row.file_path,
  mimeType: row.mime_type || '',
  uploadedAt: row.uploaded_at
});

const rowToBridalMeeting = (row) => ({
  id: row.id,
  cityId: row.city_id || null,
  name: row.name || '',
  date: row.date || '',
  startTime: row.start_time || '',
  endTime: row.end_time || '',
  location: row.location || '',
  pixKey: row.pix_key || '',
  isActive: toBool(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const rowToBridalCouple = (row) => ({
  id: row.id,
  cityId: row.city_id || null,
  eventId: row.event_id || null,
  status: row.status || 'Rascunho',
  publicToken: row.public_token,
  filledExternally: toBool(row.filled_externally),
  paymentStatus: row.payment_status || 'Pendente',
  paymentAmount: row.payment_amount !== null && row.payment_amount !== undefined ? parseFloat(row.payment_amount) : null,
  paymentDate: row.payment_date || '',
  paymentMethod: row.payment_method || '',
  paymentObservation: row.payment_observation || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const rowToNucleationAttempt = (row) => ({
  id: row.id,
  nucleationId: row.nucleation_id,
  scheduledDate: row.scheduled_date || '',
  contactedBy: row.contacted_by || null,
  result: row.result || 'Agendado',
  notes: row.notes || '',
  createdAt: row.created_at
});

const rowToNucleationContact = (row) => ({
  id: row.id,
  coupleId: row.couple_id || null,
  name: row.name || '',
  phone1: row.phone_1 || '',
  phone2: row.phone_2 || '',
  status: row.status || 'Pendente',
  convertedMemberId: row.converted_member_id || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

module.exports = {
  rowToCity,
  rowToUser,
  rowToTeam,
  rowToMember,
  rowToEvent,
  rowToEventSale,
  rowToPayment,
  rowToLedger,
  rowToLedgerEntity,
  rowToBridalPartner,
  rowToBridalDocument,
  rowToBridalCouple,
  rowToBridalMeeting,
  rowToNucleationAttempt,
  rowToNucleationContact
};
