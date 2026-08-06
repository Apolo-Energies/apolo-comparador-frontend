import { ServicioListItem } from './servicio.model';

/**
 * Cliente asignado al usuario autenticado, resuelto por el backend según su
 * delegación (si es Master, ve los clientes de todas las delegaciones).
 * GET /energy-expert/clientes.
 *
 * Ojo con el casing: `contratos` va en camelCase (lo reconstruye el backend),
 * mientras que `servicios` y `suministros` vienen en PascalCase tal cual los
 * devuelve Energy Expert, sin normalizar.
 */
export interface AssignedClientContract {
  id:                 number;
  idContratoServicio: number;
  cups:               string | null;
  tarifa:             string | null;
  estadoContrato:     string;
  estadoServicio:     string;
  fechaInicio:        string | null;
  fechaFin:           string | null;
  idArchivo:          number | null;
}

/** Punto de suministro (CUPS) del cliente. PascalCase, tal cual lo devuelve Energy Expert. */
export interface AssignedClientSuministro {
  Id:              number;
  Tipo:            string;
  CUPS:            string;
  Direccion:       string | null;
  CP:              string | null;
  Provincia:       string | null;
  Poblacion:       string | null;
  Tarifa:          string | null;
  PotenciaP1:      number | null;
  ConsumoAnualP1:  number | null;
  ConsumoAnual:    number | null;
  IdCliente:       number;
  IdDistribuidora: number | null;
}

export interface AssignedClient {
  idCliente:              number;
  nif:                    string;
  nombreCliente:          string;
  nombreComercialCliente: string;
  direccion:              string | null;
  cp:                     string | null;
  provincia:              string | null;
  poblacion:              string | null;
  totalContratos:         number;
  contratos:              AssignedClientContract[];
  servicios:              ServicioListItem[];
  suministros:            AssignedClientSuministro[];
}

export interface AssignedClientFilters {
  page?:     number;
  pageSize?: number;
}

export interface AssignedClientsPageResponse {
  page:     number;
  pageSize: number;
  total:    number;
  hasMore:  boolean;
  data:     AssignedClient[];
}
