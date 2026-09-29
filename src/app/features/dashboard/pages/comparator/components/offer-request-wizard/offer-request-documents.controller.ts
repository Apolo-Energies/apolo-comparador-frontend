import { computed, signal } from '@angular/core';
import { OfferPersonType, OfferRequestDocumentKey, OfferRequestDocuments } from '../../../../../../core/models/offer-request.model';
import { computeDocumentErrors, DocSlot, formatFileSize, requiredDocsFor } from './offer-request-wizard.helpers';

export interface OfferRequestDocumentsDeps {
  personType:        () => OfferPersonType;
  documentsOptional:  () => boolean;
}

/**
 * State and handlers for the "Documentación" wizard step: which documents
 * are required for the current person type, the attached files and their
 * validation. Plain class without Angular DI, instantiated by
 * `OfferRequestWizardComponent`.
 */
export class OfferRequestDocumentsController {
  readonly documents = signal<OfferRequestDocuments>({});

  readonly requiredDocs = computed<DocSlot[]>(() => requiredDocsFor(this.deps.personType()));

  readonly documentErrors = computed(() =>
    computeDocumentErrors(this.documents(), this.requiredDocs()),
  );

  readonly documentStepValid = computed(() => {
    if (this.deps.documentsOptional()) return true;
    return Object.values(this.documentErrors()).every(v => !v);
  });

  constructor(private readonly deps: OfferRequestDocumentsDeps) {}

  reset(): void {
    this.documents.set({});
  }

  onFileSelected(key: OfferRequestDocumentKey, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;
    this.documents.update(d => ({ ...d, [key]: file }));
  }

  removeDocument(key: OfferRequestDocumentKey): void {
    this.documents.update(d => {
      const next = { ...d };
      delete next[key];
      return next;
    });
  }

  formatFileSize(bytes: number): string {
    return formatFileSize(bytes);
  }
}
