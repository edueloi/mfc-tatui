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
| `/equipes/:teamId` | Detalhes de uma Equipe | TeamDetail | ADMIN, COORD_CIDADE |
| `/minha-equipe` | Minha Equipe (visão do membro) | MyTeam | TESOUREIRO, COORD_EQUIPE_BASE, USUARIO |
| `/eventos` | Eventos e Metas | Events | ADMIN, COORD_CIDADE, COORD_ESTADO |
| `/financeiro` | Tesouraria Equipes | Finance | ADMIN, COORD_CIDADE, COORD_ESTADO, TESOUREIRO |
| `/livro-caixa` | Livro Caixa | GeneralLedger | ADMIN, COORD_CIDADE, COORD_ESTADO, TESOUREIRO |
| `/usuarios` | Usuários do Sistema | UserManagement | ADMIN |
| `/configuracoes` | Configurações do Sistema | Settings | ADMIN |

### Parâmetros de URL

- `:memberId` - ID único do membro (exemplo: `/mfcistas/m1`)
- `:teamId` - ID único da equipe (exemplo: `/equipes/t1`)

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
