/** Array de 6 ceros — estado inicial de los overrides de fee por período (P1..P6). */
export function emptyPeriods(): number[] {
  return Array.from({ length: 6 }, () => 0);
}

export function getPrecioEnergiaValue(
  periodos: { periodo: number | string; precioEnergiaOferta?: number }[],
  p: number,
): string {
  const found = periodos.find(x => Number(x.periodo) === p);
  return found ? found.precioEnergiaOferta?.toFixed(6) ?? '0,000000' : '0,000000';
}

export function getPrecioPotenciaValue(
  periodos: { periodo: number | string; precioPotenciaOferta?: number }[],
  p: number,
): string {
  const found = periodos.find(x => Number(x.periodo) === p);
  return found ? found.precioPotenciaOferta?.toFixed(6) ?? '0,000000' : '0,000000';
}

export function truncateValue(value: number): number {
  return Math.trunc(value);
}

export function formatEurValue(value: number): string {
  return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function formatPctValue(value: number): string {
  return value.toFixed(2) + ' %';
}

export function formatPriceValue(value: number): string {
  return value.toFixed(6);
}
