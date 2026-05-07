export interface ReportPayload {
  fileId:     string;
  cups:       string;
  providerId: number;
  datos: {
    titulo:             string;
    tarifa:             string;
    modalidad:          string;
    periodo:            string;
    diasFactura:        number;
    ahorro:             number;
    ahorroPorcentaje:   number;
    ahorroAnual:        number;
    consumoAnual:       number;
    precioPromedioOmie: number;
    feeEnergia:         number;
    feePotencia:        number;
  };
  cliente: {
    nombreCliente: string;
    razonSocial:   string;
    cif:           string;
    direccion:     string;
    cp:            string;
    provincia:     string;
  };
  totales: {
    baseActual:                 number;
    baseOferta:                 number;
    impuestoElectricoActual:    number;
    impuestoElectricoOferta:    number;
    alquilerEquipo:             number;
    ivaActual:                  number;
    ivaOferta:                  number;
    totalActual:                number;
    totalOferta:                number;
    otrosNoComunesActual:       number;
    otrosNoComunesOferta:       number;
    otrosComunesSinIeActual:    number;
    otrosComunesSinIeOferta:    number;
    otrosComunesConIeActual:    number;
    otrosComunesConIeOferta:    number;
  };
  lineas: Array<{
    termino:       string;
    unidad:        string;
    valor:         number;
    precioActual:  number;
    costeActual:   number;
    precioOferta:  number;
    costeOferta:   number;
  }>;
}

export interface SaveComparisonRequest {
  fileId:            string;
  cups:              string;
  annualConsumption: number;
  targetUserId?:     string;
  tariff?:           string;
  product?:          string;
  omieAveragePrice?: number;
  energyFee?:        number;
  powerFee?:         number;
  energyCommission?: number;
  willCloseContract?: boolean;
  commissionAmount?: number;
  commissionPercent?: number;
  monthlySavings?:   number;
  annualSavings?:    number;
  savingsPercent?:   number;
  clientName?:       string;
  clientNif?:        string;
  clientAddress?:    string;
  clientPostalCode?: string;
  clientProvince?:   string;
  pdfSnapshot?:      ReportPayload;
}

export interface SaveComparisonResponse {
  id:                 string;
  userId:             string;
  cups:               string;
  opportunityId:      string;
  opportunityCreated: boolean;
}
