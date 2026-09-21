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
  estado?:   string;
  faltante?: string;
}

export interface AssignedClientsPageResponse {
  page:     number;
  pageSize: number;
  total:    number;
  hasMore:  boolean;
  data:     AssignedClient[];

  /**
   * Totales agregados sobre TODOS los clientes del alcance del usuario (no solo
   * los de la página actual) — misma delegación, o todas si es Master. Opcionales
   * porque backend aún no los devuelve; hasta que los envíe, el frontend no debe
   * mostrarlos en vez de mostrar 0 (ver my-clients-page.ts).
   *
   * totalClients:   equivalente a `total` — mismo alcance, mismo número.
   * totalContracts: suma de totalContratos de cada cliente del alcance.
   * totalServices:  suma de servicios activos de cada cliente del alcance.
   */
  totalClients?:   number;
  totalContracts?: number;
  totalServices?:  number;
}
