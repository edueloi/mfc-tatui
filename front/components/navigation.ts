import React from 'react';
import {
  Users,
  LayoutDashboard,
  Layers,
  UserCog,
  Settings,
  UserCheck,
  DollarSign,
  BookOpen,
  Ticket,
  FileText,
  FileSpreadsheet,
  Heart,
  PhoneCall,
  Images,
} from 'lucide-react';
import { UserRoleType, User as UserType } from '../types';

export type NavItem = {
  name: string;
  icon: React.ElementType;
  path: string;
  roles?: UserRoleType[];
  checkSpecial?: (user: UserType) => boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const navigationSections: NavSection[] = [
  {
    label: "Principal",
    items: [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
      {
        name: 'MFCistas',
        icon: Users,
        path: '/mfcistas',
        roles: [UserRoleType.ADMIN, UserRoleType.COORD_CIDADE, UserRoleType.TESOUREIRO, UserRoleType.COORD_ESTADO]
      },
      {
        name: 'Equipes Base',
        icon: Layers,
        path: '/equipes',
        roles: [UserRoleType.ADMIN, UserRoleType.COORD_CIDADE]
      },
      {
        name: 'Minha Equipe',
        icon: UserCheck,
        path: '/minha-equipe',
        roles: [UserRoleType.TESOUREIRO, UserRoleType.COORD_EQUIPE_BASE, UserRoleType.USUARIO]
      },
    ]
  },
  {
    label: "Gestão & Finanças",
    items: [
      {
        name: 'Relatórios',
        icon: FileText,
        path: '/relatorios',
        roles: [UserRoleType.ADMIN, UserRoleType.COORD_CIDADE, UserRoleType.COORD_ESTADO, UserRoleType.TESOUREIRO]
      },
      {
        name: 'Tesouraria Equipes',
        icon: DollarSign,
        path: '/financeiro',
        roles: [UserRoleType.ADMIN, UserRoleType.COORD_CIDADE, UserRoleType.COORD_ESTADO, UserRoleType.TESOUREIRO],
        checkSpecial: (user: UserType) => user.role !== UserRoleType.TESOUREIRO || !user.teamId
      },
      {
        name: 'Livro Caixa',
        icon: BookOpen,
        path: '/livro-caixa',
        roles: [UserRoleType.ADMIN, UserRoleType.COORD_CIDADE, UserRoleType.COORD_ESTADO, UserRoleType.TESOUREIRO],
        checkSpecial: (user: UserType) => user.role !== UserRoleType.TESOUREIRO || !user.teamId
      },
      {
        name: 'Lançamentos',
        icon: FileSpreadsheet,
        path: '/lancamentos',
        roles: [UserRoleType.ADMIN, UserRoleType.COORD_CIDADE, UserRoleType.COORD_ESTADO, UserRoleType.TESOUREIRO],
      },
      {
        name: 'Encontro de Noivos',
        icon: Heart,
        path: '/encontro-noivos',
        roles: [UserRoleType.ADMIN, UserRoleType.COORD_CIDADE, UserRoleType.COORD_ESTADO],
      },
      {
        name: 'Nucleação',
        icon: PhoneCall,
        path: '/nucleacao',
        roles: [UserRoleType.ADMIN, UserRoleType.COORD_CIDADE, UserRoleType.COORD_ESTADO],
      },
      {
        name: 'Histórias e Fotos',
        icon: Images,
        path: '/historias',
        roles: [UserRoleType.ADMIN, UserRoleType.COORD_CIDADE, UserRoleType.SEC_COM_CIDADE, UserRoleType.COORD_ESTADO, UserRoleType.SEC_COM_ESTADO],
      },
    ]
  },
  {
    label: "Config",
    items: [
      {
        name: 'Eventos',
        icon: Ticket,
        path: '/eventos',
      },
      {
        name: 'Usuários',
        icon: UserCog,
        path: '/usuarios',
        roles: [UserRoleType.ADMIN]
      },
      {
        name: 'Ajustes',
        icon: Settings,
        path: '/configuracoes',
        roles: [UserRoleType.ADMIN]
      },
    ]
  }
];

export function getVisibleItems(sections: NavSection[], user: UserType): NavItem[] {
  return sections.flatMap(section =>
    section.items.filter(item => {
      const hasRole = !item.roles || item.roles.includes(user.role);
      const passesSpecial = !item.checkSpecial || item.checkSpecial(user);
      return hasRole && passesSpecial;
    })
  );
}

export function getVisibleSections(sections: NavSection[], user: UserType): NavSection[] {
  return sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        const hasRole = !item.roles || item.roles.includes(user.role);
        const passesSpecial = !item.checkSpecial || item.checkSpecial(user);
        return hasRole && passesSpecial;
      })
    }))
    .filter(section => section.items.length > 0);
}
