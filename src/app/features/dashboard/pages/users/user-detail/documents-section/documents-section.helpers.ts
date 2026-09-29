import { ContractDocument, UserDetail } from '../../../../../../core/models/user-detail.model';
import { REQUIRED_DOCS_BY_PERSON_TYPE, OPTIONAL_DOCS_BY_PERSON_TYPE } from '../configs/doc-by-person-type.config';
import { DOC_TYPE_LABELS } from '../configs/doc-type-labels.config';
import { DOC_STATUS_CONFIG } from '../configs/doc-status.config';

/**
 * Pure helpers extracted from DocumentsSectionComponent (R1): document-slot
 * building and small label/status lookups, with no Angular DI and no
 * component state, so they can be unit-tested and reused independently.
 */

export interface DocSlot {
  type:       string;
  label:      string;
  doc:        ContractDocument | null;
  isOptional: boolean;
}

/** All slots: required + optional (always visible) + extra uploaded (SignedContract etc.). */
export function buildDocSlots(user: UserDetail | null): DocSlot[] {
  const contract = user?.contract;
  if (!user?.customer) return [];
  const required = contract?.documents.required
    ?? REQUIRED_DOCS_BY_PERSON_TYPE[user.customer.personType]
    ?? [];
  const requiredSet = new Set(required);
  const optional = (OPTIONAL_DOCS_BY_PERSON_TYPE[user.customer.personType] ?? [])
    .filter(t => !requiredSet.has(t));
  const uploadedMap = new Map(
    (contract?.documents.uploaded ?? []).map(d => [d.documentType, d]),
  );
  const slots: DocSlot[] = [
    ...required.map(type => ({
      type, label: DOC_TYPE_LABELS[type] ?? type,
      doc: uploadedMap.get(type) ?? null, isOptional: false,
    })),
    ...optional.map(type => ({
      type, label: DOC_TYPE_LABELS[type] ?? type,
      doc: uploadedMap.get(type) ?? null, isOptional: true,
    })),
  ];
  const knownSet = new Set([...required, ...optional]);
  for (const [type, doc] of uploadedMap) {
    if (!knownSet.has(type)) {
      slots.push({ type, label: DOC_TYPE_LABELS[type] ?? type, doc, isOptional: false });
    }
  }
  return slots;
}

/** Required document types still missing (or rejected) for the given user. */
export function getPendingRequiredTypes(user: UserDetail | null): string[] {
  const contract = user?.contract;
  if (!user?.customer) return [];
  const required = contract?.documents.required
    ?? REQUIRED_DOCS_BY_PERSON_TYPE[user.customer.personType]
    ?? [];
  const done = new Set(
    (contract?.documents.uploaded ?? [])
      .filter(d => d.status !== 'Rejected')
      .map(d => d.documentType),
  );
  return required.filter(t => !done.has(t));
}

export function getDocTypeLabel(type: string): string {
  return DOC_TYPE_LABELS[type] ?? type;
}

export function getDocStatusConfig(status: string) {
  return DOC_STATUS_CONFIG[status] ?? null;
}

export function isDocReviewable(status: string): boolean {
  return status !== 'Validated' && status !== 'Rejected' && status !== 'Signed';
}

/** Master can upload the physical signed contract when it doesn't exist yet or was rejected. */
export function computeCanUploadSignedContract(user: UserDetail | null): boolean {
  const contract = user?.contract;
  if (!contract) return false;
  const existing = contract.documents.uploaded.find(d => d.documentType === 'SignedContract');
  return !existing || existing.status === 'Rejected';
}
