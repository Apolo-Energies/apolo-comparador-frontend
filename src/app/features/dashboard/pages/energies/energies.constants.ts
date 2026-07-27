/**
 * Paleta pastel coordinada extraída del kit "Sigma - Dark Multipurpose CRM".
 * Violet primary + pink secondary + sky tertiary — familia coordinada, no semántica.
 * Los colores agresivos (rojo saturado) están fuera; Sigma es un lenguaje suave.
 */
export const STATUS_COLORS: Record<string, string> = {
  Activos:      '#B098F8', // violet-400 — dominante, estado positivo
  Bajas:        '#F5A5C0', // pink-300  — pérdida
  Ko:           '#3F3F46', // zinc-700  — muerto/lost
  'P.Firma':    '#F7C77E', // amber-300 — acción pendiente
  'P.Tramitar': '#7EC4E8', // sky-400   — en progreso
  Estudios:     '#C6B8FC', // light-violet — exploratorio
  Desestimado:  '#71717A', // zinc-500  — rechazado neutral
  Ofertados:    '#FB923C', // orange-400 — propuesto
};

export const DEFAULT_STATUS_COLOR = '#6B7280'; // gray-500

// ── Tokens de estilo compartidos por Chart.js ─────────────────────────────
export const CHART_FONT_FAMILY   = '"Space Grotesk", system-ui, sans-serif';
export const CHART_TEXT_MUTED    = '#A1A1AA';
export const CHART_TEXT_FG       = '#FAFAFA';
export const CHART_GRID          = 'rgba(255,255,255,0.06)';
export const CHART_SURFACE       = '#17181A';
export const CHART_BORDER_SUBTLE = 'rgba(255,255,255,0.12)';

// Series colors del bar chart — familia pastel Sigma
export const SERIES_ALTAS              = '#B098F8'; // violet — crecimiento
export const SERIES_BAJAS              = '#F5A5C0'; // pink   — pérdida
export const SERIES_RENOVACIONES       = '#7EC4E8'; // sky    — continuidad
export const SERIES_ALTAS_HOVER        = '#C6B8FC'; // light violet
export const SERIES_BAJAS_HOVER        = '#F7C6D8'; // light pink
export const SERIES_RENOVACIONES_HOVER = '#A5D6ED'; // light sky
