export interface CrmVideo {
  title:       string;
  description: string;
  url:         string;
}

export interface SupportTopic {
  title:         string;
  tag:           string;
  tagCls:        string;
  dotCls:        string;
  available:     boolean;
  videos?:       CrmVideo[];
  excelPreview?: true;
}

export const CRM_VIDEOS: CrmVideo[] = [
  {
    title:       'Presentación e inicio',
    description: 'Introducción al CRM de Apolo Energies: primeros pasos y navegación general.',
    url:         'https://www.youtube.com/embed/Mh1siN7Im2E',
  },
  {
    title:       'Autofactura',
    description: 'Aprende a gestionar el módulo de autofactura dentro del CRM.',
    url:         'https://www.youtube.com/embed/Kut9_pvgjQA',
  },
  {
    title:       'Carga Rápida',
    description: 'Cómo utilizar la función de carga rápida para agilizar el alta de nuevos clientes.',
    url:         'https://www.youtube.com/embed/HrmmFwVe4zk',
  },
  {
    title:       'Contratos',
    description: 'Gestión y seguimiento de contratos desde el CRM.',
    url:         'https://www.youtube.com/embed/2JYBpzvodJ0',
  },
  {
    title:       'Delegación',
    description: 'Cómo funciona el módulo de delegación y asignación de clientes.',
    url:         'https://www.youtube.com/embed/jRrH7MmV6zY',
  },
  {
    title:       'Facturas',
    description: 'Consulta y gestión de facturas desde el panel del CRM.',
    url:         'https://www.youtube.com/embed/X_Czq_GzT-k',
  },
];

export const SUPPORT_TOPICS: SupportTopic[] = [
  {
    title:     'CRM',
    tag:       'Aprende a usar el CRM y todo su potencial',
    tagCls:    'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20',
    dotCls:    'bg-blue-400',
    available: true,
    videos:    CRM_VIDEOS,
  },
  {
    title:        'Tarifas De Luz',
    tag:          'Guía de tarifas eléctricas',
    tagCls:       'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/20',
    dotCls:       'bg-indigo-400',
    available:    true,
    excelPreview: true,
  },
  {
    title:     'Tarifas De Gas',
    tag:       'Guía de tarifas de gas',
    tagCls:    'bg-pink-500/15 text-pink-400 ring-1 ring-pink-500/20',
    dotCls:    'bg-pink-400',
    available: true,
    videos: [
      {
        title:       'Tarifas De Gas',
        description: 'Guía de tarifas de gas.',
        url:         'https://www.youtube.com/embed/',
      },
    ],
  },
  {
    title:     'Comparador',
    tag:       'Cómo usar el comparador',
    tagCls:    'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/20',
    dotCls:    'bg-purple-400',
    available: true,
    videos: [
      {
        title:       'Comparador',
        description: 'Cómo usar el comparador.',
        url:         'https://www.youtube.com/embed/',
      },
    ],
  },
  {
    title:     'Proceso de Firma',
    tag:       'Próximamente',
    tagCls:    'bg-muted text-muted-foreground ring-1 ring-border',
    dotCls:    'bg-muted-foreground',
    available: false,
  },
  {
    title:     'Postventa y Soporte',
    tag:       'Próximamente',
    tagCls:    'bg-muted text-muted-foreground ring-1 ring-border',
    dotCls:    'bg-muted-foreground',
    available: false,
  },
  {
    title:     'Comunidad Apolo',
    tag:       'Próximamente',
    tagCls:    'bg-muted text-muted-foreground ring-1 ring-border',
    dotCls:    'bg-muted-foreground',
    available: false,
  },
];

export const WHATSAPP_NUMBERS: Record<string, string> = {
  renova:  'PENDIENTE_RENOVAE',
  coexpal: 'PENDIENTE_COEXPAL',
};

export const TARIFF_PROVIDER_ID = 1;

/** Builds a YouTube thumbnail URL from an embed URL. */
export function youtubeThumbnail(url: string): string {
  const id = url.split('/').pop()?.split('?')[0] ?? '';
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}
