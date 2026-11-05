import { User } from '@apolo-energies/auth';
import { getRoleLabel } from '../models/user-role';

const MS_ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

/**
 * Extrae los roles del usuario manejando `roles[]` estándar, el claim largo
 * de .NET (Microsoft WS-Federation) y un claim `role` singular numérico/string
 * (algunos tokens, como los de colaboradores de marca blanca, lo traen así).
 */
export function getUserRoles(user: User | null): string[] {
  if (!user) return [];

  if (Array.isArray(user.roles) && user.roles.length > 0) {
    return user.roles;
  }

  const claim = user[MS_ROLE_CLAIM];
  if (typeof claim === 'string') return [claim];
  if (Array.isArray(claim))     return claim as string[];

  const single = user['role'];
  if (typeof single === 'string' || typeof single === 'number') {
    return [getRoleLabel(single)];
  }

  return [];
}
