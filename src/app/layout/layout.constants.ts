/**
 * Role → permission-key mapping used by `hasAccess` (see layout.helpers.ts)
 * to resolve the sidebar `accessFn`. Extracted from Layout to keep it under
 * the file-size guideline (R1) — same keys, same values, no behavior change.
 */
export const COLABORADOR_PERMISSIONS = [
  'comparator:view',
  'sips:view',
  'markets:view',
  'contratos:view',
  'clients:view',
  'settings:view',
  'settings.colaborador:view',
  'opportunities:view',
  'analytics:view',
  'analytics.history:view',
  'analytics.statistics:view',
  'support:view',
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  'Colaborador':                 COLABORADOR_PERMISSIONS,
  'Colaborador - Referenciador': COLABORADOR_PERMISSIONS,
  'Referenciador': ['comparator:view', 'sips:view', 'markets:view'],
  'Tester':        ['comparator:view', 'sips:view', 'markets:view'],
  'Comercial':     ['comparator:view', 'clients:view'],
};
