/** Opción de desplegable tal como la devuelve Control (EE) — PascalCase real de la API. */
export interface CatalogOption {
  Disabled: boolean;
  Group:    string | null;
  Selected: boolean;
  Text:     string;
  Value:    string;
}

/** Tarifa ATR disponible — mismo origen que el resto de catálogos (Control/EE). */
export interface AutoconsumoTariff {
  IdTarifa:                number;
  NombreTarifa:            string;
  DescripcionTarifa:       string;
  Periodos:                number;
  TipoQDAplicada:          string | null;
  TipoPeajeTF:             string | null;
  TipoReparto:             string | null;
  ConsumoAnualMinimo:      number | null;
  ConsumoAnualMaximo:      number | null;
  FechaInicio:             string | null;
  FechaFin:                string | null;
  IdGrupoTarifas:          number;
  NombreGrupoTarifas:      string;
  DescripcionGrupoTarifas: string;
  TipoGrupoTarifas:        string;
}

/**
 * Catálogos de Autoconsumo para el alta rápida de Luz (GET /energy-expert/catalogs).
 * Se cachean en el backend contra Control (EE) y recién se pueblan después de
 * correr una alta real en ese mismo proceso — en un ambiente recién levantado,
 * antes de la primera alta, cada campo sale en null.
 */
export interface EnergyExpertCatalogs {
  idTarifa:                      AutoconsumoTariff[] | null;
  tipoAutoconsumo2:              CatalogOption[] | null;
  tipoAutoconsumoCUPS:           CatalogOption[] | null;
  tipoAutoconsumo:               CatalogOption[] | null;
  tipoAutoconsumoCompensacion:   CatalogOption[] | null;
  tipoAutoconsumoColectivo:      CatalogOption[] | null;
  tipoInstalacionGeneracion:     CatalogOption[] | null;
  esquemaMedidaGeneracion:       CatalogOption[] | null;
  serviciosAuxiliaresGeneracion: CatalogOption[] | null;
  unicoContratoGeneracion:       CatalogOption[] | null;
  tipoDocTitularGeneracion:      CatalogOption[] | null;
}
