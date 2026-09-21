import { SidebarChildItem, SidebarSection } from '@apolo-energies/sidebar';
import { ArrowDownBoxIcon, CompassIcon, NoteIcon, PieIcon, SettingsIcon, StarIcon, SupportIcon, UserCircleIcon, UserIcon } from '@apolo-energies/icons';
import { environment } from '../../environments/environment';
import { ROLE_PERMISSIONS } from './layout.constants';

/**
 * Resolves the sidebar `accessFn`: whether the current user's roles grant
 * any of the given permission keys. Extracted from Layout to keep it under
 * the file-size guideline (R1) — same rules, no behavior change.
 */
export function hasAccess(access: string[] | undefined, roles: string[]): boolean {
  if (!access || access.length === 0) return true;
  if (roles.includes('Master')) return true;
  const granted = roles.flatMap(r => ROLE_PERMISSIONS[r] ?? []);
  const isComercial = roles.includes('Comercial');
  const effective = isComercial ? [...granted, 'sips:view', 'markets:view'] : granted;
  return access.some(key => effective.includes(key));
}

export interface BuildSidebarSectionsParams {
  /** Roles of the current user (see getUserRoles). */
  roles: string[];
  /** environment.features.userDetail — true only for the Apolo tenant. */
  isApolo: boolean;
  userId: string | null;
  isSubUser: boolean;
}

/**
 * Builds the sidebar sections/items for Layout, gated by tenant
 * (Apolo vs. Coexpal/Renova) and role (Colaborador vs. the rest).
 * Extracted from Layout to keep it under the file-size guideline (R1) —
 * copied as-is, same conditionals, same order, no behavior change.
 */
export function buildSidebarSections(params: BuildSidebarSectionsParams): SidebarSection[] {
  const { roles, isApolo, userId, isSubUser } = params;
  const isColaborador = (roles.includes('Colaborador') || roles.includes('Colaborador - Referenciador')) && !roles.includes('Master');

  const ajustesChildren: SidebarChildItem[] = isColaborador && isApolo
    ? [
        { title: 'Comerciales', url: '/dashboard/settings/my-comercials',       access: ['settings.colaborador:view'] },
        { title: 'Comisiones',  url: '/dashboard/settings/sub-user-commissions', access: ['settings.colaborador:view'] },
      ]
    : [
        { title: 'Usuarios',   url: '/dashboard/settings/users',      access: ['settings.users:view'] },
        { title: 'Comisión',   url: '/dashboard/settings/commission', access: ['settings.commission:view'] },
        // Plantillas es de contratos (feature exclusiva de Apolo — Coexpal/Renovae no la usan).
        ...(environment.features.contracts ? [
          { title: 'Plantillas', url: '/dashboard/templates', access: ['templates:view'] },
        ] : []),
        { title: 'Tarifas',    url: '/dashboard/tariffs',             access: ['support:view'] },
        // Landings y Gas regulatorio son exclusivos de Apolo (Coexpal/Renovae solo usan Luz) y
        // Master-only dentro de Apolo; comparten analytics:view con Analítica pero no deben
        // aparecerle al Colaborador (defensa en profundidad para el edge case Colaborador en
        // whitelabel no-Apolo, donde el ternario externo no lo excluye).
        ...(isApolo && !isColaborador ? [
          { title: 'Landings',         url: '/dashboard/landings',              access: ['analytics:view'] },
          { title: 'Gas · Tramos',     url: '/dashboard/gas/access-tariffs',    access: ['analytics:view'] },
          { title: 'Gas · Parámetros', url: '/dashboard/gas/regulatory-params', access: ['analytics:view'] },
          { title: 'Gas · Productos',  url: '/dashboard/gas/products',          access: ['analytics:view'] },
        ] : []),
      ];

  const sections: SidebarSection[] = [
    // APOLO ENERGIES > Facturación es Master-only (comparte analytics:view con Analítica).
    ...(isApolo && !isColaborador ? [{
      section: 'APOLO ENERGIES',
      items: [
        {
          title: 'Facturación',
          icon: { type: 'apolo' as const, icon: NoteIcon, size: 20 },
          url: '/dashboard/energies/invoices',
          access: ['analytics:view'],
        },
         ...(environment.features.markets ? [{
          title: 'Mercados',
          icon: { type: 'apolo' as const, icon: PieIcon, size: 20 },
          url: '/dashboard/markets',
          access: ['markets:view'],
        }] : []),
        // Abre el modal "ver como colaborador" (Historial/Estadística) — no navega,
        // ver openCollaboratorDialogGuard.
        {
          title: 'Colaborador',
          icon: { type: 'apolo' as const, icon: UserCircleIcon, size: 20 },
          url: '/dashboard/collaborator-scope',
          access: ['analytics:view'],
        },
      ],
    }] : []),
    {
      section: 'GENERAL',
      items: [
        {
          title: 'Analítica',
          icon: { type: 'apolo', icon: PieIcon, size: 20 },
          access: ['analytics:view'],
          children: [
            { title: 'Historial · Luz',    url: '/dashboard/analytics/history',        access: ['analytics.history:view'] },
            // Gas de analítica es exclusivo de Apolo (Coexpal/Renovae solo usan Luz) y aún no
            // disponible para Colaboradores dentro de Apolo.
            ...(isApolo && !isColaborador ? [
              { title: 'Historial · Gas',    url: '/dashboard/analytics/history/gas',    access: ['analytics.history:view'] },
            ] : []),
            { title: 'Estadísticas · Luz', url: '/dashboard/analytics/statistics',     access: ['analytics.statistics:view'] },
            ...(isApolo && !isColaborador ? [
              { title: 'Estadísticas · Gas', url: '/dashboard/analytics/statistics/gas', access: ['analytics.statistics:view'] },
            ] : []),
            { title: 'Reportes · Luz',     url: '/dashboard/analytics/reports',        access: ['analytics.statistics:view'] },
            ...(isApolo && !isColaborador ? [
              { title: 'Reportes · Gas',     url: '/dashboard/analytics/reports/gas',    access: ['analytics.statistics:view'] },
            ] : []),
          ],
        },
        ...(isApolo && environment.features.contracts ? [{
          title: 'Contratos',
          icon: { type: 'apolo' as const, icon: NoteIcon, size: 20 },
          access: ['contratos:view'],
          children: [
            { title: 'Luz', url: '/dashboard/contratos/contratos', access: ['contratos:view'] },
            // Gas de contratos (Quixotic) todavía no disponible para Colaboradores.
            ...(isColaborador ? [] : [
              { title: 'Gas', url: '/dashboard/gas/quixotic-contracts', access: ['contratos:view'] },
            ]),
          ],
        }] : []),
        ...(environment.features.opportunities ? [{
          title: 'Oportunidades',
          icon: { type: 'apolo' as const, icon: StarIcon, size: 20 },
          access: ['opportunities:view'],
          children: [
            { title: 'Luz', url: '/dashboard/analytics/opportunities/luz', access: ['opportunities:view'] },
            // Gas de oportunidades aún no disponible para Colaboradores.
            ...(isColaborador ? [] : [
              { title: 'Gas', url: '/dashboard/analytics/opportunities/gas', access: ['opportunities:view'] },
            ]),
          ],
        }] : []),
        {
          title: 'Comparador',
          icon: { type: 'apolo', icon: ArrowDownBoxIcon, size: 20 },
          access: ['comparator:view'],
          children: [
            { title: 'Luz', url: '/dashboard/comparator', access: ['comparator:view'] },
            // Comparador de Gas es exclusivo de Apolo — Coexpal/Renovae solo usan Luz.
            ...(isApolo ? [
              { title: 'Gas', url: '/dashboard/comparator/gas', access: ['comparator:view'] },
            ] : []),
          ],
        },
        ...(environment.features.myClients ? [{
          title: 'Mis clientes',
          icon: { type: 'apolo' as const, icon: UserCircleIcon, size: 20 },
          url: '/dashboard/my-clients',
          access: ['clients:view'],
        }] : []),
        {
          title: 'Consultas SIPS',
          icon: { type: 'apolo', icon: CompassIcon, size: 20 },
          access: ['sips:view'],
          children: [
            { title: 'Luz', url: '/dashboard/sips', access: ['sips:view'] },
            // Consultas SIPS de Gas es exclusivo de Apolo — Coexpal/Renovae solo usan Luz.
            ...(isApolo ? [
              { title: 'Gas', url: '/dashboard/sips/gas', access: ['sips:view'] },
            ] : []),
          ],
        },
      ],
    },
    {
      section: 'SOPORTE',
      items: [
        {
          title: 'Ajustes',
          icon: { type: 'apolo', icon: SettingsIcon, size: 20 },
          access: ['settings:view'],
          children: ajustesChildren,
        },
        // "Soporte" para Colaborador es exclusivo de Apolo — en otros tenants (coexpal/renova/prod)
        // no debe aparecerle, aunque COLABORADOR_PERMISSIONS (compartido entre ambientes) lo incluya.
        ...(isColaborador && !isApolo ? [] : [{
          title: 'Soporte',
          icon: { type: 'apolo' as const, icon: SupportIcon, size: 20 },
          url: '/dashboard/support',
          access: ['support:view'],
        }]),
      ],
    },
  ];

  if (isApolo && userId && !isSubUser) {
    sections.push({
      section: '',
      items: [{
        title: 'Mi Perfil',
        icon: { type: 'apolo', icon: UserIcon, size: 20 },
        url: `/dashboard/settings/users/${userId}`,
      }],
    });
  } else if (!isApolo) {
    // Merge SOPORTE items into GENERAL so the sidebar library doesn't pin SOPORTE to the bottom
    const soporteIdx = sections.findIndex(s => s.section === 'SOPORTE');
    if (soporteIdx >= 0) {
      sections[0].items = [...sections[0].items, ...sections[soporteIdx].items];
      sections.splice(soporteIdx, 1);
    }
  }

  return sections;
}
