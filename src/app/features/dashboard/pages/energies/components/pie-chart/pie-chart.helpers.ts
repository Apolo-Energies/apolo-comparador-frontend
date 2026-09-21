import type { ChartOptions, Plugin } from 'chart.js';
import { PieBreakdown } from '../../../../../../core/services/energy-expert.service';
import {
  CHART_BORDER_SUBTLE,
  CHART_FONT_FAMILY,
  CHART_SURFACE,
  CHART_TEXT_FG,
  CHART_TEXT_MUTED,
  DEFAULT_STATUS_COLOR,
  STATUS_COLORS,
} from '../../energies.constants';

/** Item pre-computado para la leyenda HTML. */
export interface LegendItem {
  label:   string;
  value:   number;
  color:   string;
  /** Ya formateado como "39,7%" para renderizar directo. */
  percent: string;
}

/**
 * Plugin: dibuja "TOTAL" + valor grande en el centro del doughnut.
 * Configurable por chart via options.plugins.doughnutCenter = { total, unit }.
 */
export const doughnutCenterPlugin: Plugin<'doughnut'> = {
  id: 'doughnutCenter',
  afterDraw(chart) {
    const opts = (chart.options.plugins as unknown as { doughnutCenter?: { total: number; unit?: string } })
      ?.doughnutCenter;
    if (!opts) return;

    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top  + chartArea.bottom) / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `600 9px ${CHART_FONT_FAMILY}`;
    ctx.fillStyle = CHART_TEXT_MUTED;
    ctx.fillText('TOTAL', cx, cy - 18);

    const formatted = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(opts.total);
    ctx.font = `600 24px ${CHART_FONT_FAMILY}`;
    ctx.fillStyle = CHART_TEXT_FG;
    ctx.fillText(formatted, cx, cy + 4);

    if (opts.unit) {
      ctx.font = `500 10px ${CHART_FONT_FAMILY}`;
      ctx.fillStyle = CHART_TEXT_MUTED;
      ctx.fillText(opts.unit, cx, cy + 22);
    }

    ctx.restore();
  },
};

/** Items pre-calculados (color, % ya formateado) para la leyenda HTML del gráfico. */
export function buildLegendItems(data: PieBreakdown | null): LegendItem[] {
  if (!data || data.total <= 0) return [];
  const total = data.total;
  return data.segments.map(s => ({
    label:   s.label,
    value:   s.value,
    color:   STATUS_COLORS[s.label] ?? DEFAULT_STATUS_COLOR,
    percent: ((s.value / total) * 100).toFixed(1).replace('.', ',') + '%',
  }));
}

/** Color de cada segmento según su label de estado (fallback al color gris por defecto). */
export function segmentColors(labels: string[]): string[] {
  return labels.map(label => STATUS_COLORS[label] ?? DEFAULT_STATUS_COLOR);
}

/** Resalta con un offset el segmento de mayor valor. */
export function buildSegmentOffsets(values: number[]): number[] {
  const maxIdx = values.indexOf(Math.max(...values));
  return values.map((_, i) => (i === maxIdx ? 6 : 0));
}

export function buildChartOptions(total: number, unit: string): ChartOptions<'doughnut'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    layout: { padding: 8 },
    animation: { animateRotate: true, animateScale: true, duration: 500, easing: 'easeOutCubic' },
    plugins: {
      // Ocultamos legend + title del canvas: renderizamos leyenda en HTML.
      legend:   { display: false },
      title:    { display: false },
      subtitle: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: CHART_SURFACE,
        borderColor:  CHART_BORDER_SUBTLE,
        borderWidth: 1,
        titleColor:  CHART_TEXT_FG,
        bodyColor:   CHART_TEXT_MUTED,
        titleFont:   { family: CHART_FONT_FAMILY, size: 12, weight: 600 },
        bodyFont:    { family: CHART_FONT_FAMILY, size: 11 },
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        boxWidth: 8,
        boxHeight: 8,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: {
          title: (items) => (items[0]?.label as string) ?? '',
          label: (ctx) => {
            const v = ctx.parsed;
            const segTotal = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const pct = segTotal > 0 ? ((v / segTotal) * 100).toFixed(1) : '0';
            const val = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(v);
            return ` ${val} · ${pct}%`;
          },
        },
      },
      ...({ doughnutCenter: { total, unit } } as object),
    },
  };
}
