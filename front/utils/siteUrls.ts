/**
 * Endereços por domínio: o sistema roda em painel.<domínio> e o site/links públicos em <domínio>.
 * Em localhost ou em outro host (sem "painel."), tudo continua na mesma origem e o site fica em /site/.
 */
const host = () => window.location.hostname;
export const isPanelHost = () => host().startsWith('painel.');

/** Origem usada nos links públicos (inscrições): sempre o domínio principal, nunca o painel. */
export const publicOrigin = () => (isPanelHost() ? `${window.location.protocol}//${host().slice('painel.'.length)}${window.location.port ? `:${window.location.port}` : ''}` : window.location.origin);

/** Página inicial do site público. */
export const publicSiteUrl = () => (isPanelHost() ? `${publicOrigin()}/` : '/site/');
