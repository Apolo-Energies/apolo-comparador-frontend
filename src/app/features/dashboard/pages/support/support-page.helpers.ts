import { LucideIconData, Users, FileText, MapPin, SlidersHorizontal } from 'lucide-angular';

export interface CrmVideo {
  title:       string;
  description: string;
  url:         string;
}

export interface SupportFaq {
  question: string;
  answer:   string;
}

export interface SupportTopic {
  /** Id estable para el switch Inicio/CRM/Tarifas Luz/Tarifas Gas/Comparador. */
  key:           string;
  title:         string;
  /** Etiqueta corta del switch (ej. "Tarifas Luz" en vez de "Tarifas De Luz"). */
  switchLabel:   string;
  tag:           string;
  icon:          LucideIconData;
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
    key:         'crm',
    title:       'CRM',
    switchLabel: 'CRM',
    tag:         'Aprende a usar el CRM y todo su potencial',
    icon:        Users,
    videos:      CRM_VIDEOS,
  },
  {
    key:          'luz',
    title:        'Tarifas De Luz',
    switchLabel:  'Tarifas Luz',
    tag:          'Guía de tarifas eléctricas',
    icon:         FileText,
    excelPreview: true,
  },
  {
    key:         'gas',
    title:       'Tarifas De Gas',
    switchLabel: 'Tarifas Gas',
    tag:         'Guía de tarifas de gas',
    icon:        MapPin,
    // Pendiente: sin exportador Excel de gas en el backend todavía (a diferencia de
    // Luz, que sí lo tiene vía TariffPreviewController). Mientras no exista, se queda
    // con video — el día que el backend lo agregue, cambiar a excelPreview: true y
    // este tema pasa automáticamente al mismo visor de documento que Luz.
    videos: [
      {
        title:       'Tarifas De Gas',
        description: 'Guía de tarifas de gas.',
        url:         'https://www.youtube.com/embed/',
      },
    ],
  },
  {
    key:         'comparador',
    title:       'Comparador',
    switchLabel: 'Comparador',
    tag:         'Cómo usar el comparador',
    icon:        SlidersHorizontal,
    videos: [
      {
        title:       'Comparador',
        description: 'Cómo usar el comparador.',
        url:         'https://www.youtube.com/embed/',
      },
    ],
  },
];

export const SUPPORT_FAQS: SupportFaq[] = [
  {
    question: '¿Cómo puedo sacarle el máximo partido al CRM?',
    answer:   'El CRM te permite gestionar leads, clientes y oportunidades en un solo lugar. Empieza por la lección de Presentación e inicio y sigue la lista de reproducción (6 vídeos).',
  },
  {
    question: '¿Qué es la tarifa 3.0TD y a quién aplica?',
    answer:   'La 3.0TD aplica a consumidores con potencia contratada superior a 15 kW (hasta 450 kW) — normalmente negocios y grandes consumidores. A diferencia de la 2.0TD, reparte el consumo y la potencia en 6 periodos (P1-P6) en vez de 3, con un precio distinto en cada uno.',
  },
  {
    question: '¿Cómo funciona el comparador de tarifas?',
    answer:   'Subes la factura del cliente (o completas los datos a mano), el sistema extrae el consumo por OCR y calcula el ahorro estimado comparando contra las tarifas disponibles. Desde ahí puedes descargar el PDF de la comparativa o pasar directo a la solicitud de alta.',
  },
  {
    question: '¿Cómo se calculan las comisiones por venta?',
    answer:   'Depende del producto: la mayoría de tarifas pagan un porcentaje configurado en tu perfil (o el de tu comercial superior si eres sub-usuario), calculado sobre el consumo anual estimado. Algunos productos de precio fijo (como Snap o Vibra) pagan un importe fijo en euros en vez de un porcentaje.',
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
