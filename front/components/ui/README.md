# UI do MFC

A referência visual são as telas aprovadas de Livro Caixa, MFCistas, Nucleação e Histórias e Fotos. Não adaptar essas telas a outro tema.

## Onde alterar o padrão

- `theme.ts`: variantes de botões, superfícies de cards/filtros, tabela e alertas.
- `styles.css`: campos base, modais, tamanhos dos ícones, controles no celular e notificação avulsa. Importado uma única vez por `front/index.css`.
- `Toast.tsx`: notificações escuras, no canto superior direito, com duração de três segundos. `ToastProvider` na raiz atende tanto `useToast()` quanto as chamadas existentes a `react-hot-toast`; não instalar outro `Toaster`.
- Componentes mantêm suas propriedades e permitem personalização por `className`. As classes de peso médio refletem o peso 500 que já era exibido nas telas; não dependem mais das correções globais nos componentes ajustados.

## Composição

Use `PageWrapper` e `SectionTitle` para estrutura; `StatGrid`/`StatCard` para indicadores; `ContentCard` ou `PanelCard` para conteúdo; `FilterLine` para filtros; `GridTable` para listagens; `Modal`/`ModalFooter` para diálogos; `Alert` para mensagens fixas no conteúdo e `useToast` para notificações de ações.

O espaçamento **entre** seções continua sendo responsabilidade da página. O componente não adiciona margens externas que possam alterar layouts existentes.

## Revisão complementar

- Seletores (`Combobox`, `DatePicker`) compartilham a superfície de popover; calendário e paginação mantêm sua densidade, com foco visível e fontes de peso médio.
- `FileUpload` mantém o fluxo de anexos, com foco visível e nomes acessíveis nas ações de remover.
- `RichTextEditor` usa os mesmos `Modal`, `Input`, `Button` e `Tabs` nos diálogos de link e imagem (`EditorDialogs`). A seleção do texto é preservada ao abrir esses diálogos. A formatação do conteúdo das publicações não é normalizada como se fosse um controle da interface.
- `TokenTextarea` usa marcadores azuis compactos, definidos em `styles.css`. Seu valor continua sendo texto puro com variáveis.
- `PaymentModal` mantém os cálculos e as cores semânticas de pagamento parcial/excedente, usando azul para ações e foco.
- `Switch`, `Badge`, `DetailField` e `CepInput` já seguiam o padrão; suas estruturas e regras foram preservadas. `CepInput` herda o visual de `Input`.

`GridTable` preserva ordenação, seleção, paginação e cartões responsivos, incluindo `mobileBreakpoint` e os renderizadores específicos de cada tela. A matriz financeira por casal e outras estruturas especializadas continuam nos seus componentes de domínio; não devem ser substituídas por uma tabela genérica.

Exemplo de aviso:

```tsx
<Alert variant="warning" title="Confira os valores">
  A confirmação registra o recebimento no livro caixa.
</Alert>
```

## Validação local (Node 22)

Na pasta `front`, execute `node tests/ui-design-system.cjs`, `node tests/member-directory-layout.cjs`, `node tests/family-payment-layout.cjs`, `node tests/ledger-teams-layout.cjs` e `node tests/blog-management-layout.cjs`. Os testes usam dados fictícios e não alteram o banco. O teste da UI também funciona sem o CSS global das telas, verificando o padrão dos componentes isoladamente.

`node tests/ui-extended-components.cjs` verifica os componentes complementares, incluindo inserção de link na seleção correta, imagem com descrição, anexos, calendário, paginação, variáveis e confirmação de pagamento. `node tests/member-directory-layout.cjs --nucleation` confere Nucleação.
