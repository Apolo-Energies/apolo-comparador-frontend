/** Human label for a template's audience type. */
export function typeLabel(type: string): string {
  return type === 'individual' ? 'Individual' : 'Empresa';
}
