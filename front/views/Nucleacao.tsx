import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  PhoneCall,
  Plus,
  Phone,
  UserPlus,
  Clock,
  CheckCircle2,
  XCircle,
  Heart,
} from 'lucide-react';
import { api } from '../api';
import { NucleationContact, NucleationAttempt, User as UserType } from '../types';
import {
  PageWrapper,
  SectionTitle,
  StatGrid,
  StatCard,
  ContentCard,
  Button,
  FilterLine,
  FilterLineSection,
  FilterLineItem,
  FilterLineSearch,
  FilterLineSegmented,
  GridTable,
  EmptyState,
  Badge,
  Modal,
  ModalFooter,
  ConfirmModal,
  Input,
  Select,
  DatePicker,
  usePagination,
} from '../components/ui';
import type { Column } from '../components/ui';
import { usePermission } from '../src/hooks/usePermission';

const RESULT_COLOR: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
  Sucesso: 'success',
  'Sem Sucesso': 'danger',
  Reagendado: 'warning',
  Agendado: 'info',
};

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  Pendente: 'warning',
  'Em Andamento': 'info',
  Convertido: 'success',
  'Sem Sucesso': 'danger',
};

const Nucleacao: React.FC = () => {
  const canCreate = usePermission('nucleacao', 'create');
  const canEdit = usePermission('nucleacao', 'edit');
  const canDelete = usePermission('nucleacao', 'delete');

  const [contacts, setContacts] = useState<NucleationContact[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');

  const [showNewModal, setShowNewModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone1: '', phone2: '' });
  const [saving, setSaving] = useState(false);

  const [selectedContact, setSelectedContact] = useState<NucleationContact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NucleationContact | null>(null);

  const [newAttempt, setNewAttempt] = useState({ scheduledDate: '', contactedBy: '', result: 'Agendado', notes: '' });
  const [convertTarget, setConvertTarget] = useState<NucleationContact | null>(null);

  const loadContacts = () => {
    api.getNucleationContacts().then(setContacts).catch(() => setContacts([]));
  };

  useEffect(() => {
    loadContacts();
    api.getUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const filtered = useMemo(() => {
    return contacts.filter(c => {
      const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'Todos' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [contacts, search, statusFilter]);

  const { page, setPage, pageSize, setPageSize, paginatedData } = usePagination(filtered);

  const stats = useMemo(() => ({
    total: contacts.length,
    emAndamento: contacts.filter(c => c.status === 'Em Andamento').length,
    convertidos: contacts.filter(c => c.status === 'Convertido').length,
    semSucesso: contacts.filter(c => c.status === 'Sem Sucesso').length,
  }), [contacts]);

  const openDetail = (contact: NucleationContact) => {
    api.getNucleationContact(contact.id).then(setSelectedContact).catch(() => toast.error('Erro ao carregar contato.'));
  };

  const handleCreate = async () => {
    if (!newContact.name.trim()) {
      toast.error('Informe o nome do contato.');
      return;
    }
    setSaving(true);
    try {
      const created = await api.createNucleationContact(newContact);
      setContacts(prev => [created, ...prev]);
      setShowNewModal(false);
      setNewContact({ name: '', phone1: '', phone2: '' });
      toast.success('Contato criado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar contato.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    toast.promise(
      api.deleteNucleationContact(deleteTarget.id).then(() => {
        setContacts(prev => prev.filter(c => c.id !== deleteTarget.id));
        setDeleteTarget(null);
      }),
      { loading: 'Excluindo contato...', success: 'Contato excluído!', error: 'Erro ao excluir contato.' }
    );
  };

  const handleRegisterAttempt = async () => {
    if (!selectedContact) return;
    try {
      const updated = await api.createNucleationAttempt(selectedContact.id, newAttempt);
      setSelectedContact(updated);
      setContacts(prev => prev.map(c => c.id === updated.id ? { ...c, status: updated.status, attemptsCount: (c.attemptsCount || 0) + 1 } : c));
      setNewAttempt({ scheduledDate: '', contactedBy: '', result: 'Agendado', notes: '' });
      toast.success('Tentativa registrada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar tentativa.');
    }
  };

  const handleConvert = async () => {
    if (!convertTarget) return;
    try {
      const result = await api.convertNucleationContact(convertTarget.id);
      setContacts(prev => prev.map(c => c.id === convertTarget.id ? result.contact : c));
      setSelectedContact(result.contact);
      setConvertTarget(null);
      toast.success(`${result.member.name} convertido em MFCista!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao converter contato.');
    }
  };

  const columns: Column<NucleationContact>[] = [
    {
      header: 'Nome',
      render: (c) => (
        <div>
          <p className="font-black text-zinc-900 text-sm">{c.name}</p>
          <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest flex items-center gap-1.5">
            {c.attemptsCount || 0} {c.attemptsCount === 1 ? 'tentativa' : 'tentativas'}
            {c.coupleId && (
              <span className="inline-flex items-center gap-1 text-rose-500">
                <Heart className="w-3 h-3" /> Encontro de Noivos
              </span>
            )}
          </p>
        </div>
      ),
    },
    {
      header: 'Telefones',
      render: (c) => (
        <div className="flex flex-col gap-1">
          {c.phone1 && (
            <a href={`tel:${c.phone1}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline">
              <Phone className="w-3 h-3" /> {c.phone1}
            </a>
          )}
          {c.phone2 && (
            <a href={`tel:${c.phone2}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline">
              <Phone className="w-3 h-3" /> {c.phone2}
            </a>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      render: (c) => <Badge color={STATUS_COLOR[c.status] || 'default'}>{c.status}</Badge>,
    },
    {
      header: 'Ações',
      render: (c) => (
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          <Button variant="outline" size="xs" onClick={(e) => { e.stopPropagation(); openDetail(c); }}>Detalhes</Button>
          {canDelete && (
            <Button variant="danger" size="xs" onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}>Excluir</Button>
          )}
        </div>
      ),
    },
  ];

  const attemptResultIcon = (result: string) => {
    if (result === 'Sucesso') return <CheckCircle2 className="w-3.5 h-3.5" />;
    if (result === 'Sem Sucesso') return <XCircle className="w-3.5 h-3.5" />;
    return <Clock className="w-3.5 h-3.5" />;
  };

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          title="Nucleação"
          description="Acompanhamento de contatos e conversão em MFCista."
          icon={PhoneCall}
          action={
            canCreate ? (
              <Button variant="primary" size="md" iconLeft={<Plus className="w-4 h-4" />} onClick={() => setShowNewModal(true)}>
                Novo Contato
              </Button>
            ) : undefined
          }
        />

        <StatGrid cols={4}>
          <StatCard title="Total de Contatos" value={stats.total} icon={PhoneCall} color="info" delay={0} />
          <StatCard title="Em Andamento" value={stats.emAndamento} icon={Clock} color="warning" delay={0.05} />
          <StatCard title="Convertidos" value={stats.convertidos} icon={UserPlus} color="success" delay={0.1} />
          <StatCard title="Sem Sucesso" value={stats.semSucesso} icon={XCircle} color="danger" delay={0.15} />
        </StatGrid>

        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem grow>
              <FilterLineSearch value={search} onChange={setSearch} placeholder="Buscar por nome..." />
            </FilterLineItem>
          </FilterLineSection>
          <FilterLineSection align="right">
            <FilterLineSegmented<string>
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'Todos', label: 'Todos' },
                { value: 'Pendente', label: 'Pendentes' },
                { value: 'Em Andamento', label: 'Em Andamento' },
                { value: 'Convertido', label: 'Convertidos' },
              ]}
              size="sm"
            />
          </FilterLineSection>
        </FilterLine>

        <ContentCard padding="none">
          <GridTable
            columns={columns}
            data={paginatedData}
            keyExtractor={(c) => c.id}
            onRowClick={openDetail}
            noDesktopCard
            emptyMessage={
              <EmptyState icon={PhoneCall} title="Nenhum contato encontrado" description="Cadastre um novo contato para iniciar o acompanhamento de nucleação."
                action={canCreate ? <Button variant="primary" size="sm" onClick={() => setShowNewModal(true)}>Novo Contato</Button> : undefined} />
            }
            pagination={{ total: filtered.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }}
          />
        </ContentCard>
      </div>

      {/* Modal: novo contato */}
      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="Novo Contato de Nucleação" size="sm">
        <div className="space-y-4">
          <Input
            label="Nome"
            value={newContact.name}
            onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Nome do casal ou contato"
          />
          <Input
            label="Telefone 1"
            value={newContact.phone1}
            onChange={(e) => setNewContact(prev => ({ ...prev, phone1: e.target.value }))}
            placeholder="(00) 00000-0000"
          />
          <Input
            label="Telefone 2"
            value={newContact.phone2}
            onChange={(e) => setNewContact(prev => ({ ...prev, phone2: e.target.value }))}
            placeholder="(00) 00000-0000"
          />
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowNewModal(false)}>Cancelar</Button>
          <Button variant="primary" onClick={handleCreate} loading={saving}>Criar Contato</Button>
        </ModalFooter>
      </Modal>

      {/* Modal: detalhe do contato */}
      <Modal
        isOpen={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        title={selectedContact?.name || 'Contato'}
        size="lg"
      >
        {selectedContact && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge color={STATUS_COLOR[selectedContact.status] || 'default'}>{selectedContact.status}</Badge>
                {selectedContact.coupleId && (
                  <Badge color="purple" icon={<Heart className="w-3 h-3" />}>Encontro de Noivos</Badge>
                )}
              </div>
              {canEdit && selectedContact.status !== 'Convertido' && (
                <Button variant="success" size="sm" iconLeft={<UserPlus className="w-4 h-4" />} onClick={() => setConvertTarget(selectedContact)}>
                  Converter em MFCista
                </Button>
              )}
            </div>

            <div className="flex gap-4">
              {selectedContact.phone1 && (
                <a href={`tel:${selectedContact.phone1}`} className="flex-1 flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors">
                  <Phone className="w-4 h-4" /> {selectedContact.phone1}
                </a>
              )}
              {selectedContact.phone2 && (
                <a href={`tel:${selectedContact.phone2}`} className="flex-1 flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors">
                  <Phone className="w-4 h-4" /> {selectedContact.phone2}
                </a>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Tentativas de Contato</h4>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {(selectedContact.attempts || []).length === 0 && (
                  <p className="text-sm text-zinc-400 italic">Nenhuma tentativa registrada ainda.</p>
                )}
                {(selectedContact.attempts || []).map((a: NucleationAttempt) => {
                  const user = users.find(u => u.id === a.contactedBy);
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                      <Badge color={RESULT_COLOR[a.result] || 'default'} icon={attemptResultIcon(a.result)}>
                        {a.result}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-700">{a.scheduledDate || 'Sem data'} {user ? `· ${user.name}` : ''}</p>
                        {a.notes && <p className="text-[11px] text-zinc-400">{a.notes}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {canEdit && selectedContact.status !== 'Convertido' && (
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Registrar Nova Tentativa</h4>
                <div className="grid grid-cols-2 gap-3">
                  <DatePicker
                    label="Data"
                    value={newAttempt.scheduledDate}
                    onChange={(v) => setNewAttempt(prev => ({ ...prev, scheduledDate: v || '' }))}
                  />
                  <Select
                    label="Responsável"
                    value={newAttempt.contactedBy}
                    onChange={(e) => setNewAttempt(prev => ({ ...prev, contactedBy: e.target.value }))}
                    options={users.map(u => ({ value: u.id, label: u.name }))}
                    placeholder="Selecione"
                  />
                </div>
                <Select
                  label="Resultado"
                  value={newAttempt.result}
                  onChange={(e) => setNewAttempt(prev => ({ ...prev, result: e.target.value }))}
                  options={[
                    { value: 'Agendado', label: 'Agendado' },
                    { value: 'Sucesso', label: 'Sucesso' },
                    { value: 'Sem Sucesso', label: 'Sem Sucesso' },
                    { value: 'Reagendado', label: 'Reagendado' },
                  ]}
                />
                <Input
                  label="Observação"
                  value={newAttempt.notes}
                  onChange={(e) => setNewAttempt(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Detalhes da conversa..."
                />
                <Button variant="primary" size="sm" fullWidth onClick={handleRegisterAttempt}>
                  Registrar Tentativa
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Contato"
        message={`Tem certeza que deseja excluir o contato de ${deleteTarget?.name}?`}
        confirmLabel="Sim, Excluir"
        variant="danger"
      />

      <ConfirmModal
        isOpen={!!convertTarget}
        onClose={() => setConvertTarget(null)}
        onConfirm={handleConvert}
        title="Converter em MFCista"
        message={`${convertTarget?.name} será cadastrado como MFCista (sem equipe vinculada). Deseja continuar?`}
        confirmLabel="Sim, Converter"
        variant="danger"
      />
    </PageWrapper>
  );
};

export default Nucleacao;
