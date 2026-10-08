const MAX_SLUG_LENGTH = 80;

/**
 * Convierte texto libre en un slug válido de marca blanca: ^[a-z0-9]+(-[a-z0-9]+)*$
 * — minúsculas, sin tildes/ñ/espacios/guion bajo, guiones solo como separador
 * (nunca al borde ni dobles), máximo 80 caracteres. El backend compara el
 * slug tal cual contra la base sin normalizar, así que esta es la única
 * fuente de verdad del formato (usala siempre que derives un slug a partir
 * del nombre).
 */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes/diacríticos (ñ → n)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // cualquier corrida de caracteres inválidos → un guion
    .replace(/^-+|-+$/g, '');   // sin guion al principio/final

  return slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '');
}

/**
 * Sanea el slug mientras el usuario lo edita a mano: quita tildes/mayúsculas/
 * caracteres inválidos pero respeta los guiones tal cual los va escribiendo
 * (no los recorta ni colapsa) — el validador de formulario ya avisa si quedan
 * al borde o duplicados antes de guardar.
 */
export function sanitizeSlugChars(input: string): string {
  return input
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, MAX_SLUG_LENGTH);
}
