export type PersonType = 'Individual' | 'Company';
export type TramiteType = 'ALTA_NUEVA' | 'CAMBIO_TARIFA' | 'CAMBIO_POTENCIA' | 'NUEVO_TITULAR';

export interface NaturalPerson {
  type: 'Individual';
  dni: string;
  name: string;
  apellido1: string;
  apellido2: string;
  surnames: string;
  address_1: string;
  address_2: string;
  cp: string;
  idProvincia: number;
  idPoblacion: number;
  townName: string;
  email: string;
  bank_account: string;
  phone: string;
}

export interface ArtificialPerson {
  type: 'Company';
  dni: string;
  name: string;
  apellido1: string;
  apellido2: string;
  surnames: string;
  companyName: string;
  cif: string;
  address_1: string;
  address_2: string;
  cp: string;
  idProvincia: number;
  idPoblacion: number;
  townName: string;
  email: string;
  bank_account: string;
  phone: string;
}

export type Person = NaturalPerson | ArtificialPerson;

export interface SupplyPoint {
  cups:        string;
  address:     string;
  cnae:        string;
  province:    string;
  city:        string;
  zipCode:     string;
  tariffType:  string;
  idProvincia: number;
  idPoblacion: number;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  p5: number;
  p6: number;
}

export interface Product {
  tramiteTypes:       TramiteType[];
  tipoProducto:       string;
  tipoPrecioEnergia:  string;
  productName:        string;
  tariffCode:         string;
  feeEnergia:         number;
  feePotencia:        number;
  omiePrice:          number;
  commission:         number;
  annualSavings:      number;
}

export type DocumentKey =
  | 'dni_front'
  | 'dni_back'
  | 'factura_estudio'
  | 'bank'
  | 'escrituras_poderes'
  | 'cif_file'
  | 'cie'
  | 'justo_titulo';

export type DocumentState = Partial<Record<DocumentKey, File>>;
