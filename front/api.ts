const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const photoSrc = (value?: string) => value?.startsWith('/uploads/')
  ? `${API_URL.replace(/\/$/, '')}${value}`
  : value || '';

const request = async (path: string, options: RequestInit = {}) => {
  const headers = { ...options.headers } as Record<string, string>;
  
  // if body is form data, don't set application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    let message = 'Erro de requisicao.';
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch (_) {
      // ignore
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
};

export const api = {
  login: (username: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  getCities: () => request('/cities'),
  createCity: (data: any) => request('/cities', { method: 'POST', body: JSON.stringify(data) }),
  updateCity: (id: string, data: any) => request(`/cities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleCity: (id: string, active: boolean) =>
    request(`/cities/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  deleteCity: (id: string) => request(`/cities/${id}`, { method: 'DELETE' }),

  getRoles: () => request('/roles'),
  createRole: (data: any) => request('/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, data: any) => request(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRole: (id: string) => request(`/roles/${id}`, { method: 'DELETE' }),

  getTeams: () => request('/teams'),
  createTeam: (data: any) => request('/teams', { method: 'POST', body: JSON.stringify(data) }),
  updateTeam: (id: string, data: any) => request(`/teams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTeam: (id: string) => request(`/teams/${id}`, { method: 'DELETE' }),

  getMembers: () => request('/members'),
  uploadMemberPhoto: (file: File): Promise<{ photoUrl: string }> => {
    const body = new FormData();
    body.append('photo', file);
    return request('/member-photos', { method: 'POST', body });
  },
  createMember: (data: any) => request('/members', { method: 'POST', body: JSON.stringify(data) }),
  updateMember: (id: string, data: any) => request(`/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMember: (id: string) => request(`/members/${id}`, { method: 'DELETE' }),

  getUsers: () => request('/users'),
  createUser: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),

  getEvents: () => request('/events'),
  createEvent: (data: any) => request('/events', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: (id: string, data: any) => request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getEvent: (id: string) => request(`/events/${id}`),
  getEventByMeeting: (meetingId: string) => request(`/events/by-meeting/${meetingId}`),
  createEventExpense: (eventId: string, data: any) => request(`/events/${eventId}/expenses`, { method: 'POST', body: JSON.stringify(data) }),
  deleteEventExpense: (id: string) => request(`/events/expenses/${id}`, { method: 'DELETE' }),
  createEventIncome: (eventId: string, data: any) => request(`/events/${eventId}/incomes`, { method: 'POST', body: JSON.stringify(data) }),
  deleteEventIncome: (id: string) => request(`/events/incomes/${id}`, { method: 'DELETE' }),
  deleteEvent: (id: string) => request(`/events/${id}`, { method: 'DELETE' }),
  uploadEventImage: (file: File): Promise<{ imageUrl: string }> => {
    const body = new FormData();
    body.append('image', file);
    return request('/events/image', { method: 'POST', body });
  },
  createEventItems: (eventId: string, items: any[]) => request(`/events/${eventId}/items`, { method: 'POST', body: JSON.stringify({ items }) }),
  updateEventItem: (itemId: string, data: any) => request(`/events/items/${itemId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEventItem: (itemId: string) => request(`/events/items/${itemId}`, { method: 'DELETE' }),
  createEventRegistrations: (eventId: string, registrations: any[]) => request(`/events/${eventId}/registrations`, { method: 'POST', body: JSON.stringify({ registrations }) }),
  updateEventRegistration: (id: string, data: any) => request(`/events/registrations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEventRegistration: (id: string) => request(`/events/registrations/${id}`, { method: 'DELETE' }),
  getPublicEvent: (token: string) => request(`/events/public/${token}`),
  registerPublicCouple: (token: string, data: any) => request(`/events/public/${token}/couple`, { method: 'POST', body: JSON.stringify(data) }),
  registerPublicEvent: (token: string, data: any) => request(`/events/public/${token}/register`, { method: 'POST', body: JSON.stringify(data) }),

  getEventSales: () => request('/event-sales'),
  deleteEventSale: (id: string) => request(`/event-sales/${id}`, { method: 'DELETE' }),
  createEventSale: (data: any) => request('/event-sales', { method: 'POST', body: JSON.stringify(data) }),

  getPayments: () => request('/payments'),
  createPayment: (data: any) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),

  getLedger: () => request('/ledger'),
  createLedger: (data: any) => request('/ledger', { method: 'POST', body: JSON.stringify(data) }),
  deleteLedger: (id: string) => request(`/ledger/${id}`, { method: 'DELETE' }),
  getLedgerEntities: () => request('/ledger-entities'),
  createLedgerEntity: (data: any) => request('/ledger-entities', { method: 'POST', body: JSON.stringify(data) }),
  updateLedgerEntity: (id: string, data: any) => request(`/ledger-entities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLedgerEntity: (id: string) => request(`/ledger-entities/${id}`, { method: 'DELETE' }),

  getDashboardSummary: (month: string, year: string) => request(`/dashboard/summary?month=${month}&year=${year}`),

  // Configurações Financeiras
  getFinancialConfig: () => request('/config'),
  updateFinancialConfig: (data: any) => request('/config', { method: 'PUT', body: JSON.stringify(data) }),

  // APIs externas (CEP e localidades)
  buscarCEP: (cep: string) => request(`/api/cep/${cep}`),
  getEstados: () => request('/api/estados'),
  getCidadesPorEstado: (uf: string) => request(`/api/estados/${uf}/cidades`),
  getTodasCidades: () => request('/api/cidades'),

  // Lançamentos Diários (Importação Planilha)
  getDailyEntries: () => request('/daily-entries'),
  importDailyEntries: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/daily-entries/import', { method: 'POST', body: formData as any, headers: { 'Accept': 'application/json' } });
  },
  clearDailyEntries: () => request('/daily-entries/clear', { method: 'DELETE' }),
  getDailyStats: () => request('/daily-entries/stats'),

  // Encontro de Noivos
  getBridalCouples: () => request('/bridal-couples'),
  getBridalCouple: (id: string) => request(`/bridal-couples/${id}`),
  createBridalCouple: (data: any) => request('/bridal-couples', { method: 'POST', body: JSON.stringify(data) }),
  updateBridalCouple: (id: string, data: any) => request(`/bridal-couples/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBridalCouple: (id: string) => request(`/bridal-couples/${id}`, { method: 'DELETE' }),
  getBridalCoupleByToken: (token: string) => request(`/bridal-couples/public/${token}`),
  updateBridalCoupleByToken: (token: string, data: any) =>
    request(`/bridal-couples/public/${token}`, { method: 'PUT', body: JSON.stringify(data) }),
  uploadBridalDocument: (coupleId: string, file: File, partnerId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (partnerId) formData.append('partnerId', partnerId);
    return request(`/bridal-couples/${coupleId}/documents`, { method: 'POST', body: formData as any });
  },
  deleteBridalDocument: (coupleId: string, docId: string) =>
    request(`/bridal-couples/${coupleId}/documents/${docId}`, { method: 'DELETE' }),

  // Encontros (turmas do Encontro de Noivos)
  getBridalMeetings: () => request('/bridal-meetings'),
  getBridalMeeting: (id: string) => request(`/bridal-meetings/${id}`),
  createBridalMeeting: (data: any) => request('/bridal-meetings', { method: 'POST', body: JSON.stringify(data) }),
  updateBridalMeeting: (id: string, data: any) => request(`/bridal-meetings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBridalMeeting: (id: string) => request(`/bridal-meetings/${id}`, { method: 'DELETE' }),

  // Nucleação
  getNucleationContacts: () => request('/nucleation'),
  getNucleationContact: (id: string) => request(`/nucleation/${id}`),
  createNucleationContact: (data: any) => request('/nucleation', { method: 'POST', body: JSON.stringify(data) }),
  updateNucleationContact: (id: string, data: any) => request(`/nucleation/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNucleationContact: (id: string) => request(`/nucleation/${id}`, { method: 'DELETE' }),
  createNucleationAttempt: (id: string, data: any) =>
    request(`/nucleation/${id}/attempts`, { method: 'POST', body: JSON.stringify(data) }),
  updateNucleationAttempt: (attemptId: string, data: any) =>
    request(`/nucleation/attempts/${attemptId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getNucleationGroups: () => request('/nucleation/groups'),
  getNucleationGroup: (id: string) => request(`/nucleation/groups/${id}`),
  createNucleationGroup: (data: any) => request('/nucleation/groups', { method: 'POST', body: JSON.stringify(data) }),
  createNucleationGroupHistory: (id: string, data: any) => request(`/nucleation/groups/${id}/history`, { method: 'POST', body: JSON.stringify(data) }),
  setNucleationContactGroup: (id: string, groupId: string | null) => request(`/nucleation/${id}/group`, { method: 'PUT', body: JSON.stringify({ groupId }) }),
  convertNucleationContact: (id: string, data: any = {}) =>
    request(`/nucleation/${id}/convert`, { method: 'POST', body: JSON.stringify(data) })
};
