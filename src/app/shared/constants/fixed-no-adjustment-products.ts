// Productos "Fijo" que no incluyen servicios de ajuste — su fecha de
// activación siempre es el 1 de enero, sin importar la tarifa (2.0TD/3.0TD/6.1TD).
export const FIXED_NO_ADJUSTMENT_PRODUCTS: readonly string[] = ['Fijo Fácil', 'Fijo Estable', 'Fijo Dyn'];

export const FIXED_NO_ADJUSTMENT_MESSAGE =
  'El producto seleccionado no incluye los servicios de ajuste y su fecha de activación será el 1 de enero.';

export const isFixedNoAdjustmentProduct = (producto: string): boolean =>
  FIXED_NO_ADJUSTMENT_PRODUCTS.includes(producto);
