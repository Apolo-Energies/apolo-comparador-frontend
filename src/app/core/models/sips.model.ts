export interface SipsPs {
  cups: string;
  codigoPostalPS: string;
  municipioPS: string;
  codigoProvinciaPS: string;
  nombreEmpresaDistribuidora: string;
  codigoTarifaATREnVigor: string;
  codigoTensionV: string;
  potenciaMaximaBIEW?: number;
  potenciaContratadaP1: number;
  potenciaContratadaP2: number;
  potenciaContratadaP3: number;
  potenciaContratadaP4: number;
  potenciaContratadaP5: number;
  potenciaContratadaP6: number;
  [key: string]: unknown;
}

export interface SipsConsumo {
  cups: string;
  fechaInicio: string;
  fechaFin: string;
  energiaP1: number;
  energiaP2: number;
  energiaP3: number;
  energiaP4: number;
  energiaP5: number;
  energiaP6: number;
  potenciaP1: number;
  potenciaP2: number;
  potenciaP3: number;
  potenciaP4: number;
  potenciaP5: number;
  potenciaP6: number;
  [key: string]: unknown;
}

export interface SipsApiResponse {
  ps: SipsPs;
  consumos: SipsConsumo[];
}
