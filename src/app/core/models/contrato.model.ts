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
  Tarifa:                 string | null;
  FechaCreacion:          string | null;
  FechaFin:               string | null;
  FechaInicio:            string | null;
  /** Producto contratado (NombreOfertaCTF de EE). */
  Producto:               string | null;
  TipoEnergia:            TipoEnergia | null;
  /** null = aún no se ha enviado a firma, o no aplica (KO, baja…). */
  EstadoFirma:            'firmado' | 'pendiente' | 'expirado' | 'cancelado' | null;
  /** Estado incidencia en EE o registro abierto de Operaciones. */
  TieneIncidencia:        boolean;
  /** Colaborador (delegación) al que pertenece el contrato. */
  NombreDelegacion:       string | null;
}

export type TipoEnergia = 'luz' | 'gas';

export interface ContratosPageResponse {
  page:     number;
  pageSize: number;
  total:    number;
  hasMore:  boolean;
  data:     ContratoClienteRow[];
}

/** Respuesta de GET /energy-expert/portal/contratos-cards */
export interface ContratosCards {
  activos:       number;
  paraFirma:     number;
  paraTramitar:  number;
  bajas:         number;
  estudios:      number | null;
}
