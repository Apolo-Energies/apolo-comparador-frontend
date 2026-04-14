import { User } from '@apolo-energies/auth';

const MS_ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

/**
 * Extrae los roles del usuario manejando tanto `roles[]` estándar
 * como el claim largo de .NET (Microsoft WS-Federation).
 */
export function getUserRoles(user: User | null): string[] {
  if (!user) return [];

  if (Array.isArray(user.roles) && user.roles.length > 0) {
    return user.roles;
  }

  const claim = user[MS_ROLE_CLAIM];
  if (typeof claim === 'string') return [claim];
  if (Array.isArray(claim))     return claim as string[];

  return [];
}
