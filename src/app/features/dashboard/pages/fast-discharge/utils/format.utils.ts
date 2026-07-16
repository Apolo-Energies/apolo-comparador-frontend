export function formatIbanES(value: string): string {
  const clean = value.replace(/\s/g, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join(' ') ?? clean;
}

/** Formatea un número para el portal EE: decimales con coma, "0" para vacíos. */
export function toEeDecimal(n: number): string {
  if (!n || n === 0) return '0';
  const s = n.toFixed(7).replace(/\.?0+$/, '');
  return s.replace('.', ',');
}
