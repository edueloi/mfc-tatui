import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PhoneCall, Plus, Phone, UserPlus, Clock, XCircle, Heart, MessageCircle, Trash2, ArrowRight, Loader2, UsersRound, History } from 'lucide-react';
import { api } from '../api';
import { NucleationContact, NucleationGroup } from '../types';
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard, Button, IconButton, FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch,
  FilterLineSegmented, GridTable, EmptyState, Badge, ConfirmModal, Modal, ModalFooter, Input, Select, DatePicker, PanelCard, usePagination,
} from '../components/ui';
import type { Column } from '../components/ui';
import { NucleationContactModal } from '../components/NucleationContactModal';
import { usePermission } from '../src/hooks/usePermission';
import { maskPhone } from '../utils/masks';
import { normalizeDirectoryText } from '../utils/memberDirectory';
import { whatsappUrl } from '../utils/whatsapp';
import { contactPath } from '../utils/nucleationPaths';
import { STATUS_COLOR } from '../utils/nucleationStatus';

const firstContactMessage = (name: string) => `Olá, ${name.split(/\s+&\s+|\s+e\s+/)[0].split(' ')[0]}! Tudo bem? Aqui é do MFC (Movimento Familiar Cristão). Gostaríamos de conversar sobre a continuidade da caminhada depois do Encontro de Noivos. Podemos falar? 🙏`;

const Nucleacao: React.FC = () => {
  const navigate = useNavigate();
  const canCreate = usePermission('nucleacao', 'create');
  const canDelete = usePermission('nucleacao', 'delete');

  const [contacts, setContacts] = useState<NucleationContact[]>([]);
  const [groups, setGroups] = useState<NucleationGroup[]>([]);
  const [groupView, setGroupView] = useState('geral');
  const [groupDetail, setGroupDetail] = useState<NucleationGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NucleationContact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyNotes, setHistoryNotes] = useState('');
  const [historyDate, setHistoryDate] = useState('');
  const [savingHistory, setSavingHistory] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // O histórico de contatos continua disponível enquanto o backend é atualizado com as rotas de grupos.
    const load = () => Promise.all([api.getNucleationContacts(), api.getNucleationGroups().catch(() => [])])
      .then(([items, groupItems]: [NucleationContact[], NucleationGroup[]]) => { if (!cancelled) { setContacts(items); setGroups(groupItems); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    load();
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.removeEventListener('focus', load); };
  }, [retry]);

  useEffect(() => {
    let cancelled = false;
    setGroupDetail(null);
    if (groupView === 'geral') { setGroupDetail(null); return; }
    api.getNucleationGroup(groupView).then(group => { if (!cancelled) setGroupDetail(group); }).catch(() => { if (!cancelled) setGroupDetail(null); });
    return () => { cancelled = true; };
  }, [groupView]);

  const query = normalizeDirectoryText(search);
  const digits = search.replace(/\D/g, '');
  const scopedContacts = groupView === 'geral' ? contacts : groupDetail?.contacts || contacts.filter(contact => contact.groupId === groupView);
  const filtered = useMemo(() => scopedContacts.filter(contact =>
    (!query || normalizeDirectoryText(contact.name).includes(query) || (digits.length >= 3 && [contact.phone1, contact.phone2].some(phone => (phone || '').replace(/\D/g, '').includes(digits))))
    && (statusFilter === 'Todos' || contact.status === statusFilter)
  ), [scopedContacts, query, digits, statusFilter]);
  const { page, setPage, pageSize, setPageSize, paginatedData } = usePagination(filtered, 15);
  useEffect(() => { setPage(1); }, [search, statusFilter, groupView]);

  const stats = useMemo(() => ({
    total: contacts.length,
    emAndamento: contacts.filter(contact => contact.status === 'Em Andamento').length,
    convertidos: contacts.filter(contact => contact.status === 'Convertido').length,
    semSucesso: contacts.filter(contact => contact.status === 'Sem Sucesso').length,
  }), [contacts]);
  const hasFilter = !!query || statusFilter !== 'Todos';

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.deleteNucleationContact(deleteTarget.id);
      setContacts(prev => prev.filter(contact => contact.id !== deleteTarget.id));
      toast.success('Contato excluído.');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o contato.');
    } finally { setDeleting(false); }
  };

  const open = (contact: NucleationContact) => navigate(contactPath(contact, contacts));

  const createGroup = async () => {
    if (groupName.trim().length < 3 || savingGroup) return;
    setSavingGroup(true);
    try {
      const created: NucleationGroup = await api.createNucleationGroup({ name: groupName.trim(), description: groupDescription.trim() });
      setGroups(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      setGroupName(''); setGroupDescription(''); setShowGroupModal(false); setGroupView(created.id);
      toast.success('Grupo criado.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível criar o grupo.'); }
    finally { setSavingGroup(false); }
  };

  const createHistory = async () => {
    if (groupView === 'geral' || !historyNotes.trim() || savingHistory) return;
    setSavingHistory(true);
    try {
      const item = await api.createNucleationGroupHistory(groupView, { notes: historyNotes.trim(), occurredAt: historyDate });
      setGroupDetail(prev => prev ? { ...prev, history: [item, ...(prev.history || [])] } : prev);
      setHistoryNotes(''); setHistoryDate(''); setShowHistoryModal(false);
      toast.success('Histórico do grupo registrado.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o histórico.'); }
    finally { setSavingHistory(false); }
  };

  const columns: Column<NucleationContact>[] = [
    { header: 'Contato', className: 'nucleation-name-cell', render: contact => <div className="min-w-0">
      <button type="button" className="member-identity text-xs font-medium text-slate-800 [overflow-wrap:anywhere]" onClick={event => { event.stopPropagation(); open(contact); }}>{contact.name}</button>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
        <span>{contact.attemptsCount || 0} {contact.attemptsCount === 1 ? 'tentativa' : 'tentativas'}</span>
        {contact.coupleId && <span className="inline-flex items-center gap-1 text-rose-600"><Heart size={10} />Encontro de Noivos</span>}
      </p></div> },
    { header: 'Telefones', render: contact => {
      const phones = [contact.phone1, contact.phone2].filter(Boolean);
      return phones.length ? <ul className="space-y-1">{phones.map(phone => {
        const url = whatsappUrl(phone, firstContactMessage(contact.name));
        return <li key={phone} className="flex items-center gap-1.5 text-xs text-slate-700">
          <a href={`tel:${phone.replace(/\D/g, '')}`} onClick={event => event.stopPropagation()} className="inline-flex items-center gap-1.5 text-blue-700 hover:underline"><Phone size={12} />{maskPhone(phone)}</a>
          {url && <a href={url} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()} aria-label={`WhatsApp ${maskPhone(phone)}`} title="Abrir WhatsApp com mensagem pronta" className="text-emerald-600 hover:text-emerald-700"><MessageCircle size={14} /></a>}
        </li>;
      })}</ul> : <span className="text-xs text-slate-400">Não informado</span>;
    } },
    { header: 'Status', render: contact => <Badge size="sm" dot color={STATUS_COLOR[contact.status] || 'default'}>{contact.status}</Badge> },
    ...(groupView === 'geral' ? [{ header: 'Grupo', className: 'max-w-[200px] [overflow-wrap:anywhere]', render: (contact: NucleationContact) => <span className="text-xs text-slate-600">{contact.groupName || 'Sem grupo'}</span> } as Column<NucleationContact>] : []),
    { header: 'Ações', render: contact => <div className="flex items-center gap-1.5 sm:justify-end">
      <Button variant="outline" size="xs" iconRight={<ArrowRight size={12} />} onClick={event => { event.stopPropagation(); open(contact); }}>Abrir</Button>
      {canDelete && <IconButton variant="ghost" size="xs" aria-label={`Excluir ${contact.name}`} onClick={event => { event.stopPropagation(); setDeleteTarget(contact); }}><Trash2 size={14} className="text-red-500" /></IconButton>}
    </div> },
  ];

  if (loading) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando contatos…</div></PageWrapper>;

  if (error && !contacts.length) return <PageWrapper><ContentCard><EmptyState icon={PhoneCall} title="Não foi possível carregar a nucleação" description="Confira a conexão e tente novamente."
    action={<Button onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Tentar novamente</Button>} /></ContentCard></PageWrapper>;

  return (
    <PageWrapper className="nucleation-directory">
      <div className="min-w-0 space-y-4">
        <SectionTitle title="Nucleação" icon={PhoneCall} description="Acompanhamento de contatos, grupos e conversão em MFCista."
          action={canCreate ? <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" iconLeft={<UsersRound size={14} />} onClick={() => setShowGroupModal(true)}>Novo grupo</Button><Button size="sm" iconLeft={<Plus size={14} />} onClick={() => setShowNewModal(true)}>Novo contato</Button></div> : undefined} />

        <StatGrid cols={4}>
          <StatCard title="Total de contatos" value={stats.total} icon={PhoneCall} color="info" />
          <StatCard title="Em andamento" value={stats.emAndamento} icon={Clock} color="warning" />
          <StatCard title="Convertidos" value={stats.convertidos} icon={UserPlus} color="success" />
          <StatCard title="Sem sucesso" value={stats.semSucesso} icon={XCircle} color="danger" />
        </StatGrid>

        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem className="min-w-0 sm:w-64"><Select aria-label="Grupo de nucleação" value={groupView} onChange={event => setGroupView(event.target.value)} options={[{ value: 'geral', label: `Geral — ${contacts.length} contatos` }, ...groups.map(group => ({ value: group.id, label: `${group.name} (${group.contactsCount || 0})` }))]} /></FilterLineItem>
            <FilterLineItem grow><FilterLineSearch aria-label="Buscar contato" value={search} onChange={setSearch} placeholder="Nome ou telefone…" /></FilterLineItem>
            <FilterLineItem><FilterLineSegmented<string> className="nucleation-status-filter" value={statusFilter} onChange={setStatusFilter}
              options={[{ value: 'Todos', label: 'Todos' }, { value: 'Pendente', label: 'Pendentes' }, { value: 'Em Andamento', label: 'Em andamento' }, { value: 'Convertido', label: 'Convertidos' }]} /></FilterLineItem>
          </FilterLineSection>
          <FilterLineSection align="right">
            <span className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'contato' : 'contatos'}</span>
            {hasFilter && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter('Todos'); }}>Limpar filtros</Button>}
          </FilterLineSection>
        </FilterLine>

        {groupView !== 'geral' && groupDetail && <PanelCard title={groupDetail.name} icon={UsersRound} description={groupDetail.description || 'Grupo de acompanhamento da Nucleação.'}
          action={canCreate ? <Button variant="outline" size="xs" iconLeft={<History size={12} />} onClick={() => setShowHistoryModal(true)}>Registrar histórico</Button> : undefined}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><div><p className="mb-2 text-xs font-semibold text-slate-700">Integrantes do grupo</p><p className="text-sm text-slate-600">{groupDetail.contacts?.length || 0} {(groupDetail.contacts?.length || 0) === 1 ? 'contato vinculado' : 'contatos vinculados'}.</p></div>
            <div><p className="mb-2 text-xs font-semibold text-slate-700">Histórico do grupo</p>{groupDetail.history?.length ? <ul className="space-y-1.5">{groupDetail.history.slice(0, 3).map(item => <li key={item.id} className="text-xs text-slate-600"><span className="font-medium text-slate-800">{item.occurredAt || item.createdAt}</span> · {item.notes}</li>)}</ul> : <p className="text-xs text-slate-500">Nenhum histórico registrado.</p>}</div>
          </div>
        </PanelCard>}

        <div className="min-w-0">
          <GridTable columns={columns} data={paginatedData} keyExtractor={contact => contact.id} onRowClick={open} mobileBreakpoint="xl" tableMinWidth={880}
            renderMobileItem={contact => <div className="member-mobile-card">
              <div className="member-mobile-heading"><div className="min-w-0 flex-1">{columns[0].render?.(contact)}</div>{columns[2].render?.(contact)}</div>
              <div className="nucleation-mobile-phones">{columns[1].render?.(contact)}</div>
              <p className="mb-3 text-xs text-slate-600 [overflow-wrap:anywhere]">Grupo: {contact.groupName || groups.find(group => group.id === contact.groupId)?.name || 'Sem grupo'}</p>
              <div className="border-t border-slate-100 pt-3">{columns[columns.length - 1].render?.(contact)}</div>
            </div>}
            emptyMessage={<EmptyState icon={PhoneCall} title="Nenhum contato encontrado" description={hasFilter ? 'Ajuste a busca ou o filtro.' : 'Casais confirmados no Encontro de Noivos podem ser enviados para cá.'}
              action={!hasFilter && canCreate ? <Button size="sm" onClick={() => setShowNewModal(true)}>Novo contato</Button> : undefined} />}
            pagination={{ total: filtered.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }} />
        </div>
      </div>

      <NucleationContactModal isOpen={showNewModal} onClose={() => setShowNewModal(false)} onCreated={created => setContacts(prev => [created, ...prev])} />

      <Modal isOpen={showGroupModal} onClose={() => !savingGroup && setShowGroupModal(false)} title="Novo grupo de nucleação" size="sm" footer={<ModalFooter><Button variant="ghost" size="sm" disabled={savingGroup} onClick={() => setShowGroupModal(false)}>Cancelar</Button><Button size="sm" loading={savingGroup} onClick={createGroup}>Criar grupo</Button></ModalFooter>}>
        <div className="space-y-3"><Input label="Nome do grupo" value={groupName} onChange={event => setGroupName(event.target.value)} placeholder="Ex.: Grupo São José" /><Input label="Descrição (opcional)" value={groupDescription} onChange={event => setGroupDescription(event.target.value)} placeholder="Objetivo ou responsáveis" /></div>
      </Modal>

      <Modal isOpen={showHistoryModal} onClose={() => !savingHistory && setShowHistoryModal(false)} title="Registrar histórico do grupo" size="sm" footer={<ModalFooter><Button variant="ghost" size="sm" disabled={savingHistory} onClick={() => setShowHistoryModal(false)}>Cancelar</Button><Button size="sm" loading={savingHistory} onClick={createHistory}>Registrar</Button></ModalFooter>}>
        <div className="space-y-3"><DatePicker label="Data" value={historyDate} onChange={value => setHistoryDate(value || '')} /><Input label="Histórico" value={historyNotes} onChange={event => setHistoryNotes(event.target.value)} placeholder="Ex.: Primeiro encontro do grupo..." /></div>
      </Modal>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Excluir contato?" message={`O contato de ${deleteTarget?.name} e o histórico de tentativas serão excluídos. Esta ação não pode ser desfeita.`} confirmLabel="Excluir contato" variant="danger" />
    </PageWrapper>
  );
};

export default Nucleacao;
