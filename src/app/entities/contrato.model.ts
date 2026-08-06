/**
 * Vista agregada por cliente que devuelve el endpoint `GET /energy-expert/contratos`.
 * Cada fila representa 1 cliente con el resumen de sus N servicios/contratos.
 * Los detalles per-CUPS (tarifa, dirección, consumo por servicio, estado por servicio)
 * viven en el drawer y se cargan on-demand vía `/energy-expert/servicios?idCliente=...`.
 */
export interface ContratoClienteRow {
  IdCliente:              number;
  NIF:                    string;
  NombreCliente:          string;
  RazonSocialCliente:     string | null;
  NombreComercialCliente: string | null;
  IdDelegacion:           number | null;
  NumServicios:           number;
  CUPS:                   string[];
  ConsumoTotal:           number;
  /** Mapa CUPS → consumo del contrato (kWh). Autoritativo para mostrar
   *  consumo por servicio en el drawer; alineado con `ConsumoTotal`. */
  ConsumoPorCups:         Record<string, number>;
  EstadoBreakdown:        Record<string, number>;
  EstadoResumen:          string;
  ProximoVencimiento:     string | null;
  UltimoMovimiento:       string | null;
}

export interface ContratosPageResponse {
  page:     number;
  pageSize: number;
  total:    number;
  hasMore:  boolean;
  data:     ContratoClienteRow[];
}
