export interface TourStep {
  /** Selector CSS del elemento real a resaltar (ej. `a[href="/dashboard/my-clients"]`). */
  selector?: string;
  /** Alternativa cuando el elemento no tiene un selector estable (ej. ítems de menú sin href, que togglean en vez de navegar) — busca por texto visible. */
  textMatch?: { tag: string; text: string };
  title: string;
  description: string;
}
