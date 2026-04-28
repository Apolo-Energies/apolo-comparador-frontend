export enum UserRole {
  MASTER                = 1,
  COLLABORATOR          = 2,
  REFERRER              = 4,
  TESTER                = 8,
  COLLABORATOR_REFERRER = 6,
}

export const UserRoleLabel: Record<number, string> = {
  [UserRole.MASTER]:                'Master',
  [UserRole.COLLABORATOR]:          'Colaborador',
  [UserRole.REFERRER]:              'Referenciador',
  [UserRole.TESTER]:                'Tester',
  [UserRole.COLLABORATOR_REFERRER]: 'Colaborador - Referenciador',
};

const roleLabelToId: Record<string, number> = {
  ...Object.fromEntries(Object.entries(UserRoleLabel).map(([id, label]) => [label.toLowerCase(), Number(id)])),
  'master':                UserRole.MASTER,
  'collaborator':          UserRole.COLLABORATOR,
  'referrer':              UserRole.REFERRER,
  'tester':                UserRole.TESTER,
  'collaboratorreferrer':  UserRole.COLLABORATOR_REFERRER,
  'collaborator_referrer': UserRole.COLLABORATOR_REFERRER,
};

export function getRoleLabel(role: string | number): string {
  return UserRoleLabel[Number(role)] ?? String(role);
}

export function normalizeRoleToOptionValue(role: string | number): string {
  const num = Number(role);
  if (!isNaN(num) && UserRoleLabel[num] !== undefined) return String(num);
  const found = roleLabelToId[String(role).toLowerCase()];
  return found !== undefined ? String(found) : '';
}
