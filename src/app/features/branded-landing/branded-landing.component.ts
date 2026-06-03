import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ComparatorService } from '../../services/comparator.service';
import { PublicComparatorService } from '../../services/public-comparator.service';
import { LandingService } from '../../services/landing.service';
import { ComparatorUploadComponent } from '../dashboard/pages/comparator/components/comparator-upload/comparator-upload';
import { ComparatorModalComponent } from '../dashboard/pages/comparator/components/comparator-modal/comparator-modal';
import { OfferRequestWizardComponent } from '../dashboard/pages/comparator/components/offer-request-wizard/offer-request-wizard';
import { BrandLoaderComponent } from '../../shared/components/brand-loader/brand-loader.component';
import {
  ComparadorCompareEvent,
  ComparadorFormValue,
  ComparadorResult,
  ComparatorProductsByTariff,
  OcrResult,
} from '../dashboard/pages/comparator/comparator.models';
import { PublicLanding } from '../../entities/landing.model';

const DEFAULT_FORM_TITLE = 'Calculamos tu ahorro por ti';
const DEFAULT_FORM_SUBTITLE = 'Rellena los datos manualmente o sube tu última factura. Comparamos tu tarifa de luz para que sepas cuánto ahorrarías.';

@Component({
  selector: 'app-branded-landing',
  standalone: true,
  imports: [ComparatorUploadComponent, ComparatorModalComponent, OfferRequestWizardComponent, BrandLoaderComponent],
  templateUrl: './branded-landing.component.html',
  styleUrl: './branded-landing.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandedLandingComponent {
  private readonly route                   = inject(ActivatedRoute);
  private readonly router                  = inject(Router);
  private readonly comparatorService       = inject(ComparatorService);
  private readonly publicComparatorService = inject(PublicComparatorService);
  private readonly landingService          = inject(LandingService);
  private readonly platformId              = inject(PLATFORM_ID);

  // Landing arranca null; el componente monta inmediatamente con un skeleton
  // y la asigna cuando la API responde. Eso elimina la espera bloqueante
  // que tenía el resolver.
  readonly landing = signal<PublicLanding | null>(null);
  readonly isReady = computed(() => this.landing() !== null);

  readonly logoUrl       = computed(() => this.landing()?.branding.logoUrl ?? null);
  readonly heroImageUrls = computed(() => this.landing()?.branding.heroImageUrls ?? []);
  readonly heroTitle     = computed(() => this.landing()?.branding.heroTitle ?? '');
  readonly heroSubtitle  = computed(() => this.landing()?.branding.heroSubtitle ?? '');
  readonly formTitle     = computed(() => this.landing()?.branding.formTitle ?? DEFAULT_FORM_TITLE);
  readonly formSubtitle  = computed(() => this.landing()?.branding.formSubtitle ?? DEFAULT_FORM_SUBTITLE);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.comparatorService.loadTariffsPublic();
    document.body.classList.add('apolo-light');

    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.router.navigateByUrl('/');
      return;
    }

    this.landingService.getBySlug(slug).subscribe({
      next: landing => this.landing.set(landing),
      error: () => this.router.navigateByUrl('/'),
    });
  }

  readonly loading        = signal(false);
  readonly modalOpen      = signal(false);
  readonly result         = signal<ComparadorResult | null>(null);
  readonly ocrResult      = signal<OcrResult | null>(null);
  readonly fileId         = signal<string>('');
  readonly comparisonId   = signal<string>('');

  readonly wizardOpen      = signal(false);
  readonly wizardTariff    = signal<string | null>(null);
  readonly wizardProduct   = signal<string | null>(null);
  private  wizardSubmitted = signal(false);

  readonly productsByTariff = computed<ComparatorProductsByTariff>(() => {
    const p = this.landing()?.product;
    if (!p) return {};
    return { [p.tariffCode]: [p.name] };
  });

  readonly feeLockedProducts = [
    'Fijo Snap Mini', 'Fijo Snap', 'Fijo Snap Maxi',
    'Promo 3M Lite', 'Promo 3M Pro', 'Promo 3M Plus',
  ];

  readonly landingSlug = computed(() => this.landing()?.slug ?? null);

  onCompare(event: ComparadorCompareEvent): void {
    this.loading.set(true);
    this.result.set(null);
    this.ocrResult.set(null);
    this.comparisonId.set('');

    this.publicComparatorService.upload(event.file).subscribe({
      next: (res) => {
        this.fileId.set(res.fileId);
        this.ocrResult.set(res.ocrData);
        this.loading.set(false);
        this.modalOpen.set(true);

        const slug = this.landingSlug();
        this.publicComparatorService
          .register(res.ocrData?.cliente?.cups, slug)
          .subscribe(({ id }) => this.comparisonId.set(id));
      },
      error: () => this.loading.set(false),
    });
  }

  onFormChange(form: ComparadorFormValue): void {
    const ocr = this.ocrResult();
    if (!ocr) return;
    const base = this.comparatorService.getComisionBase(form.producto);
    this.result.set(this.comparatorService.calculate({ ...form, comisionEnergia: base }, ocr));
  }

  onVerComparativa(formValue: ComparadorFormValue): void {
    this.comparatorService.downloadPublicPdf(
      formValue,
      this.result(),
      this.ocrResult(),
      this.fileId(),
    );
  }

  onSolicitarOferta(form: ComparadorFormValue): void {
    const id = this.comparisonId();
    if (id) {
      this.publicComparatorService.markContratarClicked(id).subscribe();
    }
    this.wizardTariff.set(form?.tariff || null);
    this.wizardProduct.set(form?.producto || null);
    this.wizardSubmitted.set(false);
    this.modalOpen.set(false);
    this.wizardOpen.set(true);
  }

  onWizardOpenChange(open: boolean): void {
    this.wizardOpen.set(open);
    if (!open && !this.wizardSubmitted() && this.ocrResult()) {
      this.modalOpen.set(true);
    }
  }

  onWizardSubmitted(): void {
    this.wizardSubmitted.set(true);
  }
}
