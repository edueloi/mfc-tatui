# 📱 MFC Sistema - Frontend Responsivo

Sistema de gestão completo para o Movimento Familiar Cristão, totalmente otimizado para dispositivos móveis.

## 🎯 Recursos Principais

- ✅ **100% Responsivo** - Funciona perfeitamente em celular, tablet e desktop
- ✅ **URLs Navegáveis** - Sistema de rotas com React Router DOM
- ✅ **Design Moderno** - Interface limpa e profissional
- ✅ **Mobile First** - Projetado para celular desde o início
- ✅ **Performance Otimizada** - Carregamento rápido e animações suaves

## 📐 Breakpoints Responsivos

- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 1024px (md/lg)
- **Desktop**: >= 1024px (lg/xl)

## 🎨 Adequações Mobile

### Layout
- ✅ Sidebar em overlay com botão menu (mobile)
- ✅ Sidebar fixa lateral (desktop)
- ✅ Header compacto em mobile
- ✅ Espaçamentos otimizados para toque

### Dashboard
- ✅ Cards de estatísticas empilhados (mobile)
- ✅ Grid 2x2 em tablet
- ✅ Grid 1x4 em desktop
- ✅ Gráficos responsivos com Recharts
- ✅ Filtros compactos em mobile

### Membros (MFCistas)
- ✅ **Visualização em Cards** para mobile
- ✅ **Tabela completa** para desktop
- ✅ Botões full-width em mobile
- ✅ Formulários adaptados para toque
- ✅ Estatísticas em grid responsivo

### Equipes
- ✅ Cards empilhados em mobile
- ✅ Grid 2 colunas em tablet
- ✅ Grid 3 colunas em desktop
- ✅ Botões otimizados para toque

### Perfil do Membro
- ✅ Header compacto em mobile
- ✅ Tabs adaptadas para mobile
- ✅ Imagens responsivas
- ✅ Informações empilhadas

## 🚀 Tecnologias

- React 19.2.4
- TypeScript 5.8.2
- React Router DOM 7.13.0
- Tailwind CSS
- Recharts 3.7.0
- Lucide React 0.563.0
- Vite 6.2.0

## 🔧 Comandos

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Preview
npm run preview
```

## 📱 Otimizações Mobile

### Touch & UX
- Tap highlight desabilitado
- Active states com feedback
- Áreas de toque >= 44x44px
- Inputs com font-size >= 16px

### Performance
- GPU acceleration
- Lazy loading
- Virtual scrolling
- Animações otimizadas

### Compatibilidade
- Safe area insets (notch)
- Orientação landscape/portrait
- iOS & Android otimizado

## 📂 Estrutura

```
front/
├── components/
│   └── Layout.tsx
├── views/
│   ├── Dashboard.tsx
│   ├── Members.tsx
│   ├── Teams.tsx
│   └── ...
├── App.tsx
├── index.tsx
├── index.css
└── types.ts
```

## 🌐 Rotas

Veja [ROTAS.md](./ROTAS.md) para documentação completa.

---

**MFC Gestão** - Sistema responsivo para gestão do MFC 🙏
