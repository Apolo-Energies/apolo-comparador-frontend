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

export function getRoleLabel(role: string | number): string {
  return UserRoleLabel[Number(role)] ?? String(role);
}
