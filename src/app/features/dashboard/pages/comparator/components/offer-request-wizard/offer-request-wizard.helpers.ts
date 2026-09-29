import { OfferPersonType, OfferRequestDocumentKey, OfferRequestDocuments } from '../../../../../../core/models/offer-request.model';
import { OcrResult } from '../../../../../../core/models/comparator.model';

/**
 * Static config, regex validators and pure formatting helpers for
 * `OfferRequestWizardComponent`. No Angular, no HTTP.
 */

export interface DocSlot {
  key:   OfferRequestDocumentKey;
  label: string;
}

export const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.bmp,.tiff,.heic';

export const INDIVIDUAL_DOCS: DocSlot[] = [
  { key: 'dniFront',      label: 'DNI delante' },
  { key: 'dniBack',       label: 'DNI atrás' },
  { key: 'bankStatement', label: 'Certificado de cuenta bancaria (titular)' },
];

export const COMPANY_DOCS: DocSlot[] = [
  { key: 'incorporationDeed', label: 'Escrituras' },
  { key: 'cifCertificate',    label: 'CIF' },
  { key: 'administratorDni',  label: 'DNI del Administrador o Apoderado' },
  { key: 'bankStatement',     label: 'Certificado de cuenta bancaria (empresa)' },
];

export function requiredDocsFor(personType: OfferPersonType): DocSlot[] {
  return personType === 'Company' ? COMPANY_DOCS : INDIVIDUAL_DOCS;
}

export const PHONE_COUNTRIES = [
  { code: '+34',  flag: '🇪🇸', name: 'España' },
  { code: '+591', flag: '🇧🇴', name: 'Bolivia' },
  { code: '+52',  flag: '🇲🇽', name: 'México' },
  { code: '+54',  flag: '🇦🇷', name: 'Argentina' },
  { code: '+57',  flag: '🇨🇴', name: 'Colombia' },
  { code: '+56',  flag: '🇨🇱', name: 'Chile' },
  { code: '+51',  flag: '🇵🇪', name: 'Perú' },
  { code: '+58',  flag: '🇻🇪', name: 'Venezuela' },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+1',   flag: '🇺🇸', name: 'EE.UU.' },
  { code: '+44',  flag: '🇬🇧', name: 'Reino Unido' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+212', flag: '🇲🇦', name: 'Marruecos' },
];

export const PHONE_SPLIT_CODES = PHONE_COUNTRIES.slice().sort((a, b) => b.code.length - a.code.length);

/** Splits a full phone string (e.g. "+34612345678") into country code + local number. */
export function splitPhone(phone: string): { code: string; local: string } {
  if (!phone) return { code: '+34', local: '' };
  const match = PHONE_SPLIT_CODES.find(c => phone.startsWith(c.code));
  return match ? { code: match.code, local: phone.slice(match.code.length) } : { code: '+34', local: phone };
}

export const SELECT_CLS = 'shrink-0 px-2 py-2.5 text-sm rounded-l-lg border border-r-0 bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer';
export const NUMBER_CLS = 'flex-1 min-w-0 px-4 py-2.5 text-sm rounded-r-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';

const NIF_REGEX   = /^[0-9XYZxyz][0-9]{7}[A-Za-z]$|^[A-HJ-NP-SUVWa-hj-np-suvw][0-9]{7}[0-9A-Ja-j]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CP_REGEX    = /^[0-9]{5}$/;
const CUPS_REGEX  = /^ES[0-9]{16}[A-Za-z]{2}[0-9A-Za-z]{0,2}$/i;

export interface ClientFormValues {
  clientNif:   string;
  clientName:  string;
  email:       string;
  phoneNumber: string;
}

export function computeClientErrors(v: ClientFormValues) {
  return {
    clientNif:   !NIF_REGEX.test(v.clientNif.trim()),
    clientName:  v.clientName.trim().length < 2,
    email:       !EMAIL_REGEX.test(v.email.trim()),
    phoneNumber: !/^[0-9]{9,15}$/.test(v.phoneNumber.replace(/\s/g, '')),
  };
}

export interface SupplyFormValues {
  cups:          string;
  supplyAddress: string;
  province:      string;
  city:          string;
  postalCode:    string;
}

export function computeSupplyErrors(v: SupplyFormValues) {
  return {
    cups:          !CUPS_REGEX.test(v.cups.trim()),
    supplyAddress: v.supplyAddress.trim().length < 3,
    province:      v.province.trim().length < 2,
    city:          v.city.trim().length < 2,
    postalCode:    !CP_REGEX.test(v.postalCode.trim()),
  };
}

export function computeDocumentErrors(
  docs: OfferRequestDocuments,
  requiredDocs: DocSlot[],
): Record<OfferRequestDocumentKey, boolean> {
  return Object.fromEntries(
    requiredDocs.map(slot => [slot.key, !docs[slot.key]]),
  ) as Record<OfferRequestDocumentKey, boolean>;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Builds a single-line address string from the OCR-detected address fields. */
export function buildAddressFromOcr(
  direccion: NonNullable<NonNullable<OcrResult['cliente']>['direccion']> | undefined,
): string {
  if (!direccion) return '';
  const partes = [
    direccion.tipo_via,
    direccion.nombre_via,
    direccion.numero,
    direccion.detalles,
  ].map(s => (s ?? '').toString().trim()).filter(Boolean);
  return partes.join(' ');
}
