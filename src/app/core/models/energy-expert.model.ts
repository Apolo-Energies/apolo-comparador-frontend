import { ServicioListItem } from './servicio.model';

/** Respuesta de GET /energy-expert/servicios (paginada). */
export interface ServiciosPageResponse {
  page:     number;
  pageSize: number;
  total:    number;
  data:     ServicioListItem[];
}

export interface EeTown {
  IdProvincia: number;
  Nombre:      string;
}

export interface EeMunicipio {
  IdPoblacion: number;
  Nombre:      string;
  IdProvincia: number;
}

export interface AltaRapidaResponse {
  success:             boolean;
  message:             string;
  statusCode:          number;
  idContratoServicio?: number;
}
