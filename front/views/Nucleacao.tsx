import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PhoneCall, Plus, Phone, UserPlus, Clock, XCircle, Heart, MessageCircle, Trash2, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../api';
import { NucleationContact } from '../types';
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard, Button, IconButton, FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch,
  FilterLineSegmented, GridTable, EmptyState, Badge, ConfirmModal, usePagination,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NucleationContact | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => api.getNucleationContacts()
      .then((items: NucleationContact[]) => { if (!cancelled) { setContacts(items); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    load();
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.removeEventListener('focus', load); };
  }, [retry]);

  const query = normalizeDirectoryText(search);
  const digits = search.replace(/\D/g, '');
  const filtered = useMemo(() => contacts.filter(contact =>
    (!query || normalizeDirectoryText(contact.name).includes(query) || (digits.length >= 3 && [contact.phone1, contact.phone2].some(phone => (phone || '').replace(/\D/g, '').includes(digits))))
    && (statusFilter === 'Todos' || contact.status === statusFilter)
  ), [contacts, query, digits, statusFilter]);
  const { page, setPage, pageSize, setPageSize, paginatedData } = usePagination(filtered, 15);

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

  const columns: Column<NucleationContact>[] = [
    { header: 'Contato', render: contact => <div className="min-w-0">
      <p className="text-xs font-medium text-slate-800 break-words">{contact.name}</p>
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
    { header: 'Ações', render: contact => <div className="flex items-center gap-1.5 sm:justify-end">
      <Button variant="outline" size="xs" iconRight={<ArrowRight size={12} />} onClick={event => { event.stopPropagation(); open(contact); }}>Abrir</Button>
      {canDelete && <IconButton variant="ghost" size="xs" aria-label={`Excluir ${contact.name}`} onClick={event => { event.stopPropagation(); setDeleteTarget(contact); }}><Trash2 size={14} className="text-red-500" /></IconButton>}
    </div> },
  ];

  if (loading) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando contatos…</div></PageWrapper>;

  if (error && !contacts.length) return <PageWrapper><ContentCard><EmptyState icon={PhoneCall} title="Não foi possível carregar a nucleação" description="Confira a conexão e tente novamente."
    action={<Button onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Tentar novamente</Button>} /></ContentCard></PageWrapper>;

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle title="Nucleação" icon={PhoneCall} description="Acompanhamento de contatos e conversão em MFCista."
          action={canCreate ? <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => setShowNewModal(true)}>Novo contato</Button> : undefined} />

        <StatGrid cols={4}>
          <StatCard title="Total de contatos" value={stats.total} icon={PhoneCall} color="info" />
          <StatCard title="Em andamento" value={stats.emAndamento} icon={Clock} color="warning" />
          <StatCard title="Convertidos" value={stats.convertidos} icon={UserPlus} color="success" />
          <StatCard title="Sem sucesso" value={stats.semSucesso} icon={XCircle} color="danger" />
        </StatGrid>

        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem grow><FilterLineSearch aria-label="Buscar contato" value={search} onChange={setSearch} placeholder="Nome ou telefone…" /></FilterLineItem>
            <FilterLineItem><FilterLineSegmented<string> value={statusFilter} onChange={setStatusFilter}
              options={[{ value: 'Todos', label: 'Todos' }, { value: 'Pendente', label: 'Pendentes' }, { value: 'Em Andamento', label: 'Em andamento' }, { value: 'Convertido', label: 'Convertidos' }]} /></FilterLineItem>
          </FilterLineSection>
          <FilterLineSection align="right">
            <span className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'contato' : 'contatos'}</span>
            {hasFilter && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter('Todos'); }}>Limpar filtros</Button>}
          </FilterLineSection>
        </FilterLine>

        <ContentCard padding="none">
          <GridTable columns={columns} data={paginatedData} keyExtractor={contact => contact.id} onRowClick={open} noDesktopCard
            emptyMessage={<EmptyState icon={PhoneCall} title="Nenhum contato encontrado" description={hasFilter ? 'Ajuste a busca ou o filtro.' : 'Casais confirmados no Encontro de Noivos podem ser enviados para cá.'}
              action={!hasFilter && canCreate ? <Button size="sm" onClick={() => setShowNewModal(true)}>Novo contato</Button> : undefined} />}
            pagination={{ total: filtered.length, page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }} />
        </ContentCard>
      </div>

      <NucleationContactModal isOpen={showNewModal} onClose={() => setShowNewModal(false)} onCreated={created => setContacts(prev => [created, ...prev])} />

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Excluir contato?" message={`O contato de ${deleteTarget?.name} e o histórico de tentativas serão excluídos. Esta ação não pode ser desfeita.`} confirmLabel="Excluir contato" variant="danger" />
    </PageWrapper>
  );
};

export default Nucleacao;
