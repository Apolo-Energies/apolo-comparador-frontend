import { computed, signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { LandingDetail, LandingPayload } from '../../../../core/models/landing.model';

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const STEP1_FIELDS = ['slug', 'name', 'productId', 'heroTitle', 'heroSubtitle', 'formTitle', 'formSubtitle'];

export type Section = 'general' | 'images';

export interface FormControllerContext {
  isEdit: () => boolean;
}

/**
 * Estado y validación del formulario de datos generales de una landing
 * (paso 1 del wizard de creación / pestaña "Datos generales" en edición).
 * Clase plana sin DI de Angular, instanciada por `LandingFormDialogComponent`.
 */
export class FormController {
  readonly section    = signal<Section>('general');
  readonly slug         = signal('');
  readonly name         = signal('');
  readonly productId    = signal<number | null>(null);
  readonly heroTitle    = signal('');
  readonly heroSubtitle = signal('');
  readonly formTitle    = signal('');
  readonly formSubtitle = signal('');
  readonly touched      = signal<Record<string, boolean>>({});

  readonly errors = computed(() => ({
    slug:         !SLUG_REGEX.test(this.slug().trim()) || this.slug().trim().length > 80,
    name:         this.name().trim().length === 0 || this.name().trim().length > 120,
    productId:    this.productId() == null,
    heroTitle:    this.heroTitle().trim().length === 0 || this.heroTitle().trim().length > 200,
    heroSubtitle: this.heroSubtitle().trim().length === 0 || this.heroSubtitle().trim().length > 500,
    formTitle:    this.formTitle().length > 200,
    formSubtitle: this.formSubtitle().length > 500,
  }));

  readonly formValid = computed(() => Object.values(this.errors()).every(v => !v));

  readonly isStep1 = computed(() => this.section() === 'general');
  readonly isStep2 = computed(() => this.section() === 'images');

  readonly step1Errors = computed(() => {
    const e = this.errors() as Record<string, boolean>;
    return STEP1_FIELDS.some(f => e[f]);
  });

  constructor(
    private readonly alert: AlertService,
    private readonly ctx: FormControllerContext,
  ) {}

  isFieldInvalid(field: string): boolean {
    const e = this.errors() as Record<string, boolean>;
    return !!this.touched()[field] && !!e[field];
  }

  markTouched(field: string): void {
    this.touched.update(t => ({ ...t, [field]: true }));
  }

  markAllTouched(): void {
    Object.keys(this.errors()).forEach(k => this.markTouched(k));
  }

  setSection(s: Section): void {
    if (s === 'images' && !this.ctx.isEdit()) return;
    this.section.set(s);
  }

  onProductChange(value: string): void {
    this.productId.set(value ? Number(value) : null);
    this.markTouched('productId');
  }

  goToStep2(): void {
    STEP1_FIELDS.forEach(k => this.markTouched(k));
    if (this.step1Errors()) {
      this.alert.show('Revisa los campos antes de continuar.', 'error', 3500);
      return;
    }
    this.section.set('images');
  }

  goBackToStep1(): void {
    this.section.set('general');
  }

  reset(): void {
    this.section.set('general');
    this.slug.set('');
    this.name.set('');
    this.productId.set(null);
    this.heroTitle.set('');
    this.heroSubtitle.set('');
    this.formTitle.set('');
    this.formSubtitle.set('');
    this.touched.set({});
  }

  populateFromDetail(detail: LandingDetail): void {
    this.slug.set(detail.slug);
    this.name.set(detail.name);
    this.productId.set(detail.productId);
    this.heroTitle.set(detail.heroTitle);
    this.heroSubtitle.set(detail.heroSubtitle);
    this.formTitle.set(detail.formTitle ?? '');
    this.formSubtitle.set(detail.formSubtitle ?? '');
  }

  buildPayload(): LandingPayload {
    return {
      slug:         this.slug().trim(),
      name:         this.name().trim(),
      productId:    this.productId() as number,
      heroTitle:    this.heroTitle().trim(),
      heroSubtitle: this.heroSubtitle().trim(),
      formTitle:    this.formTitle().trim() || undefined,
      formSubtitle: this.formSubtitle().trim() || undefined,
    };
  }
}
