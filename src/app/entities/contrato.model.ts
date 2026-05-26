export interface ContratoListItem {
  Id:                     number;
  IdServicio:             number;
  IdCliente:              number;
  IdSuministro:           number;
  Tipo:                   string;
  Tarifa:                 string;
  NIF:                    string;
  NombreCliente:          string;
  DireccionSuministro:    string;
  CUPS:                   string;
  NombreComercialCliente: string;
  ConsumoTotalEse:        number;
  ConsumoTotalNoEse:      number;
  EstadoContrato:         string;
  EstadoServicio:         string;
  FechaInicio:            string | null;
  FechaFin:               string | null;
}
