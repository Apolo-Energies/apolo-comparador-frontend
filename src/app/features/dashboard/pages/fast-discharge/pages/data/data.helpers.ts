export interface PhoneCountry {
  code: string;
  flag: string;
  name: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: '+34',  flag: '🇪🇸', name: 'España'     },
  { code: '+591', flag: '🇧🇴', name: 'Bolivia'     },
  { code: '+52',  flag: '🇲🇽', name: 'México'      },
  { code: '+54',  flag: '🇦🇷', name: 'Argentina'   },
  { code: '+57',  flag: '🇨🇴', name: 'Colombia'    },
  { code: '+56',  flag: '🇨🇱', name: 'Chile'       },
  { code: '+51',  flag: '🇵🇪', name: 'Perú'        },
  { code: '+58',  flag: '🇻🇪', name: 'Venezuela'   },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador'     },
  { code: '+1',   flag: '🇺🇸', name: 'EE.UU.'      },
  { code: '+44',  flag: '🇬🇧', name: 'Reino Unido' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal'    },
  { code: '+212', flag: '🇲🇦', name: 'Marruecos'   },
];

const PHONE_SPLIT_CODES = PHONE_COUNTRIES
  .slice()
  .sort((a, b) => b.code.length - a.code.length);

/** Splits a stored E.164-ish phone string into its country code and local number. */
export function splitPhone(phone: string): { code: string; local: string } {
  const match = PHONE_SPLIT_CODES.find(c => phone.startsWith(c.code));
  return match
    ? { code: match.code, local: phone.slice(match.code.length) }
    : { code: '+34', local: phone };
}

export const INPUT_CLS  = 'px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';
export const SELECT_CLS = 'shrink-0 px-2 py-2.5 text-sm rounded-l-lg border border-r-0 bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer';
export const NUMBER_CLS = 'flex-1 min-w-0 px-4 py-2.5 text-sm rounded-r-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';

export interface DataFormFields {
  submitted: boolean;
  isCompany: boolean;
  cif: string;
  companyName: string;
  nif: string;
  nombre: string;
  apellido1: string;
  email: string;
  phoneNumber: string;
  direccion: string;
  cp: string;
  provinciaId: number;
  municipioId: number;
  iban: string;
  bic: string;
  nombreTitular: string;
  otroFirmante: boolean;
  firmanteNif: string;
  firmanteNombre: string;
  firmanteApellido1: string;
  firmanteApellido2: string;
  firmanteTelefono: string;
  firmanteEmail: string;
}

// Código de entidad (4 primeros dígitos tras ES+control del IBAN) → BIC del banco.
const BIC_BY_ENTITY_CODE: Record<string, string> = {
  '0049': 'BSCHESMM', // Banco Santander
  '0182': 'BBVAESMM', // BBVA
  '2100': 'CAIXESBB', // CaixaBank
  '0081': 'BSABESBB', // Banco Sabadell
  '1465': 'INGDESMM', // ING
  '0073': 'OPENESMM', // Openbank
};

/** Deduce el BIC a partir del código de entidad de un IBAN español (ESkk EEEE OOOO CC CCCCCCCCCC). */
export function detectBicFromIban(iban: string): string | null {
  const clean = iban.replace(/\s/g, '').toUpperCase();
  if (!clean.startsWith('ES') || clean.length < 8) return null;
  return BIC_BY_ENTITY_CODE[clean.slice(4, 8)] ?? null;
}

// BIC/SWIFT: 4 letras banco + 2 letras país + 2 alfanum + 3 opcionales.
const BIC_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

export function isValidBic(raw: string): boolean {
  const clean = raw.trim().toUpperCase();
  return (clean.length === 8 || clean.length === 11) && BIC_REGEX.test(clean);
}

/** Completa con "XXX" si vino sin sucursal (8 → 11 caracteres). */
export function normalizeBic(raw: string): string {
  const clean = raw.trim().toUpperCase();
  return clean.length === 8 ? clean + 'XXX' : clean;
}

function computeBicError(raw: string): string | null {
  if (!raw.trim()) return 'Obligatorio';
  return isValidBic(raw)
    ? null
    : 'El BIC no es válido. Formato esperado: 4 letras + ES + 2 o 5 caracteres (ej. CAIXESBBXXX).';
}

/** Validación del formulario de datos del cliente. */
export function computeDataErrors(f: DataFormFields): Record<string, string | null> {
  const none: Record<string, string | null> = {
    cif: null, companyName: null,
    nif: null, nombre: null, apellido1: null, email: null,
    phone: null, direccion: null, cp: null, provincia: null, municipio: null, iban: null, bic: null, nombreTitular: null,
    firmanteNif: null, firmanteNombre: null, firmanteApellido1: null,
    firmanteTelefono: null, firmanteEmail: null,
  };
  if (!f.submitted) return none;
  const ibanVal = f.iban.replace(/\s/g, '');
  const needsFirmante = f.isCompany || f.otroFirmante;
  return {
    cif:         f.isCompany && !f.cif.trim()         ? 'Obligatorio' : null,
    companyName: f.isCompany && !f.companyName.trim() ? 'Obligatorio' : null,
    nif:      f.isCompany ? null
            : !f.nif.trim()           ? 'Obligatorio'
            : f.nif.trim().length < 9 ? 'Mínimo 9 caracteres' : null,
    nombre:   f.isCompany ? null : !f.nombre.trim()    ? 'Obligatorio' : null,
    apellido1:f.isCompany ? null : !f.apellido1.trim() ? 'Obligatorio' : null,
    email:    !f.email.trim()        ? 'Obligatorio'
            : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) ? 'Email inválido' : null,
    phone:    !f.phoneNumber.trim()  ? 'Obligatorio'
            : !/^[0-9]{9,15}$/.test(f.phoneNumber.replace(/\s/g, '')) ? 'Solo dígitos, 9–15 números' : null,
    direccion:!f.direccion.trim()    ? 'Obligatorio' : null,
    cp:        !f.cp.trim()          ? 'Obligatorio'
             : !/^\d{5}$/.test(f.cp) ? 'CP inválido (5 dígitos)' : null,
    provincia: f.provinciaId === 0 ? 'Selecciona una provincia' : null,
    municipio: f.municipioId  === 0 ? 'Selecciona un municipio'  : null,
    iban:      ibanVal && ibanVal.length < 15 ? 'IBAN inválido' : null,
    bic:       computeBicError(f.bic),
    nombreTitular: !f.nombreTitular.trim() ? 'Obligatorio' : null,
    firmanteNif:       needsFirmante && !f.firmanteNif.trim()       ? 'Obligatorio' : null,
    firmanteNombre:    needsFirmante && !f.firmanteNombre.trim()    ? 'Obligatorio' : null,
    firmanteApellido1: needsFirmante && !f.firmanteApellido1.trim() ? 'Obligatorio' : null,
    // Opcionales: solo si el firmante/representante tiene teléfono o email distinto al del cliente.
    firmanteTelefono: f.firmanteTelefono.trim() && !/^[0-9]{9,15}$/.test(f.firmanteTelefono.replace(/\s/g, ''))
      ? 'Solo dígitos, 9–15 números' : null,
    firmanteEmail: f.firmanteEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.firmanteEmail)
      ? 'Email inválido' : null,
  };
}
