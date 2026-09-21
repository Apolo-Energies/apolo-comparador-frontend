// Productos "Fijo" que cobran una comisión fija en €uros en vez de fee × kWh.
// Añadir un producto aquí es la ÚNICA edición necesaria: comparator.service.ts,
// select-product.ts (Alta Rápida), calculator.helpers.ts y el bloqueo de fee del
// comparador (comparator.ts / public-comparator.ts / branded-landing.component.ts)
// leen todos de este mismo mapa.
export const FLAT_COMMISSION_PRODUCTS: Record<string, number> = {
  'Fijo Snap Mini': 50,
  'Fijo Snap': 75,
  'Fijo Snap Maxi': 100,
  'Vibra': 100,
};

export const FLAT_COMMISSION_PRODUCT_NAMES: readonly string[] = Object.keys(FLAT_COMMISSION_PRODUCTS);

// Productos con fee bloqueado en el comparador: los de comisión fija de arriba,
// más las promos 3M (fee no configurable aunque su comisión sí sea porcentual).
// string[] (no readonly) porque se pasa directo al input `feeLockedProducts` de ComparatorModalComponent.
export const FEE_LOCKED_PRODUCTS: string[] = [
  ...FLAT_COMMISSION_PRODUCT_NAMES,
  'Promo 3M Lite', 'Promo 3M Pro', 'Promo 3M Plus',
];
