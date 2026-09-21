/** Punto de suministro de gas SIPS — espejo de GasSipsPoint del backend. */
export interface GasSipsPs {
  id: number;
  cups: string;

  codigoDistribuidora: string | null;
  nombreDistribuidora: string | null;

  codigoPostal: string | null;
  municipio: string | null;
  provincia: string | null;
  direccionCompleta: string | null;

  codigoPeajeAtr: string | null;
  caudalContratadoNm3H: number | null;
  caudalMaximoDiarioWh: number | null;
  presion: number | null;
  tipoPerfilConsumo: string | null;

  codigoContador: string | null;
  calibreContador: string | null;
  tipoContador: string | null;

  fechaAlta: string | null;
  fechaUltimaLectura: string | null;
  fechaUltimoCambioComercializador: string | null;

  derechoTur: string | null;
  cnae: string | null;
  esViviendaHabitual: string | null;
  informacionImpagos: string | null;

  consumoAnualKwh: number | null;
  comercializadoraActual: string | null;
  fechaActualizacion: string;
}

/** Periodo de consumo (espejo de GasSipsConsumptionDto del backend). */
export interface GasSipsConsumption {
  cups: string;
  fechaInicio: string;
  fechaFin: string;
  codigoTarifaPeaje: string | null;
  consumoP1Kwh: number;
  consumoP2Kwh: number;
  totalKwh: number;
  caudalMedioWhDia: number | null;
  porcentajeConsumoNocturno: number | null;
}

/** Respuesta del endpoint POST /sips-gas */
export interface GasSipsApiResponse {
  ps: GasSipsPs | null;
  consumptions: GasSipsConsumption[];
  annualKwh: number;
}
