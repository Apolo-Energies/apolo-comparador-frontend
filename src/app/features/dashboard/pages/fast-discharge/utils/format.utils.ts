/** Tope para cubrir IBAN de España (24) hasta Portugal/otros SEPA (25-26). */
const MAX_IBAN_LENGTH = 26;

export function formatIbanES(value: string): string {
  const clean = value.replace(/\s/g, '').toUpperCase().slice(0, MAX_IBAN_LENGTH);
  return clean.match(/.{1,4}/g)?.join(' ') ?? clean;
}

/** Formatea un número para el portal EE: decimales con coma, "0" para vacíos. */
export function toEeDecimal(n: number): string {
  if (!n || n === 0) return '0';
  const s = n.toFixed(7).replace(/\.?0+$/, '');
  return s.replace('.', ',');
}
