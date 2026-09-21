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
}

/** Pure form-validation for the customer-data step. Extracted to keep DataPage under R1. */
export function computeDataErrors(f: DataFormFields): Record<string, string | null> {
  const none: Record<string, string | null> = {
    nif: null, nombre: null, apellido1: null, email: null,
    phone: null, direccion: null, cp: null, provincia: null, municipio: null, iban: null,
  };
  if (!f.submitted) return none;
  const ibanVal = f.iban.replace(/\s/g, '');
  return {
    nif:      !f.nif.trim()          ? 'Obligatorio'
            : f.nif.trim().length < 9 ? 'Mínimo 9 caracteres' : null,
    nombre:   !f.nombre.trim()       ? 'Obligatorio' : null,
    apellido1:!f.apellido1.trim()    ? 'Obligatorio' : null,
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
  };
}
