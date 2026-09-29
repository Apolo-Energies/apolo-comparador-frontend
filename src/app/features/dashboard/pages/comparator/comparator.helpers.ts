import { Tariff } from '../../../../core/models/provider.model';
import { ComparatorProductsByTariff } from './comparator-ui.model';

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
