import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Phone, UserPlus, Heart, MessageCircle, Trash2, CheckCircle2, XCircle, Clock, History, ClipboardList, Loader2, PhoneCall, ExternalLink } from 'lucide-react';
import { api } from '../api';
import { NucleationAttempt, NucleationContact, NucleationGroup, User as UserType } from '../types';
import { PageWrapper, ContentCard, PanelCard, Button, Badge, EmptyState, ConfirmModal, DetailField, Tabs, DatePicker, Select, Input } from '../components/ui';
import { usePermission } from '../src/hooks/usePermission';
import { maskPhone } from '../utils/masks';
import { dateLabel } from '../utils/dates';
import { whatsappUrl } from '../utils/whatsapp';
import { NUCLEATION_BASE, contactPath, findContact } from '../utils/nucleationPaths';
import { RESULT_COLOR, RESULT_OPTIONS, STATUS_COLOR } from '../utils/nucleationStatus';
import { useUrlTab } from '../src/hooks/useUrlTab';

const tabs = [
  { id: 'tentativas', label: 'Tentativas', icon: History },
  { id: 'dados', label: 'Dados do contato', icon: ClipboardList },
] as const;
const tabIds = tabs.map(tab => tab.id);

const resultIcon = (result: string) => result === 'Sucesso' ? <CheckCircle2 size={10} /> : result === 'Sem Sucesso' ? <XCircle size={10} /> : <Clock size={10} />;
const blankAttempt = { scheduledDate: '', contactedBy: '', result: 'Agendado', notes: '' };

const NucleationDetail: React.FC = () => {
  const { contactSlug } = useParams<{ contactSlug: string }>();
  const navigate = useNavigate();
  const canEdit = usePermission('nucleacao', 'edit');
  const canDelete = usePermission('nucleacao', 'delete');

  const [list, setList] = useState<NucleationContact[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [groups, setGroups] = useState<NucleationGroup[]>([]);
  const [contact, setContact] = useState<NucleationContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [activeTab, setActiveTab] = useUrlTab(tabIds, 'tentativas');
  const [attempt, setAttempt] = useState(blankAttempt);
  const [touched, setTouched] = useState(false);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getNucleationContacts(), api.getUsers().catch(() => []), api.getNucleationGroups().catch(() => [])])
      .then(([items, userItems, groupItems]) => { if (!cancelled) { setList(items); setUsers(userItems); setGroups(groupItems); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);

  const target = useMemo(() => findContact(list, contactSlug), [list, contactSlug]);

  useEffect(() => {
    if (!target) { setContact(null); return; }
    let cancelled = false;
    api.getNucleationContact(target.id).then((full: NucleationContact) => { if (!cancelled) setContact(full); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [target?.id]);

  // Link por id passa a mostrar o nome do contato na URL.
  useEffect(() => {
    if (!target) return;
    const path = contactPath(target, list);
    if (path !== `${NUCLEATION_BASE}/${contactSlug}`) navigate({ pathname: path, search: window.location.search }, { replace: true });
  }, [target, list, contactSlug, navigate]);

  useEffect(() => {
    // Responsável padrão: quem está logado.
    try {
      const me = JSON.parse(localStorage.getItem('mfc.currentUser') || 'null');
      if (me?.id) setAttempt(prev => prev.contactedBy ? prev : { ...prev, contactedBy: me.id });
    } catch { /* sem usuário salvo */ }
  }, []);

  const needsDate = attempt.result === 'Agendado' || attempt.result === 'Reagendado';
  const attemptError = needsDate && !attempt.scheduledDate ? 'Informe a data do contato agendado.' : '';

  const registerAttempt = async () => {
    setTouched(true);
    if (!contact || attemptError || savingAttempt) return;
    setSavingAttempt(true);
    try {
      const updated: NucleationContact = await api.createNucleationAttempt(contact.id, attempt);
      setContact(updated);
      setList(prev => prev.map(item => item.id === updated.id ? { ...item, status: updated.status, attemptsCount: (updated.attempts || []).length } : item));
      setAttempt(prev => ({ ...blankAttempt, contactedBy: prev.contactedBy }));
      setTouched(false);
      toast.success('Tentativa registrada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar a tentativa.');
    } finally { setSavingAttempt(false); }
  };

  const convert = async () => {
    if (!contact || converting) return;
    setConverting(true);
    try {
      const result = await api.convertNucleationContact(contact.id);
      setContact({ ...contact, ...result.contact });
      setList(prev => prev.map(item => item.id === contact.id ? { ...item, ...result.contact } : item));
      setShowConvert(false);
      toast.success(`${result.member.name} agora é MFCista.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível converter o contato.');
    } finally { setConverting(false); }
  };

  const remove = async () => {
    if (!contact || deleting) return;
    setDeleting(true);
    try {
      await api.deleteNucleationContact(contact.id);
      toast.success('Contato excluído.');
      navigate(NUCLEATION_BASE, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o contato.');
      setDeleting(false);
    }
  };

  const setGroup = async (groupId: string) => {
    if (!contact || savingGroup) return;
    setSavingGroup(true);
    try {
      const updated: NucleationContact = await api.setNucleationContactGroup(contact.id, groupId || null);
      const group = groups.find(item => item.id === (groupId || null));
      setContact({ ...updated, groupName: group?.name || null });
      setList(prev => prev.map(item => item.id === updated.id ? { ...item, ...updated, groupName: group?.name || null } : item));
      toast.success(groupId ? 'Contato vinculado ao grupo.' : 'Contato removido do grupo.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível alterar o grupo.');
    } finally { setSavingGroup(false); }
  };

  if (loading || (target && !contact && !error)) return <PageWrapper><div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Carregando contato…</div></PageWrapper>;

  if (error || !contact) return <PageWrapper><ContentCard><EmptyState icon={PhoneCall}
    title={error ? 'Não foi possível carregar o contato' : 'Contato não encontrado'}
    description={error ? 'Confira a conexão e tente novamente.' : 'O contato pode ter sido removido ou o endereço está incorreto.'}
    action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate(NUCLEATION_BASE)}>Voltar para Nucleação</Button>{error && <Button onClick={() => { setError(false); setLoading(true); setRetry(value => value + 1); }}>Tentar novamente</Button>}</div>} />
  </ContentCard></PageWrapper>;

  const converted = contact.status === 'Convertido';
  const attempts = [...(contact.attempts || [])].sort((a: NucleationAttempt, b: NucleationAttempt) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const phones = [contact.phone1, contact.phone2].filter(Boolean);
  const origin = [contact.coupleNoivoName, contact.coupleNoivaName].filter(Boolean).join(' & ');
  const groupName = contact.groupName || groups.find(group => group.id === contact.groupId)?.name;

  return (
    <PageWrapper className="nucleation-directory">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={() => navigate(NUCLEATION_BASE)}>Voltar para Nucleação</Button>
          <div className="flex flex-wrap gap-2">
            {converted && contact.convertedMemberId && <Button variant="outline" size="sm" iconLeft={<ExternalLink size={14} />} onClick={() => navigate(`/mfcistas/${contact.convertedMemberId}`)}>Ver MFCista</Button>}
            {canEdit && !converted && <Button size="sm" iconLeft={<UserPlus size={14} />} onClick={() => setShowConvert(true)}>Converter em MFCista</Button>}
            {canDelete && <Button variant="outline" size="sm" iconLeft={<Trash2 size={14} />} onClick={() => setShowDelete(true)}>Excluir</Button>}
          </div>
        </div>

        <ContentCard padding="md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600"><PhoneCall size={24} /></div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-semibold text-slate-900 break-words">{contact.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge dot color={STATUS_COLOR[contact.status] || 'default'}>{contact.status}</Badge>
                  {origin && <Badge className="max-w-full whitespace-normal break-words leading-relaxed" color="purple" icon={<Heart size={10} />}>Encontro de Noivos: {origin}</Badge>}
                  {groupName && <Badge className="max-w-full whitespace-normal break-words leading-relaxed" color="info">Grupo: {groupName}</Badge>}
                  <span className="text-xs text-slate-500">{attempts.length} {attempts.length === 1 ? 'tentativa' : 'tentativas'}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {phones.map(phone => {
                const url = whatsappUrl(phone, `Olá! Tudo bem? Aqui é do MFC (Movimento Familiar Cristão). Gostaríamos de conversar com vocês depois do Encontro de Noivos. Podemos falar? 🙏`);
                return <div key={phone} className="flex gap-1.5">
                  <Button variant="outline" size="sm" iconLeft={<Phone size={14} />} onClick={() => { window.location.href = `tel:${phone.replace(/\D/g, '')}`; }}>{maskPhone(phone)}</Button>
                  <Button variant="success" size="sm" disabled={!url} aria-label={`WhatsApp ${maskPhone(phone)}`} title={url ? 'Abrir WhatsApp com mensagem pronta' : 'Telefone incompleto'} iconLeft={<MessageCircle size={14} />} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>WhatsApp</Button>
                </div>;
              })}
            </div>
          </div>
        </ContentCard>

        <Tabs<typeof tabs[number]['id']> items={tabs} value={activeTab} onChange={setActiveTab} label="Detalhes do contato">
          {activeTab === 'tentativas' && <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <PanelCard title="Histórico de tentativas" description="Mais recentes primeiro.">
              {attempts.length ? <ul className="divide-y divide-slate-100">{attempts.map(item => {
                const user = users.find(candidate => candidate.id === item.contactedBy);
                return <li key={item.id} className="flex items-start gap-3 py-2.5">
                  <Badge size="sm" color={RESULT_COLOR[item.result] || 'default'} icon={resultIcon(item.result)}>{item.result}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-800">{dateLabel(item.scheduledDate) || 'Sem data'}{user ? ` · ${user.name}` : ''}</p>
                    {item.notes && <p className="mt-0.5 text-xs text-slate-500 break-words">{item.notes}</p>}
                  </div>
                </li>;
              })}</ul> : <EmptyState icon={History} title="Nenhuma tentativa ainda" description="Registre a primeira conversa ao lado." />}
            </PanelCard>

            {canEdit && !converted
              ? <PanelCard title="Registrar tentativa" description="O que aconteceu neste contato.">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><DatePicker label="Data" value={attempt.scheduledDate} onChange={value => setAttempt(prev => ({ ...prev, scheduledDate: value || '' }))} />
                      {touched && attemptError && <p role="alert" className="mt-1 text-xs text-red-600">{attemptError}</p>}</div>
                    <Select label="Responsável" value={attempt.contactedBy} onChange={event => setAttempt(prev => ({ ...prev, contactedBy: event.target.value }))} options={users.map(user => ({ value: user.id, label: user.name }))} placeholder="Selecione" />
                  </div>
                  <Select label="Resultado" value={attempt.result} onChange={event => setAttempt(prev => ({ ...prev, result: event.target.value }))} options={RESULT_OPTIONS} />
                  <Input label="Observação" value={attempt.notes} onChange={event => setAttempt(prev => ({ ...prev, notes: event.target.value }))} placeholder="Detalhes da conversa…" />
                  <Button size="sm" loading={savingAttempt} onClick={registerAttempt}>Registrar tentativa</Button>
                </div>
              </PanelCard>
              : <PanelCard title={converted ? 'Contato convertido' : 'Somente consulta'}>
                <p className="text-xs leading-relaxed text-slate-500">{converted ? 'Este contato já virou MFCista; não há novas tentativas a registrar.' : 'Você não tem permissão para registrar tentativas.'}</p>
              </PanelCard>}
          </div>}

          {activeTab === 'dados' && <PanelCard title="Dados do contato">
            {canEdit && <div className="mb-4 max-w-sm"><Select label="Grupo de nucleação" value={contact.groupId || ''} onChange={event => setGroup(event.target.value)} disabled={savingGroup}
              options={[{ value: '', label: 'Sem grupo' }, ...groups.map(group => ({ value: group.id, label: group.name }))]} /></div>}
            <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
              <DetailField label="Nome" value={contact.name} />
              <DetailField label="Telefone 1" value={maskPhone(contact.phone1 || '')} />
              <DetailField label="Telefone 2" value={maskPhone(contact.phone2 || '')} />
              <DetailField label="Status" value={contact.status} />
              <DetailField label="Grupo" value={groupName || 'Sem grupo'} />
              <DetailField label="Origem" value={origin ? `Encontro de Noivos (${origin})` : 'Cadastro manual'} />
              <DetailField label="Cadastrado em" value={dateLabel(contact.createdAt)} />
              <DetailField label="Última atualização" value={dateLabel(contact.updatedAt)} />
            </dl>
          </PanelCard>}
        </Tabs>
      </div>

      <ConfirmModal isOpen={showConvert} onClose={() => setShowConvert(false)} onConfirm={convert} loading={converting} variant="primary"
        title="Converter em MFCista?" message={`${contact.name} será cadastrado como MFCista, sem equipe vinculada. Você poderá completar o cadastro depois.`} confirmLabel="Converter em MFCista" />
      <ConfirmModal isOpen={showDelete} onClose={() => setShowDelete(false)} onConfirm={remove} loading={deleting} variant="danger"
        title="Excluir contato?" message={`O contato de ${contact.name} e o histórico de tentativas serão excluídos. Esta ação não pode ser desfeita.`} confirmLabel="Excluir contato" />
    </PageWrapper>
  );
};

export default NucleationDetail;
