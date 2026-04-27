export type PersonType = 'Individual' | 'Company';
export type TramiteType = 'ALTA_NUEVA' | 'CAMBIO_TARIFA' | 'CAMBIO_POTENCIA' | 'NUEVO_TITULAR';

export interface NaturalPerson {
  type: 'Individual';
  dni: string;
  name: string;
  surnames: string;
  address_1: string;
  address_2: string;
  email: string;
  bank_account: string;
  phone: string;
}

export interface ArtificialPerson {
  type: 'Company';
  dni: string;
  name: string;
  surnames: string;
  companyName: string;
  cif: string;
  address_1: string;
  address_2: string;
  email: string;
  bank_account: string;
  phone: string;
}

export type Person = NaturalPerson | ArtificialPerson;

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
