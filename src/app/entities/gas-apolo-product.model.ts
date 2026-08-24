/**
 * Producto gas propio de Apolo (isCompetitor=false).
 * Hoy solo hay uno: "Apolo Gas Indexado" con margen sobre variable = 0.
 * El modelo soporta futuros productos comerciales (ej. "Apolo Gas Fijo").
 */
export interface GasApoloProduct {
  productId:       number;
  productName:     string;
  marginEurPerMwh: number;
}
