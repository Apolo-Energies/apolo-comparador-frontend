import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { AlertService, ButtonComponent, DialogComponent, InputFieldComponent } from '@apolo-energies/ui';
import { OfferRequestService } from '../../../../../../core/services/offer-request.service';
import {
  CreateOfferRequestPayload,
  OfferPersonType,
  OfferRequestDocumentKey,
} from '../../../../../../core/models/offer-request.model';
import { OcrResult } from '../../../../../../core/models/comparator.model';
import { environment } from '../../../../../../../environments/environment';
import { ACCEPTED_TYPES, NUMBER_CLS, PHONE_COUNTRIES, SELECT_CLS } from './offer-request-wizard.helpers';
import { OfferRequestDocumentsController } from './offer-request-documents.controller';
import { OfferRequestClientSupplyController } from './offer-request-client-supply.controller';

type WizardStep = 1 | 2 | 3 | 4;

@Component({
  selector: 'app-offer-request-wizard',
  standalone: true,
  imports: [DialogComponent, InputFieldComponent, ButtonComponent],
  templateUrl: './offer-request-wizard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferRequestWizardComponent {
  // ── inputs ─────────────────────────────────────────────────────────────────
  readonly open              = input(false);
  readonly ocrResult         = input<OcrResult | null>(null);
  readonly opportunityId     = input<string | null>(null);
  readonly tariff            = input<string | null>(null);
  readonly product           = input<string | null>(null);
  readonly isPublic          = input(false);
  readonly documentsOptional = input(false);
  readonly landingSlug       = input<string | null>(null);
  readonly brandLogoUrl      = input<string>('/apolo/Isotipo_Oscuro.svg');
  readonly brandName         = input<string>(environment.appTitle);

  // ── outputs ────────────────────────────────────────────────────────────────
  readonly openChange = output<boolean>();
  readonly submitted  = output<{ id: string }>();

  private readonly offerService = inject(OfferRequestService);
  private readonly alert        = inject(AlertService);

  // ── state ──────────────────────────────────────────────────────────────────
  readonly step       = signal<WizardStep>(1);
  readonly submitting = signal(false);
  readonly touched    = signal<Record<string, boolean>>({});

  readonly personType = signal<OfferPersonType>('Individual');

  readonly phoneCountries = PHONE_COUNTRIES;
  readonly selectCls      = SELECT_CLS;
  readonly numberCls      = NUMBER_CLS;
  readonly acceptedTypes  = ACCEPTED_TYPES;

  // ── controllers: paso cliente+suministro y paso documentación ──────────────
  private readonly clientSupplyCtrl = new OfferRequestClientSupplyController();
  private readonly docsCtrl = new OfferRequestDocumentsController({
    personType:        () => this.personType(),
    documentsOptional: () => this.documentsOptional(),
  });

  // Signals expuestos por referencia directa (mismo objeto) para no tocar el .html existente.
  readonly clientNif   = this.clientSupplyCtrl.clientNif;
  readonly clientName  = this.clientSupplyCtrl.clientName;
  readonly email       = this.clientSupplyCtrl.email;
  readonly countryCode = this.clientSupplyCtrl.countryCode;
  readonly phoneNumber = this.clientSupplyCtrl.phoneNumber;

  readonly cups          = this.clientSupplyCtrl.cups;
  readonly supplyAddress = this.clientSupplyCtrl.supplyAddress;
  readonly cnae          = this.clientSupplyCtrl.cnae;
  readonly province      = this.clientSupplyCtrl.province;
  readonly city          = this.clientSupplyCtrl.city;
  readonly postalCode    = this.clientSupplyCtrl.postalCode;

  readonly clientErrors     = this.clientSupplyCtrl.clientErrors;
  readonly supplyErrors     = this.clientSupplyCtrl.supplyErrors;
  readonly clientStepValid  = this.clientSupplyCtrl.clientStepValid;
  readonly supplyStepValid  = this.clientSupplyCtrl.supplyStepValid;

  readonly documents         = this.docsCtrl.documents;
  readonly requiredDocs      = this.docsCtrl.requiredDocs;
  readonly documentErrors    = this.docsCtrl.documentErrors;
  readonly documentStepValid = this.docsCtrl.documentStepValid;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      if (!isOpen) return;
      untracked(() => this.applyOcrPrefill());
    }, { allowSignalWrites: true });
  }

  // ── handlers ───────────────────────────────────────────────────────────────

  onPersonTypeChange(type: OfferPersonType) {
    this.personType.set(type);
    this.docsCtrl.reset();
  }

  onFileSelected(key: OfferRequestDocumentKey, event: Event) {
    this.docsCtrl.onFileSelected(key, event);
  }

  removeDocument(key: OfferRequestDocumentKey) {
    this.docsCtrl.removeDocument(key);
  }

  goNext() {
    const current = this.step();
    if (current === 1) {
      this.markStepTouched('client');
      if (!this.clientStepValid()) return;
      this.step.set(2);
      return;
    }
    if (current === 2) {
      this.markStepTouched('supply');
      if (!this.supplyStepValid()) return;
      this.step.set(3);
      return;
    }
    if (current === 3) {
      this.markStepTouched('documents');
      if (!this.documentStepValid()) {
        this.alert.show('Adjunta toda la documentación requerida.', 'error', 4000);
        return;
      }
      this.submit();
    }
  }

  goBack() {
    const current = this.step();
    if (current === 2) this.step.set(1);
    else if (current === 3) this.step.set(2);
  }

  close() {
    if (this.submitting()) return;
    this.openChange.emit(false);
  }

  isTouched(field: string): boolean {
    return !!this.touched()[field];
  }

  formatFileSize(bytes: number): string {
    return this.docsCtrl.formatFileSize(bytes);
  }

  // ── private ────────────────────────────────────────────────────────────────

  private submit() {
    if (this.submitting()) return;

    const payload: CreateOfferRequestPayload = {
      personType: this.personType(),
      client: this.clientSupplyCtrl.buildClient(),
      supply: this.clientSupplyCtrl.buildSupply(),
      documents: this.documents(),
      opportunityId: this.opportunityId() || undefined,
      tariff:        this.tariff()        || undefined,
      product:       this.product()       || undefined,
      landingSlug:   this.landingSlug()   || undefined,
    };

    this.submitting.set(true);
    this.offerService.create(payload, this.isPublic()).subscribe({
      next: res => {
        this.submitting.set(false);
        this.step.set(4);
        this.submitted.emit({ id: res.id });
      },
      error: err => {
        this.submitting.set(false);
        const message = err?.error?.message
          ?? 'No se pudo enviar la solicitud. Inténtalo de nuevo.';
        this.alert.show(message, 'error', 5000);
      },
    });
  }

  private markStepTouched(scope: 'client' | 'supply' | 'documents') {
    const fields = scope === 'client'
      ? ['clientNif', 'clientName', 'email', 'phoneNumber']
      : scope === 'supply'
        ? ['cups', 'supplyAddress', 'province', 'city', 'postalCode']
        : this.requiredDocs().map(d => d.key);
    this.touched.update(t => {
      const next = { ...t };
      for (const f of fields) next[f] = true;
      return next;
    });
  }

  private applyOcrPrefill() {
    this.step.set(1);
    this.submitting.set(false);
    this.touched.set({});
    this.docsCtrl.reset();
    this.personType.set('Individual');
    this.clientSupplyCtrl.prefillFromOcr(this.ocrResult());
  }
}
