import { Tariff } from '../../../../core/models/provider.model';
import { ComparatorProductsByTariff } from './comparator-ui.model';
import { OcrResult } from '../../../../core/models/comparator.model';
import { normalizeInvoiceDate } from '../../../../core/services/comparator-gas-calculator.helpers';

/**
 * Agrupa los productos disponibles por tarifa (code → nombres de producto),
 * ordenando los indexados antes que los fijos. Usado para poblar el selector
 * de producto del modal de comparación.
 */
export function buildProductsByTariff(tariffs: Tariff[]): ComparatorProductsByTariff {
  return Object.fromEntries(
    tariffs.map(t => [
      t.code,
      t.products
        .filter(p => p.isAvailable)
        .sort((a, b) => {
          if (a.type === b.type) return 0;
          return a.type === 'Indexed' ? -1 : 1;
        })
        .map(p => p.name),
    ])
  );
}

/**
 * Rango (yyyy-MM-dd) cuyo OMIE medio se usa para comparar: el período de facturación.
 * Si el OCR solo trae una de las dos fechas, el mes natural de esa fecha. Sin fechas, null.
 */
export function invoiceOmieRange(ocr: OcrResult | null | undefined): { from: string; to: string } | null {
  const from = normalizeInvoiceDate(ocr?.periodo_facturacion?.fecha_inicio);
  const to   = normalizeInvoiceDate(ocr?.periodo_facturacion?.fecha_fin);
  if (from && to) return from <= to ? { from, to } : { from: to, to: from };
  const one = from ?? to;
  if (!one) return null;
  const [y, m] = one.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${lastDay}` };
}

/** yyyy-MM-dd → dd/MM/yy */
export function shortIsoDate(v: string): string {
  const [y, m, d] = v.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}
