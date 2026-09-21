import { TemplateRef } from '@angular/core';
import { TableColumn } from '@apolo-energies/table';
import { ComboboxOption, SelectOption } from '@apolo-energies/ui';
import { PotentialParent } from '../../../../core/models/user.model';
import { getRoleLabel, UserRole } from '../../../../core/models/user-role';
import { UserRow, SubUserSummary } from './user-actions-menu/user-actions-menu.component';

/**
 * Pure helpers extracted from UsersPageComponent (R1): column building, row
 * mapping and small formatting/label utilities with no Angular DI and no
 * component state, so they can be unit-tested and reused independently.
 */

// ─── Contract status label ──────────────────────────────────────────────────

const CONTRACT_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  Pending:      { label: 'Pendiente',       cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  Signed:       { label: 'Firmado',         cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  Declined:     { label: 'Cancelado',       cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  Expired:      { label: 'Vencido',         cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  InProgress:   { label: 'En firma',        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  ReadyToSign:  { label: 'Listo p/firma',   cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  DocsPending:  { label: 'Docs pendientes', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  Active:       { label: 'Activo',          cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  ExpiringSoon: { label: 'Por vencer',      cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  NoContract:   { label: 'Sin contrato',    cls: 'bg-muted text-muted-foreground' },
};

export function getContractStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Sin contrato';
  return CONTRACT_STATUS_MAP[status]?.label ?? status;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function formatUserCreatedAt(iso: string | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('es-ES', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// ─── Row helpers ─────────────────────────────────────────────────────────────

export function mapSubUserToRow(sub: SubUserSummary): UserRow {
  return {
    id:             sub.id,
    fullName:       sub.fullName,
    email:          sub.email,
    phone:          null,
    role:           sub.role,
    isActive:       sub.isActive,
    isEnergyExpert: false,
    commissions:    [],
    providerId:     sub.providerId,
    provider:       null,
    isSubUser:      true,
  };
}

function checkIsMasterRow(row: UserRow): boolean {
  return row.role === UserRole.MASTER || row.role === 'Master';
}

export function canUserReceiveCommercials(row: UserRow): boolean {
  return row.role === UserRole.COLLABORATOR
      || row.role === UserRole.COLLABORATOR_REFERRER
      || row.role === 'Colaborador'
      || row.role === 'Colaborador - Referenciador';
}

export function computeRowExpandable(row: UserRow): boolean {
  if (checkIsMasterRow(row)) return false;
  if (canUserReceiveCommercials(row)) return true;
  return (row.subUsers?.length ?? 0) > 0;
}

export function computeRowExpandBadge(row: UserRow): number | null {
  if (checkIsMasterRow(row)) return null;
  const count = row.subUsers?.length ?? 0;
  return count > 0 ? count : null;
}

// ─── Role options (kept for API-compat; currently unused by the template) ──

export const ROLE_OPTIONS: SelectOption[] = [
  { value: 'Master',        label: 'Master' },
  { value: 'Colaborador',   label: 'Colaborador' },
  { value: 'Referenciador', label: 'Referenciador' },
  { value: 'Tester',        label: 'Tester' },
];

// ─── Combobox options ────────────────────────────────────────────────────────

export function buildParentComboboxOptions(parents: PotentialParent[]): ComboboxOption[] {
  return [
    { id: '', name: 'Todos' },
    ...parents.map(p => ({ id: p.id, name: p.fullName })),
  ];
}

export function buildBulkParentComboboxOptions(parents: PotentialParent[]): ComboboxOption[] {
  return [
    { id: '__unassign__', name: '— Sin asignar —' },
    ...parents.map(p => ({ id: p.id, name: p.fullName })),
  ];
}

// ─── Table columns ───────────────────────────────────────────────────────────

/** Columns used when the tenant does not have the Apolo user-detail feature enabled. */
export const BASIC_USER_COLUMNS: TableColumn<UserRow>[] = [
  { key: 'fullName',       label: 'Nombre' },
  { key: 'email',          label: 'Email', textColor: 'text-muted-foreground' },
  { key: 'role',           label: 'Rol',           align: 'center', format: row => getRoleLabel(row.role) },
  { key: 'isActive',       label: 'Estado',        align: 'center', format: row => row.isActive ? 'Activo' : 'Inactivo' },
  { key: 'isEnergyExpert', label: 'Energy Expert', align: 'center', format: row => row.isEnergyExpert ? 'Sí' : 'No' },
  { key: 'commissions',    label: 'Comisión',      align: 'center', format: row => row.commissions?.find(c => c.isActive)?.commissionType?.name ?? '-' },
  { key: 'createdAt',      label: 'Fecha de alta' },
];

/** Adds the header cell template and trailing actions column to the basic (non-Apolo) columns. */
export function appendBasicColumnsExtras(
  cols: TableColumn<UserRow>[],
  createdAtCellTpl: TemplateRef<{ $implicit: UserRow }>,
  actionsTpl: TemplateRef<{ $implicit: UserRow }>,
): TableColumn<UserRow>[] {
  return cols.map(col =>
    col.key === 'createdAt' ? { ...col, cellTemplate: createdAtCellTpl } : col
  ).concat([{ key: 'actions', label: '', align: 'center', cellTemplate: actionsTpl }]);
}

export interface ApoloColumnTemplates {
  selectCellTpl:       TemplateRef<{ $implicit: UserRow }>;
  nameHeaderTpl:       TemplateRef<void>;
  identifierHeaderTpl: TemplateRef<void>;
  emailHeaderTpl:      TemplateRef<void>;
  phoneHeaderTpl:      TemplateRef<void>;
  roleHeaderTpl:       TemplateRef<void>;
  parentCellTpl:       TemplateRef<{ $implicit: UserRow }>;
  parentHeaderTpl:     TemplateRef<void>;
  contractStatusTpl:   TemplateRef<{ $implicit: UserRow }>;
  commissionHeaderTpl: TemplateRef<void>;
  createdAtCellTpl:    TemplateRef<{ $implicit: UserRow }>;
  actionsTpl:          TemplateRef<{ $implicit: UserRow }>;
}

/** Full column set used for the Apolo user-detail table, including the bulk-select column for Masters. */
export function buildApoloColumns(t: ApoloColumnTemplates, isMasterUser: boolean): TableColumn<UserRow>[] {
  const cols: TableColumn<UserRow>[] = [];

  if (isMasterUser) {
    cols.push({ key: '_select', label: '', align: 'center', cellTemplate: t.selectCellTpl });
  }

  cols.push(
    { key: 'fullName',                label: 'Razón Social',    headerIconTemplate: t.nameHeaderTpl },
    { key: 'customer',                label: 'SIPS/DNI',        headerIconTemplate: t.identifierHeaderTpl, format: row => {
        const c = row.customer;
        if (!c) return '-';
        return c.personType === 'Individual' ? (c.dni ?? '-') : (c.cif ?? '-');
      }
    },
    { key: 'email',                   label: 'Email',           headerIconTemplate: t.emailHeaderTpl },
    { key: 'phone',                   label: 'Teléfono',        headerIconTemplate: t.phoneHeaderTpl, format: row => row.phone || '-' },
    { key: 'role',                    label: 'Rol',             align: 'center', format: row => getRoleLabel(row.role), headerIconTemplate: t.roleHeaderTpl },
    { key: 'parentFullName',          label: 'Asignado a',      align: 'center', cellTemplate: t.parentCellTpl, headerIconTemplate: t.parentHeaderTpl },
    { key: 'contractSignatureStatus', label: 'Estado Contrato', align: 'center', cellTemplate: t.contractStatusTpl },
    { key: 'isEnergyExpert',          label: 'Energy Expert',   align: 'center', format: row => row.isEnergyExpert ? 'Sí' : 'No' },
    { key: 'commissions',             label: 'Comisión',        align: 'center', headerIconTemplate: t.commissionHeaderTpl, format: row => row.commissions?.find(c => c.isActive)?.commissionType?.name ?? '-' },
    { key: 'provider',                label: 'Proveedor',       align: 'center', format: row => row.provider?.name ?? '-' },
    { key: 'isActive',                label: 'Estado Usuario',  align: 'center', format: row => row.isActive ? 'Activo' : 'Inactivo' },
    { key: 'createdAt',               label: 'Fecha de alta',   cellTemplate: t.createdAtCellTpl },
    { key: 'actions',                 label: '',                align: 'center', cellTemplate: t.actionsTpl },
  );

  return cols;
}
