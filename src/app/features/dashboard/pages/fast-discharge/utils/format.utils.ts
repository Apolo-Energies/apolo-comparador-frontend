export function formatIbanES(value: string): string {
  const clean = value.replace(/\s/g, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join(' ') ?? clean;
}
