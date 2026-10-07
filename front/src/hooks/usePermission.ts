import { useEffect, useState } from 'react';
import { api } from '../../api';
import { ModuleAction, User as UserType } from '../../types';

interface RolePermissions {
  [moduleId: string]: {
    [action in ModuleAction]?: boolean;
  };
}

interface RoleDefinition {
  id: string;
  name: string;
  isSystem?: boolean;
  permissions: RolePermissions;
}

let cachedRoles: RoleDefinition[] | null = null;
let cachedRolesPromise: Promise<RoleDefinition[]> | null = null;

function fetchRoles(): Promise<RoleDefinition[]> {
  if (cachedRoles) return Promise.resolve(cachedRoles);
  if (!cachedRolesPromise) {
    cachedRolesPromise = api.getRoles()
      .then((roles: RoleDefinition[]) => {
        cachedRoles = roles;
        return roles;
      })
      .catch(() => {
        cachedRoles = [];
        return [];
      });
  }
  return cachedRolesPromise;
}

/** Invalida o cache de perfis — chamar após criar/editar/excluir um perfil em Ajustes. */
export function invalidateRolesCache() {
  cachedRoles = null;
  cachedRolesPromise = null;
}

function getStoredUser(): UserType | null {
  const stored = localStorage.getItem('mfc.currentUser');
  if (!stored) return null;
  try {
    return JSON.parse(stored) as UserType;
  } catch {
    return null;
  }
}

/**
 * Verifica se o usuário logado pode executar `action` no módulo `moduleId`,
 * consultando a matriz de permissões configurada em Ajustes > Perfis.
 *
 * O vínculo entre o usuário e o perfil é feito por nome idêntico (não há FK
 * entre `users.role` e a tabela `roles` hoje). Se nenhum perfil com nome igual
 * à role do usuário for encontrado, o acesso é negado por padrão.
 *
 * Lê o usuário logado do localStorage (não há Context de usuário no projeto).
 */
export function usePermission(moduleId: string, action: ModuleAction): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const currentUser = getStoredUser();
    if (!currentUser) {
      setAllowed(false);
      return;
    }

    let active = true;
    fetchRoles().then((roles) => {
      if (!active) return;
      const role = roles.find(r => r.name === currentUser.role);
      // Perfil de sistema (ex: Administrador) tem acesso total, independente
      // de o módulo já ter sido configurado na matriz ou não.
      if (role?.isSystem) {
        setAllowed(true);
        return;
      }
      setAllowed(!!role?.permissions?.[moduleId]?.[action]);
    });

    return () => { active = false; };
  }, [moduleId, action]);

  return allowed;
}
