/** Producto tal cual lo devuelve GET /quixotic/products — snake_case, igual que Quixotic. */
export interface QuixoticProduct {
  id:            string;
  name:          string;
  service_type:  string;
  product_code:  string | null;
}
