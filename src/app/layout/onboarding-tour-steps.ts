import { TourStep } from '../shared/components/onboarding-tour/onboarding-tour.model';

export interface OnboardingTourFlags {
  hasQuickAction: boolean;
}

const sidebarLink = (url: string): TourStep['selector'] => `a[href="${url}"]`;
const sidebarGroup = (title: string): TourStep['textMatch'] => ({ tag: 'lib-sidebar-item', text: title });

/**
 * Pasos del tour para el shell del dashboard. Cubre cada ítem del menú —
 * el service se encarga de saltar automáticamente los que no existan para
 * el rol/tenant del usuario actual (no hace falta duplicar esa lógica acá).
 */
export function buildOnboardingTourSteps(flags: OnboardingTourFlags): TourStep[] {
  const steps: TourStep[] = [
    {
      selector: 'lib-apolo-sidebar',
      title: 'Tu menú de navegación',
      description: 'Aquí encontrarás todas las secciones disponibles. Te las mostramos una por una.',
    },
  ];

  if (flags.hasQuickAction) {
    steps.push({
      selector: 'a[href="/dashboard/fast-discharge/select-type"]',
      title: 'Alta rápida',
      description: 'Desde aquí das de alta a un cliente nuevo en pocos pasos, para luz o gas.',
    });
  }

  steps.push(
    {
      selector: sidebarLink('/dashboard/energies/invoices'),
      title: 'Facturación',
      description: 'Consulta la facturación y las comisiones generadas.',
    },
    {
      selector: sidebarLink('/dashboard/markets'),
      title: 'Mercados',
      description: 'Revisa indicadores y precios del mercado energético en tiempo real.',
    },
    {
      selector: sidebarLink('/dashboard/collaborator-scope'),
      title: 'Colaborador',
      description: 'Entra a la vista de un colaborador en concreto: su historial y sus estadísticas.',
    },
    {
      textMatch: sidebarGroup('Analítica'),
      title: 'Analítica',
      description: 'Consulta el historial de comparativas, tus estadísticas y reportes de actividad.',
    },
    {
      textMatch: sidebarGroup('Contratos'),
      title: 'Contratos',
      description: 'Gestiona los contratos de luz y gas que ya se firmaron.',
    },
    {
      textMatch: sidebarGroup('Oportunidades'),
      title: 'Oportunidades',
      description: 'Revisa oportunidades de negocio detectadas automáticamente, de luz y de gas.',
    },
    {
      textMatch: sidebarGroup('Comparador'),
      title: 'Comparador',
      description: 'Compara ofertas de luz y gas subiendo la factura del cliente.',
    },
    {
      selector: sidebarLink('/dashboard/my-clients'),
      title: 'Mis clientes',
      description: 'Consulta y gestiona la cartera de clientes que tienes asignados.',
    },
    {
      textMatch: sidebarGroup('Consultas SIPS'),
      title: 'Consultas SIPS',
      description: 'Consulta los datos de suministro (SIPS) de un CUPS, de luz o de gas.',
    },
    {
      textMatch: sidebarGroup('Ajustes'),
      title: 'Ajustes',
      description: 'Administra usuarios, comisiones, tarifas y otras configuraciones.',
    },
    {
      selector: sidebarLink('/dashboard/support'),
      title: 'Soporte',
      description: 'Encuentra ayuda y soporte si lo necesitas.',
    },
  );

  steps.push({
    selector: 'lib-user-menu',
    title: 'Tu perfil',
    description: 'Desde aquí accedes a tu perfil, puedes volver a ver este tour y cerrar sesión.',
  });

  return steps;
}

export function tourSeenKey(userId: string): string {
  return `apolo-tour-seen-${userId}`;
}

export const TOUR_MENU_ITEM_ID = 'tour';
