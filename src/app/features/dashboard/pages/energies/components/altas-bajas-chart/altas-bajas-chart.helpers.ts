import type { ChartDataset, ChartOptions, Plugin } from 'chart.js';
import { AltasBajasPoint } from '../../../../../../core/services/energy-expert.service';
import {
  CHART_BORDER_SUBTLE,
  CHART_FONT_FAMILY,
  CHART_GRID,
  CHART_SURFACE,
  CHART_TEXT_FG,
  CHART_TEXT_MUTED,
  SERIES_ALTAS,
  SERIES_ALTAS_HOVER,
  SERIES_BAJAS,
  SERIES_BAJAS_HOVER,
  SERIES_RENOVACIONES,
  SERIES_RENOVACIONES_HOVER,
} from '../../energies.constants';

/** A partir de cuántos puntos el eje X rota sus etiquetas 45° (mensual = 12 sin rotar; diario = 22–31 rotado). */
const ROTATE_LABELS_THRESHOLD = 8;

/**
 * Plugin: dibuja el valor de cada barra (>0) encima de la misma en el color de la serie.
 * Añade stroke del color de la card para legibilidad sobre barras diminutas.
 */
export const barValuesPlugin: Plugin<'bar'> = {
  id: 'barValues',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `700 11px ${CHART_FONT_FAMILY}`;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    chart.data.datasets.forEach((dataset, di) => {
      const meta = chart.getDatasetMeta(di);
      const color = dataset.backgroundColor as string;
      meta.data.forEach((el, i) => {
        const raw = dataset.data[i] as number | null | undefined;
        if (raw == null || raw === 0) return;
        const text = String(raw);
        // Stroke primero (color de card) crea outline legible; luego fill con el color de la serie.
        ctx.strokeStyle = CHART_SURFACE;
        ctx.strokeText(text, el.x, el.y - 4);
        ctx.fillStyle = color;
        ctx.fillText(text, el.x, el.y - 4);
      });
    });
    ctx.restore();
  },
};

/** Rotación adaptiva: si son pocos puntos (mensual = 12), sin rotación; si muchos (diario = 22–31), 45°. */
export function shouldRotateLabels(pointCount: number): boolean {
  return pointCount > ROTATE_LABELS_THRESHOLD;
}

export function mapPointsToLabels(points: AltasBajasPoint[]): string[] {
  return points.map(p => p.etiqueta);
}

export function buildBarDatasets(points: AltasBajasPoint[]): ChartDataset<'bar', number[]>[] {
  const altas = points.map(p => p.altas ?? 0);
  const bajas = points.map(p => p.bajas ?? 0);
  const renov = points.map(p => p.renovaciones ?? 0);

  return [
    {
      label: 'Nº Altas',
      data: altas,
      backgroundColor: SERIES_ALTAS,
      hoverBackgroundColor: SERIES_ALTAS_HOVER,
      borderRadius: 3,
      borderSkipped: false,
      barPercentage: 0.9,
      categoryPercentage: 0.72,
    },
    {
      label: 'Nº Bajas',
      data: bajas,
      backgroundColor: SERIES_BAJAS,
      hoverBackgroundColor: SERIES_BAJAS_HOVER,
      borderRadius: 3,
      borderSkipped: false,
      barPercentage: 0.9,
      categoryPercentage: 0.72,
    },
    {
      label: 'Nº Renovaciones',
      data: renov,
      backgroundColor: SERIES_RENOVACIONES,
      hoverBackgroundColor: SERIES_RENOVACIONES_HOVER,
      borderRadius: 3,
      borderSkipped: false,
      barPercentage: 0.9,
      categoryPercentage: 0.72,
    },
  ];
}

export function buildChartOptions(rotate: boolean): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 18, right: 4, bottom: 4, left: 4 } },
    animation: { duration: 400, easing: 'easeOutCubic' },
    plugins: {
      title:    { display: false },
      subtitle: { display: false },
      legend: {
        position: 'bottom',
        align: 'center',
        labels: {
          color: CHART_TEXT_MUTED,
          font: { family: CHART_FONT_FAMILY, size: 11, weight: 500 },
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8,
          padding: 16,
        },
      },
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
          label: (ctx) => {
            const v = ctx.parsed.y ?? 0;
            return ` ${ctx.dataset.label}: ${new Intl.NumberFormat('es-ES').format(v)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: CHART_TEXT_MUTED,
          font: { family: CHART_FONT_FAMILY, size: 10, weight: 500 },
          maxRotation: rotate ? 45 : 0,
          minRotation: rotate ? 45 : 0,
          autoSkipPadding: 6,
          // Quita el prefijo "YYYY/" cuando aparece (ej. "2025/Sep." → "Sep.")
          callback(value) {
            const label = this.getLabelForValue(value as number);
            return typeof label === 'string' ? label.replace(/^\d{4}\//, '') : label;
          },
        },
      },
      y: {
        grid: { color: CHART_GRID },
        border: { display: false },
        ticks: {
          color: CHART_TEXT_MUTED,
          font: { family: CHART_FONT_FAMILY, size: 10, weight: 500 },
          padding: 8,
          callback: (v) => new Intl.NumberFormat('es-ES').format(Number(v) || 0),
        },
        beginAtZero: true,
      },
    },
  };
}
