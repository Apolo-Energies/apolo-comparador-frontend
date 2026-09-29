import { ContractDetail, UserDetail } from '../../../../../core/models/user-detail.model';
import { UserRole, UserRoleLabel } from '../../../../../core/models/user-role';
import { REQUIRED_DOCS_BY_PERSON_TYPE } from './configs/doc-by-person-type.config';

/**
 * Pure, framework-free helpers for `UserDetailPageComponent`: row building
 * for the two data cards and the document-upload progress calculation.
 * No Angular, no HTTP — only mapping over the already-loaded `UserDetail`.
 */

export type DataRow = [string, string];

/** "Vence en N días" / "Vencido" / "Sin vencimiento" label for a contract end date. */
export function formatVigencia(endDate: string | null): string {
  if (!endDate) return 'Sin vencimiento';
  const d = new Date(endDate);
  const diff = d.getTime() - Date.now();
  if (diff < 0) return 'Vencido';
  const days = Math.ceil(diff / 86_400_000);
  return `Vence en ${days} día${days === 1 ? '' : 's'}`;
}

/** Rows for the "Datos Personales" card — differs for Company vs Individual customers. */
export function buildPersonalDataRows(user: UserDetail | null): DataRow[] {
  const c = user?.customer;
  const contract = user?.contract;

  const estadoContrato: DataRow = ['Estado contrato', contract?.isActive ? 'Activo' : 'Inactivo'];
  const vigencia: DataRow = ['Vigencia', formatVigencia(contract?.endDate ?? null)];

  if (c?.personType === 'Company') {
    const representante = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '-';
    return [
      ['Razón social',            c.companyName             ?? '-'],
      ['CIF',                     c.cif                     ?? '-'],
      ['Tipo de cliente',         'Empresa'],
      ['Correo',                  c.email                   ?? '-'],
      ['Representante legal',     representante],
      ['DNI representante legal', c.dni                     ?? '-'],
      ['Teléfono',                c.phone                   ?? '-'],
      ['Dirección legal',         c.legalAddress            ?? '-'],
      ['Ciudad legal',            c.cityLegal               ?? '-'],
      ['CP legal',                c.postalCodeLegal         ?? '-'],
      ['Dirección notificación',  c.notificationAddress     ?? '-'],
      ['Ciudad notificación',     c.cityNotification        ?? '-'],
      ['CP notificación',         c.postalCodeNotification  ?? '-'],
      estadoContrato,
      vigencia,
    ];
  }

  const fullName = `${c?.firstName ?? ''} ${c?.lastName ?? ''} ${c?.secondLastName ?? ''}`.trim() || '-';
  return [
    ['Nombre',                 fullName],
    ['DNI',                    c?.dni                    ?? '-'],
    ['Tipo de cliente',        'Individual'],
    ['Correo',                 c?.email                  ?? '-'],
    ['Teléfono',               c?.phone                  ?? '-'],
    ['Dirección legal',        c?.legalAddress           ?? '-'],
    ['Ciudad legal',           c?.cityLegal              ?? '-'],
    ['CP legal',               c?.postalCodeLegal        ?? '-'],
    ['Dirección notificación', c?.notificationAddress    ?? '-'],
    ['Ciudad notificación',    c?.cityNotification       ?? '-'],
    ['CP notificación',        c?.postalCodeNotification ?? '-'],
    estadoContrato,
    vigencia,
  ];
}

/** Rows for the "Datos de Usuario" card. */
export function buildUserDataRows(user: UserDetail | null): DataRow[] {
  return [
    ['Nombre completo',  user?.fullName                          ?? '-'],
    ['Correo de acceso', user?.email                             ?? '-'],
    ['Teléfono',         user?.phone                             ?? '-'],
    ['Rol',              UserRoleLabel[user?.role as UserRole]    ?? '-'],
    ['Estado',           user?.isActive ? 'Activo' : 'Inactivo'],
    ['Identificador',    user?.identifier                         ?? '-'],
  ];
}

/** Document upload progress based on personType's required list (works even without a contract). */
export function computeDocUploadProgress(user: UserDetail | null): { count: number; total: number; pct: number } {
  if (!user?.customer) return { count: 0, total: 0, pct: 0 };
  const contract = user.contract;
  const required = (contract?.documents.required.length
    ? contract.documents.required
    : REQUIRED_DOCS_BY_PERSON_TYPE[user.customer.personType]) ?? [];
  if (required.length === 0) return { count: 0, total: 0, pct: 0 };
  const uploaded = contract?.documents.uploaded ?? [];
  const done = new Set(
    uploaded.filter(d => d.status !== 'Rejected').map(d => d.documentType),
  );
  const count = required.filter(t => done.has(t)).length;
  return { count, total: required.length, pct: Math.round((count / required.length) * 100) };
}

/** Whether every required document has been validated. */
export function computeAllDocsVerified(contract: ContractDetail | null | undefined): boolean {
  if (!contract) return false;
  const required = contract.documents.required;
  if (required.length === 0) return false;
  const approvedTypes = new Set(
    contract.documents.uploaded
      .filter(d => d.status === 'Validated')
      .map(d => d.documentType),
  );
  return required.every(type => approvedTypes.has(type));
}
