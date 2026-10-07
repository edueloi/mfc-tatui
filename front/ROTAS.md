# MFC Sistema - Rotas da Aplicação

## Estrutura de URLs

O sistema agora utiliza **React Router DOM** para gerenciar a navegação com URLs reais.

### Rotas Disponíveis

| URL | Descrição | Componente | Acesso |
|-----|-----------|------------|--------|
| `/` | Dashboard principal | Dashboard | Todos |
| `/mfcistas` | Lista de MFCistas | Members | ADMIN, COORD_CIDADE, TESOUREIRO, COORD_ESTADO |
| `/mfcistas/:memberId` | Perfil de um MFCista específico | MemberProfile | ADMIN, COORD_CIDADE, TESOUREIRO, COORD_ESTADO |
| `/equipes` | Lista de Equipes Base | Teams | ADMIN, COORD_CIDADE |
| `/equipes/:teamSlug` | Detalhes de uma Equipe | TeamDetail | ADMIN, COORD_CIDADE |
| `/minha-equipe` | Minha Equipe (visão do membro) | MyTeam | TESOUREIRO, COORD_EQUIPE_BASE, USUARIO |
| `/eventos` | Eventos e Metas | Events | ADMIN, COORD_CIDADE, COORD_ESTADO |
| `/financeiro` | Tesouraria Equipes | Finance | ADMIN, COORD_CIDADE, COORD_ESTADO, TESOUREIRO |
| `/financeiro/:teamSlug` | Tesouraria de uma equipe (ex.: `/financeiro/equipe-sao-jose?mes=7&ano=2026`) | Finance | ADMIN, COORD_CIDADE, COORD_ESTADO, TESOUREIRO |
| `/livro-caixa` | Livro Caixa | GeneralLedger | ADMIN, COORD_CIDADE, COORD_ESTADO, TESOUREIRO |
| `/livro-caixa/:bookSlug` | Livro caixa de um exercício (ex.: `/livro-caixa/livro-caixa-da-unidade?aba=balancete`; abas `lancamentos`, `balancete`, `grafico`) | GeneralLedger | ADMIN, COORD_CIDADE, COORD_ESTADO, TESOUREIRO |
| `/encontro-noivos` | Encontros de noivos (cards) | EncontroNoivos | conforme permissões do módulo |
| `/encontro-noivos/casais` | Todos os casais | EncontroNoivos | conforme permissões do módulo |
| `/encontro-noivos/encontro/:meetingSlug` | Casais de um encontro (ex.: `/encontro-noivos/encontro/encontro-agosto-2026`); `sem-encontro` lista as fichas sem turma | EncontroNoivos | conforme permissões do módulo |
| `/encontro-noivos/:coupleSlug` | Ficha de um casal (ex.: `/encontro-noivos/joao-e-maria`) | BridalCoupleDetail | conforme permissões do módulo |
| `/usuarios` | Usuários do Sistema | UserManagement | ADMIN |
| `/configuracoes/:aba` | Ajustes: `acessos`, `unidades` ou `financeiro` (`/configuracoes` redireciona para `acessos`; use `?perfil=` para escolher o perfil) | Settings | ADMIN |
| `/nucleacao` | Contatos de nucleação | Nucleacao | conforme permissões do módulo |
| `/nucleacao/:contactSlug` | Contato (ex.: `/nucleacao/lucas-ferreira-amanda-ribeiro`) | NucleationDetail | conforme permissões do módulo |

### Parâmetros de URL

- `:memberId` - ID único do membro (exemplo: `/mfcistas/m1`)
- `:teamSlug` - nome da equipe em formato de URL (exemplo: `/equipes/equipe-sao-jose`); links antigos com o id ainda funcionam e são redirecionados

### Navegação Programática

O sistema utiliza o hook `useNavigate()` do React Router para navegação:

```tsx
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

// Navegar para lista de membros
navigate('/mfcistas');

// Navegar para perfil de membro específico
navigate(`/mfcistas/${memberId}`);

// Voltar para página anterior
navigate(-1);
```

### Parâmetros de Rota

Para acessar parâmetros de URL, use o hook `useParams()`:

```tsx
import { useParams } from 'react-router-dom';

const { memberId } = useParams<{ memberId: string }>();
```

### Layout

O componente `Layout` envolve todas as rotas e fornece:
- Sidebar com navegação
- Header com informações do usuário
- Outlet para renderizar o conteúdo das rotas

### Controle de Acesso

O acesso às rotas é controlado pelo componente `Layout`, que filtra os itens de navegação baseado nas permissões do usuário logado.

### Responsividade

O sistema é totalmente responsivo:
- **Desktop** (>= 1024px): Sidebar sempre visível
- **Tablet/Mobile** (< 1024px): Sidebar em modo overlay, acionada por botão menu

### Aba na URL

Telas com abas guardam a aba em `?aba=<id>` (ex.: `/mfcistas/<id>?aba=saude`, `/?aba=aniversarios`, `/financeiro/<equipe>?aba=recebimentos`). A aba padrão não aparece na URL.
