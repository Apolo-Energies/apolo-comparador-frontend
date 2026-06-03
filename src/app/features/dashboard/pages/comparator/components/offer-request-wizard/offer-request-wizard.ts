import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { AlertService, ButtonComponent, DialogComponent, InputFieldComponent } from '@apolo-energies/ui';
import { OfferRequestService } from '../../../../../../services/offer-request.service';
import {
  CreateOfferRequestPayload,
  OfferPersonType,
  OfferRequestClientData,
  OfferRequestDocumentKey,
  OfferRequestDocuments,
  OfferRequestSupplyData,
} from '../../../../../../entities/offer-request.model';
import { OcrResult } from '../../comparator.models';
import { environment } from '../../../../../../../environments/environment';

type WizardStep = 1 | 2 | 3 | 4;

interface DocSlot {
  key:   OfferRequestDocumentKey;
  label: string;
}

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.bmp,.tiff,.heic';

const INDIVIDUAL_DOCS: DocSlot[] = [
  { key: 'dniFront',      label: 'DNI delante' },
  { key: 'dniBack',       label: 'DNI atrás' },
  { key: 'bankStatement', label: 'Certificado de cuenta bancaria (titular)' },
];

const COMPANY_DOCS: DocSlot[] = [
  { key: 'incorporationDeed', label: 'Escrituras' },
  { key: 'cifCertificate',    label: 'CIF' },
  { key: 'administratorDni',  label: 'DNI del Administrador o Apoderado' },
  { key: 'bankStatement',     label: 'Certificado de cuenta bancaria (empresa)' },
];

const PHONE_COUNTRIES = [
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

const PHONE_SPLIT_CODES = PHONE_COUNTRIES.slice().sort((a, b) => b.code.length - a.code.length);

function splitPhone(phone: string): { code: string; local: string } {
  if (!phone) return { code: '+34', local: '' };
  const match = PHONE_SPLIT_CODES.find(c => phone.startsWith(c.code));
  return match ? { code: match.code, local: phone.slice(match.code.length) } : { code: '+34', local: phone };
}

const SELECT_CLS = 'shrink-0 px-2 py-2.5 text-sm rounded-l-lg border border-r-0 bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer';
const NUMBER_CLS = 'flex-1 min-w-0 px-4 py-2.5 text-sm rounded-r-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';

const NIF_REGEX   = /^[0-9XYZxyz][0-9]{7}[A-Za-z]$|^[A-HJ-NP-SUVWa-hj-np-suvw][0-9]{7}[0-9A-Ja-j]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CP_REGEX    = /^[0-9]{5}$/;
const CUPS_REGEX  = /^ES[0-9]{16}[A-Za-z]{2}[0-9A-Za-z]{0,2}$/i;

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

  // Cliente
  readonly clientNif   = signal('');
  readonly clientName  = signal('');
  readonly email       = signal('');
  readonly countryCode = signal('+34');
  readonly phoneNumber = signal('');

  // Suministro
  readonly cups          = signal('');
  readonly supplyAddress = signal('');
  readonly cnae          = signal('');
  readonly province      = signal('');
  readonly city          = signal('');
  readonly postalCode    = signal('');

  // Documentos
  readonly documents = signal<OfferRequestDocuments>({});

  readonly phoneCountries = PHONE_COUNTRIES;
  readonly selectCls      = SELECT_CLS;
  readonly numberCls      = NUMBER_CLS;
  readonly acceptedTypes  = ACCEPTED_TYPES;

  // ── computed ───────────────────────────────────────────────────────────────
  readonly requiredDocs = computed<DocSlot[]>(() =>
    this.personType() === 'Company' ? COMPANY_DOCS : INDIVIDUAL_DOCS
  );

  readonly clientErrors = computed(() => ({
    clientNif:   !NIF_REGEX.test(this.clientNif().trim()),
    clientName:  this.clientName().trim().length < 2,
    email:       !EMAIL_REGEX.test(this.email().trim()),
    phoneNumber: !/^[0-9]{9,15}$/.test(this.phoneNumber().replace(/\s/g, '')),
  }));

  readonly supplyErrors = computed(() => ({
    cups:          !CUPS_REGEX.test(this.cups().trim()),
    supplyAddress: this.supplyAddress().trim().length < 3,
    province:      this.province().trim().length < 2,
    city:          this.city().trim().length < 2,
    postalCode:    !CP_REGEX.test(this.postalCode().trim()),
  }));

  readonly documentErrors = computed(() => {
    const docs = this.documents();
    return Object.fromEntries(
      this.requiredDocs().map(slot => [slot.key, !docs[slot.key]])
    ) as Record<OfferRequestDocumentKey, boolean>;
  });

  readonly clientStepValid   = computed(() => Object.values(this.clientErrors()).every(v => !v));
  readonly supplyStepValid   = computed(() => Object.values(this.supplyErrors()).every(v => !v));
  readonly documentStepValid = computed(() => {
    if (this.documentsOptional()) return true;
    return Object.values(this.documentErrors()).every(v => !v);
  });

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
    this.documents.set({});
  }

  onFileSelected(key: OfferRequestDocumentKey, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;
    this.documents.update(d => ({ ...d, [key]: file }));
  }

  removeDocument(key: OfferRequestDocumentKey) {
    this.documents.update(d => {
      const next = { ...d };
      delete next[key];
      return next;
    });
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
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  // ── private ────────────────────────────────────────────────────────────────

  private submit() {
    if (this.submitting()) return;

    const payload: CreateOfferRequestPayload = {
      personType: this.personType(),
      client: this.buildClient(),
      supply: this.buildSupply(),
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

  private buildClient(): OfferRequestClientData {
    return {
      clientNif:  this.clientNif().trim(),
      clientName: this.clientName().trim(),
      email:      this.email().trim(),
      phone:      this.countryCode() + this.phoneNumber().replace(/\s/g, ''),
    };
  }

  private buildSupply(): OfferRequestSupplyData {
    return {
      cups:          this.cups().trim(),
      supplyAddress: this.supplyAddress().trim(),
      cnae:          this.cnae().trim(),
      province:      this.province().trim(),
      city:          this.city().trim(),
      postalCode:    this.postalCode().trim(),
    };
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
    const ocr = this.ocrResult();

    this.step.set(1);
    this.submitting.set(false);
    this.touched.set({});
    this.documents.set({});
    this.personType.set('Individual');

    const cliente   = ocr?.cliente;
    const direccion = cliente?.direccion;

    this.clientNif.set(cliente?.nif ?? '');
    this.clientName.set(cliente?.titular ?? '');
    this.email.set('');
    this.countryCode.set('+34');
    this.phoneNumber.set('');

    this.cups.set(cliente?.cups ?? '');
    this.supplyAddress.set(this.buildAddressFromOcr(direccion));
    this.cnae.set('');
    this.province.set(direccion?.provincia ?? '');
    this.city.set('');
    this.postalCode.set(direccion?.cp ?? '');
  }

  private buildAddressFromOcr(direccion: NonNullable<NonNullable<OcrResult['cliente']>['direccion']> | undefined): string {
    if (!direccion) return '';
    const partes = [
      direccion.tipo_via,
      direccion.nombre_via,
      direccion.numero,
      direccion.detalles,
    ].map(s => (s ?? '').toString().trim()).filter(Boolean);
    return partes.join(' ');
  }
}
