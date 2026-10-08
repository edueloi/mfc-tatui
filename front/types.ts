
export enum MemberStatus {
  ATIVO = 'Ativo',
  INATIVO = 'Inativo',
  PENDENTE = 'Pendente',
  CONVIDADO = 'Convidado',
  AGUARDANDO = 'Aguardando'
}

export enum UserRoleType {
  ADMIN = 'Administrador',
  COORD_CIDADE = 'Coordenador Cidade',
  COORD_ESTADO = 'Coordenador Estado',
  SEC_COM_CIDADE = 'Secretário Comunicação Cidade',
  SEC_COM_ESTADO = 'Secretário Comunicação Estado',
  COORD_CONDIR = 'Coordenador Condir',
  COORD_EQUIPE_BASE = 'Coordenador Equipe Base',
  VICE_COORD = 'Vice Coordenador',
  TESOUREIRO = 'Tesoureiro',
  USUARIO = 'Usuário'
}

export type ModuleAction = 'view' | 'create' | 'edit' | 'delete' | 'launch';

export interface City {
  id: string;
  name: string;
  uf: string;
  mfcSince?: string;
  active?: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  cityId: string;
  role: UserRoleType;
  teamId?: string;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EventTeamQuota {
  teamId: string;
  quotaValue: number;
}

export interface EventExpense {
  isExtra?: boolean;
  date?: string;
  id: string;
  description: string;
  amount: number;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  costValue: number; // Agora é a soma das expenses
  goalValue: number;
  cityId: string;
  isActive: boolean;
  showOnDashboard: boolean;
  teamQuotas: EventTeamQuota[];
  // Novos Campos
  ticketQuantity?: number;
  ticketValue?: number;
  expenses: EventExpense[];
  location?: string;
  description?: string;
  responsible?: string;
  // Controle completo do evento
  kind?: 'interno' | 'externo';
  /** Evento com taxa: cobra `ticketValue` por pessoa. Sem taxa, não há cobrança nem venda. */
  hasFee?: boolean;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  imageUrl?: string;
  notes?: string;
  registrationOpen?: boolean;
  registrationDeadline?: string;
  capacity?: number | null;
  participantsGoal?: number | null;
  publicToken?: string;
  bridalMeetingId?: string | null;
  /** Encerrado à mão. */
  closed?: boolean;
  /** Encerrado (à mão ou 7 dias depois do evento): não aceita inscrição, pagamento, gasto nem entrada. */
  locked?: boolean;
  extraExpenses?: EventExpense[];
  incomes?: EventIncome[];
  couples?: EventCouple[];
  stats?: EventStats;
  teamStats?: { teamId: string; registered: number; raised: number }[];
  items?: EventItem[];
  registrations?: EventRegistration[];
}

export interface EventStats {
  registered: number;
  confirmed: number;
  couples: number;
  raisedBreakdown: { registrations: number; sales: number; couples: number; incomes: number };
  expensesPlanned: number;
  expensesExtra: number;
  expensesTotal: number;
  invited: number;
  cancelled: number;
  due: number;
  raised: number;
  salesRaised: number;
  itemsTotal: number;
  itemsDone: number;
}

export interface EventIncome { id: string; description: string; amount: number; date: string; }

export interface EventCouple { id: string; noivoName: string; noivaName: string; status: string; paymentStatus: string; paymentAmount: number; }

export type EventRegistrationStatus = 'Convidado' | 'Inscrito' | 'Confirmado' | 'Cancelado';
export type EventPaymentStatus = 'Pendente' | 'Parcial' | 'Pago' | 'Isento';

export interface EventRegistration {
  id: string;
  eventId: string;
  memberId: string | null;
  teamId: string | null;
  name: string;
  phone: string;
  email: string;
  guests: number;
  status: EventRegistrationStatus;
  amountDue: number;
  amountPaid: number;
  paymentStatus: EventPaymentStatus;
  source: 'equipe' | 'usuario' | 'manual' | 'convite' | 'link';
  notes: string;
  createdBy: string | null;
  createdAt: string;
}

export type EventItemStatus = 'Pendente' | 'Confirmado' | 'Entregue';

export interface EventItem {
  id: string;
  eventId: string;
  name: string;
  quantity: number;
  unit: string;
  teamId: string | null;
  assignedTo: string;
  status: EventItemStatus;
}

export interface EventSale {
  id: string;
  eventId: string;
  teamId: string;
  memberId: string; // Vendedor
  buyerName: string;
  amount: number;
  status: 'Pago' | 'Pendente';
  date: string;
}

export interface Payment {
  id: string;
  memberId: string;
  teamId: string;
  amount: number;
  date: string;
  referenceMonth: string;
  status: 'Pago' | 'Pendente' | 'Isento';
  launchedBy: string;
  memberName?: string;
  familyName?: string;
  observation?: string;
  method?: string;
}

export interface FinancialEntity {
  id: string;
  name: string;
  year: number;
  createdBy: string;
  observations?: string;
  initialBalance: number;
}

export interface Member {
  id: string;
  name: string;
  nickname: string;
  dob: string;
  rg: string;
  cpf: string;
  bloodType: string;
  gender: string;
  maritalStatus: string;
  spouseName?: string;
  spouseCpf?: string;
  marriageDate?: string;
  mfcDate: string;
  phone: string;
  emergencyPhone: string;
  status: MemberStatus;
  teamId?: string;
  street: string;
  number: string;
  neighborhood: string;
  zip: string;
  complement?: string;
  city: string;
  state: string;
  condir: string;
  naturalness: string;
  father: string;
  mother: string;
  smoker: boolean;
  mobilityIssue: string;
  healthPlan: string;
  diet: string;
  medication: string;
  allergy: string;
  pcd: boolean;
  pcdDescription?: string;
  profession: string;
  religion: string;
  education: string;
  photoUrl?: string;
  movementRoles: string[];
  familyName?: string;
  relationshipType?: string;
  paysMonthly?: boolean;
  createdAt: string;
  updatedAt: string;
  isPaymentInactive?: boolean;
}

export interface BaseTeam {
  id: string;
  name: string;
  city: string;
  state: string;
  isYouth: boolean;
  createdAt: string;
  memberCount: number;
}

export interface BridalPartner {
  id?: string;
  coupleId?: string;
  role: 'noivo' | 'noiva';
  name: string;
  dob: string;
  profession: string;
  education: string;
  religion: string;
  parish: string;
  phone: string;
  email: string;
  street: string;
  number: string;
  neighborhood: string;
  zip: string;
  complement?: string;
  city: string;
  state: string;
}

export interface BridalDocument {
  id: string;
  coupleId: string;
  partnerId: string | null;
  fileName: string;
  filePath: string;
  mimeType: string;
  uploadedAt: string;
}

export type BridalCoupleStatus = 'Rascunho' | 'Aguardando Pagamento' | 'Confirmado' | 'Cancelado';
export type BridalPaymentStatus = 'Pendente' | 'Pago' | 'Parcial' | 'Isento';

export interface BridalCouple {
  id: string;
  cityId?: string | null;
  eventId?: string | null;
  status: BridalCoupleStatus;
  publicToken: string;
  filledExternally: boolean;
  paymentStatus: BridalPaymentStatus;
  paymentAmount: number | null;
  paymentDate: string;
  paymentMethod: string;
  paymentObservation: string;
  createdAt: string;
  updatedAt: string;
  noivoName?: string;
  noivaName?: string;
  partners?: BridalPartner[];
  documents?: BridalDocument[];
}

export interface BridalMeetingCoupleSummary {
  id: string;
  status: BridalCoupleStatus;
  noivoName: string;
  noivaName: string;
}

export interface BridalMeeting {
  id: string;
  cityId?: string | null;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  pixKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  couplesCount?: number;
  couples?: BridalMeetingCoupleSummary[];
}

export type NucleationStatus = 'Pendente' | 'Em Andamento' | 'Convertido' | 'Sem Sucesso';
export type NucleationAttemptResult = 'Agendado' | 'Sucesso' | 'Sem Sucesso' | 'Reagendado';

export interface NucleationAttempt {
  id: string;
  nucleationId: string;
  scheduledDate: string;
  contactedBy: string | null;
  result: NucleationAttemptResult;
  notes: string;
  createdAt: string;
}

export interface NucleationContact {
  id: string;
  coupleId: string | null;
  name: string;
  phone1: string;
  phone2: string;
  groupId?: string | null;
  groupName?: string | null;
  status: NucleationStatus;
  convertedMemberId: string | null;
  createdAt: string;
  updatedAt: string;
  attemptsCount?: number;
  attempts?: NucleationAttempt[];
  coupleNoivoName?: string | null;
  coupleNoivaName?: string | null;
}

export interface NucleationGroupHistory {
  id: string;
  groupId: string;
  occurredAt: string;
  notes: string;
  createdAt: string;
}

export interface NucleationGroup {
  id: string;
  name: string;
  description: string;
  contactsCount: number;
  createdAt: string;
  updatedAt: string;
  contacts?: NucleationContact[];
  history?: NucleationGroupHistory[];
}
