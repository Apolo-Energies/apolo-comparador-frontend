import { CatalogOption } from '../../../../../../../core/models/energy-expert-catalogs.model';

export interface AutoconsumoFormValue {
  tipoAutoconsumoAnterior: string;
  tipoCupsAutoconsumo:     string;
  cau:                     string;
  tipoAutoconsumo:         string;
  compensacion:            string;
  colectivo:               string;
  cil:                     string;
  potInstalada:            string;
  refCatastral:            string;
  tipoInstalacion:         string;
  esquemaMedida:           string;
  ssaa:                    string;
  unicoContrato:           string;
  xUtm:                    string;
  yUtm:                    string;
  husoUtm:                 string;
  bandaUtm:                string;
  tipoDocumentacion:       string;
  numDocumento:            string;
  razonSocial:             string;
  nombre:                  string;
  apellido1:               string;
  apellido2:               string;
  telefono:                string;
  email:                   string;
  tipoDocumento1:          string;
  urlDocumento1:           string;
}

export const EMPTY_AUTOCONSUMO_FORM: AutoconsumoFormValue = {
  tipoAutoconsumoAnterior: '',
  tipoCupsAutoconsumo:     '',
  cau:                     '',
  tipoAutoconsumo:         '',
  compensacion:            '',
  colectivo:               '',
  cil:                     '',
  potInstalada:            '',
  refCatastral:            '',
  tipoInstalacion:         '',
  esquemaMedida:           '',
  ssaa:                    '',
  unicoContrato:           '',
  xUtm:                    '',
  yUtm:                    '',
  husoUtm:                 '',
  bandaUtm:                '',
  tipoDocumentacion:       '',
  numDocumento:            '',
  razonSocial:             '',
  nombre:                  '',
  apellido1:               '',
  apellido2:               '',
  telefono:                '',
  email:                   '',
  tipoDocumento1:          '',
  urlDocumento1:           '',
};

/** Mapea un catálogo de Control (PascalCase: Text/Value) a las opciones que espera ui-select. */
export function toSelectOptions(opts: CatalogOption[] | null | undefined): { value: string; label: string }[] {
  return (opts ?? []).map(o => ({ value: o.Value, label: o.Text }));
}

/** Títulos de cada paso del formulario — partido así para no mostrar los ~25 campos de una vez. */
export const AUTOCONSUMO_STEPS = [
  'Datos Generales',
  'Coordenadas de la Instalación',
  'Datos del Titular Generación',
  'Otros Datos',
] as const;
