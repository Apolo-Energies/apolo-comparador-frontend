/**
 * Migas de pan del portal: "Inicio › Alta rápida › Luz › Datos del cliente".
 * Dicen dónde está el usuario y dejan volver a cualquier paso anterior. Solo presentación:
 * se calculan a partir de la URL, sin tocar rutas ni guards.
 */
export interface Crumb {
  label: string;
  /** Sin url = la página actual (último elemento) o un nivel que no es una página propia. */
  url?: string;
  queryParams?: Record<string, string>;
}

const ALTA = '/dashboard/fast-discharge/select-type';
const COMPARADOR = '/dashboard/comparador';

const ALTA_STEPS: Record<string, string> = {
  data: 'Datos del cliente',
  'supply-point': 'Punto de suministro',
  'select-product': 'Producto',
  documents: 'Documentos',
  review: 'Revisión',
  signature: 'Firma',
};

const GAS_ADMIN: Record<string, string> = {
  'ocr-test': 'Prueba de OCR',
  'access-tariffs': 'Tarifas de acceso',
  'regulatory-params': 'Parámetros regulados',
  products: 'Productos',
  'quixotic-contracts': 'Contratos Quixotic',
};

/** Ruta → niveles por debajo de "Inicio". `ownUserId` distingue "Cuenta" de un usuario ajeno. */
export function buildCrumbs(url: string, ownUserId: string | null, hasChooser: boolean): Crumb[] {
  const [path, query = ''] = url.split('?');
  const q = new URLSearchParams(query);
  const p = path.replace(/\/+$/, '');
  const seg = p.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean);
  const cmp: Crumb = hasChooser ? { label: 'Comparador', url: COMPARADOR } : { label: 'Comparador' };
  const sips: Crumb = hasChooser ? { label: 'Consulta SIPS', url: COMPARADOR, queryParams: { herramienta: 'sips' } } : { label: 'Consulta SIPS' };

  switch (seg[0]) {
    case undefined:
    case 'inicio': return [];
    case 'resumen': return [{ label: 'Resumen' }];
    case 'markets': return [{ label: 'Mercado' }];
    case 'my-clients': return [{ label: 'Mis clientes' }];
    case 'contratos': return [{ label: 'Contratos' }];
    case 'support': {
      const sec: Record<string, string> = { ticket: 'Abrir ticket', chatbot: 'Chatbot', videos: 'Vídeos de soporte' };
      const s = sec[q.get('seccion') ?? ''];
      return s ? [{ label: 'Soporte', url: '/dashboard/support' }, { label: s }] : [{ label: 'Soporte' }];
    }

    case 'comparador':
      return q.get('herramienta') === 'sips'
        ? [{ label: 'Comparador', url: COMPARADOR }, { label: 'Consulta SIPS' }]
        : [{ label: 'Comparador' }];
    case 'comparator':
      return [cmp, { label: seg[1] === 'gas' ? 'Gas' : 'Luz' }];
    case 'comparator-multiple':
      return [cmp, { label: 'Comparativas múltiples' }];
    case 'sips':
      return [cmp, sips, { label: seg[1] === 'gas' ? 'Gas' : 'Luz' }];

    case 'fast-discharge':
    case 'altaRapida': {
      if (!seg[1] || seg[1] === 'select-type') return [{ label: 'Alta rápida' }];
      return [{ label: 'Alta rápida', url: ALTA }, { label: 'Luz' }, { label: ALTA_STEPS[seg[1]] ?? 'Alta' }];
    }

    case 'gas': {
      if (seg[1] === 'quixotic-contracts' && seg[2] === 'new') return [{ label: 'Alta rápida', url: ALTA }, { label: 'Gas' }];
      return [{ label: 'Gas' }, { label: GAS_ADMIN[seg[1] ?? ''] ?? 'Gas' }];
    }

    case 'analytics': {
      const names: Record<string, string> = { history: 'Historial', statistics: 'Estadísticas', reports: 'Reportes' };
      if (seg[1] === 'opportunities') {
        if (!seg[2]) return [{ label: 'Oportunidades' }];
        return [{ label: 'Oportunidades', url: '/dashboard/analytics/opportunities' }, { label: seg[2] === 'gas' ? 'Gas' : 'Luz' }];
      }
      const n = names[seg[1] ?? ''];
      if (!n) return [{ label: 'Analítica' }];
      return seg[2] === 'gas' ? [{ label: 'Analítica' }, { label: n, url: `/dashboard/analytics/${seg[1]}` }, { label: 'Gas' }] : [{ label: 'Analítica' }, { label: n }];
    }

    case 'settings': {
      if (seg[1] === 'users' && seg[2]) {
        const own = !!ownUserId && seg[2] === ownUserId;
        if (own) {
          const sec = q.get('seccion') === 'documentacion' ? 'Documentación' : 'Datos';
          return [{ label: 'Cuenta', url: p }, { label: sec }];
        }
        return [{ label: 'Usuarios', url: '/dashboard/settings/users' }, { label: 'Detalle de usuario' }];
      }
      if (seg[1] === 'users') return [{ label: 'Usuarios' }];
      if (seg[1] === 'commission') return [{ label: 'Comisiones' }];
      const own = ownUserId ? `/dashboard/settings/users/${ownUserId}` : undefined;
      if (seg[1] === 'my-comercials') return [{ label: 'Cuenta', url: own }, { label: 'Comerciales' }];
      if (seg[1] === 'sub-user-commissions') return [{ label: 'Cuenta', url: own }, { label: 'Comisiones' }];
      return [{ label: 'Ajustes' }];
    }

    case 'tariffs': return [{ label: 'Tarifas' }];
    case 'templates': return [{ label: 'Plantillas' }];
    case 'landings': return [{ label: 'Landings' }];
    case 'brands': return seg[1] ? [{ label: 'Marcas blancas', url: '/dashboard/brands' }, { label: 'Detalle' }] : [{ label: 'Marcas blancas' }];
    case 'energies': return [{ label: 'Facturación' }];
    case 'forbidden': return [{ label: 'Sin acceso' }];
    default: return [];
  }
}
