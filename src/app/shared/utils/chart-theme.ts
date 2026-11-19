/**
 * Colores de gráficos por tema. Paleta categórica validada:
 * - blanco (sobre #fcfcfb/#ffffff): todas las comprobaciones PASS; 3 tonos < 3:1 → los
 *   gráficos llevan leyenda o etiquetas (regla de alivio);
 * - negro (sobre #17181A): todas PASS y las 8 ≥ 3:1.
 * El orden de los colores es el mecanismo de seguridad para daltonismo: asignar por
 * orden fijo, sin ciclar.
 */
export interface ChartTheme {
  series: string[];
  /** Barra principal y barra seleccionada. */
  bar: string;
  barActive: string;
  axis: string;
  grid: string;
  /** Fondo del gráfico: separador entre sectores del donut. */
  surface: string;
}

const LIGHT: ChartTheme = {
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  bar: '#2a78d6',
  barActive: '#eb6834',
  axis: '#5f6368',
  grid: '#e6e8eb',
  surface: '#ffffff',
};

const DARK: ChartTheme = {
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'],
  bar: '#3987e5',
  barActive: '#d95926',
  axis: '#a1a1aa',
  grid: 'rgba(255, 255, 255, 0.08)',
  surface: '#17181A',
};

export function chartTheme(dark: boolean): ChartTheme {
  return dark ? DARK : LIGHT;
}

/** Letra legible (blanca o casi negra) sobre un color de serie: la de mayor contraste WCAG. */
export function textOn(hex: string): string {
  const c = hex.replace('#', '');
  const lin = (i: number) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  const vsWhite = 1.05 / (L + 0.05);
  const vsDark = (L + 0.05) / (0.0058 + 0.05); // #111111
  return vsWhite >= vsDark ? '#ffffff' : '#111111';
}
