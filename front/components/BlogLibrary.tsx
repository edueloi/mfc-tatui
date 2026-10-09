import React, { useEffect, useState } from 'react';
import { Eye, FileText, ImagePlus, Pencil, Plus, Star } from 'lucide-react';
import { BlogPost } from '../types';
import { photoSrc } from '../api';
import { normalizeDirectoryText } from '../utils/memberDirectory';
import { dateLabel } from '../utils/dates';
import { Badge, Button, ContentCard, EmptyState, FilterLine, FilterLineItem, FilterLineSearch, FilterLineSection, GridTable, StatCard, StatGrid, Tabs, usePagination } from './ui';

interface Props { posts: BlogPost[]; loading: boolean; error: boolean; onRetry: () => void; onOpen: (post: BlogPost) => void; onNew: () => void; }
export function BlogLibrary({ posts, loading, error, onRetry, onOpen, onNew }: Props) {
  const [tab, setTab] = useState('todas');
  const [search, setSearch] = useState('');
  const published = posts.filter(post => post.published).length;
  const featured = posts.filter(post => post.featured).length;
  const query = normalizeDirectoryText(search);
  const filtered = posts.filter(post => (tab === 'todas' || tab === 'publicadas' && post.published || tab === 'rascunhos' && !post.published || tab === 'destaques' && post.featured)
    && (!query || normalizeDirectoryText(`${post.title} ${post.excerpt}`).includes(query)));
  const pagination = usePagination(filtered, 15);
  useEffect(() => { pagination.setPage(1); }, [tab, search]);
  const title = (post: BlogPost) => <button type="button" className="blog-post-link" onClick={() => onOpen(post)}>
    <span className="blog-post-thumb">{post.coverImage ? <img src={photoSrc(post.coverImage)} alt="" loading="lazy" /> : <FileText size={22} />}</span>
    <span className="min-w-0"><span className="block text-xs font-medium text-slate-900 [overflow-wrap:anywhere]">{post.title}</span><span className="mt-1 line-clamp-2 block text-[11px] text-slate-500 [overflow-wrap:anywhere]">{post.excerpt || 'Sem resumo'}</span></span>
  </button>;
  const status = (post: BlogPost) => <div className="flex flex-wrap gap-1.5"><Badge color={post.published ? 'success' : 'default'} dot>{post.published ? 'Publicada' : 'Rascunho'}</Badge>{post.featured && <Badge color="warning" icon={<Star size={11} />}>Destaque</Badge>}</div>;
  const empty = <EmptyState icon={FileText} title={query ? 'Nenhuma história encontrada' : tab === 'destaques' ? 'Nenhum destaque ainda' : tab === 'rascunhos' ? 'Nenhum rascunho' : 'Nenhuma publicação nesta aba'}
    description={query ? 'Experimente outro título ou resumo.' : tab === 'destaques' ? 'Abra uma história e escolha Colocar em destaque na aba Publicação.' : 'Crie uma história para reunir o texto e as fotos do MFC.'}
    action={query ? <Button variant="outline" size="sm" onClick={() => setSearch('')}>Limpar busca</Button> : <Button size="sm" iconLeft={<Plus size={14} />} onClick={onNew}>Nova publicação</Button>} />;
  return <div className="space-y-4">
    <StatGrid cols={3}><StatCard title="Publicações" value={posts.length} icon={FileText} color="info" description="Histórias cadastradas" /><StatCard title="Visíveis no site" value={published} icon={Eye} color="success" /><StatCard title="Fotos na galeria" value={posts.reduce((sum, post) => sum + (post.images?.length || 0), 0)} icon={ImagePlus} color="warning" /></StatGrid>
    <Tabs label="Publicações do blog" value={tab} onChange={setTab} items={[
      { id: 'todas', label: `Publicações (${posts.length})`, icon: FileText }, { id: 'publicadas', label: `Publicadas (${published})`, icon: Eye },
      { id: 'destaques', label: `Destaques (${featured})`, icon: Star }, { id: 'rascunhos', label: `Rascunhos (${posts.length - published})`, icon: Pencil },
    ]}>
      <div className="space-y-3">
        <FilterLine><FilterLineSection grow><FilterLineItem grow><FilterLineSearch aria-label="Buscar publicações" placeholder="Buscar pelo título ou resumo…" value={search} onChange={setSearch} /></FilterLineItem></FilterLineSection><FilterLineSection align="right"><span className="text-xs text-slate-500" role="status">{filtered.length} {filtered.length === 1 ? 'publicação' : 'publicações'}</span>{search && <Button variant="ghost" size="sm" onClick={() => setSearch('')}>Limpar</Button>}</FilterLineSection></FilterLine>
        {error ? <ContentCard><EmptyState icon={FileText} title="Não foi possível carregar as publicações" description="Tente novamente para atualizar a lista." action={<Button size="sm" onClick={onRetry}>Tentar novamente</Button>} /></ContentCard> : <GridTable<BlogPost>
          data={pagination.paginatedData} keyExtractor={post => post.id} isLoading={loading} mobileBreakpoint="lg" tableMinWidth={720} emptyMessage={empty}
          columns={[
            { header: 'Publicação', className: 'w-[45%]', render: title }, { header: 'Situação', render: status },
            { header: 'Galeria', render: post => <span className="whitespace-nowrap text-xs text-slate-500">{post.images?.length || 0} fotos</span> },
            { header: 'Atualizada em', render: post => <span className="whitespace-nowrap text-xs text-slate-500">{dateLabel((post.updatedAt || post.createdAt || '').slice(0, 10)) || '—'}</span> },
            { header: 'Ações', render: post => <Button variant="outline" size="xs" iconLeft={<Pencil size={13} />} onClick={() => onOpen(post)}>Abrir</Button> },
          ]}
          renderMobileItem={post => <div className="space-y-3">{title(post)}<div className="flex flex-wrap items-center justify-between gap-2">{status(post)}<span className="text-xs text-slate-500">{post.images?.length || 0} fotos</span></div><Button size="sm" variant="outline" iconLeft={<Pencil size={14} />} onClick={() => onOpen(post)}>Abrir publicação</Button></div>}
          pagination={{ total: filtered.length, page: pagination.page, pageSize: pagination.pageSize, onPageChange: pagination.setPage, onPageSizeChange: pagination.setPageSize }} />}
      </div>
    </Tabs>
  </div>;
}
