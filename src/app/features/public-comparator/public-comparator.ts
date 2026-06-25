import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ComparatorService } from '../../services/comparator.service';
import { PublicComparatorService } from '../../services/public-comparator.service';
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
import { environment } from '../../../environments/environment';
import { EFFICIENCY_TIPS_LEAD, pickRandomEfficiencyTip } from '../../shared/constants/efficiency-tips';

// Candidatos a "producto fijo ganador" por tarifa. Al recibir un OCR se simula el cálculo con
// cada uno y se ofrece al cliente solo el que produce mayor ahorroEstudio.
const FIXED_CANDIDATES: Record<string, string[]> = {
  '2.0TD': ['Fijo Snap Mini', 'Fijo Snap', 'Fijo Snap Maxi'],
  '3.0TD': ['Fijo Fácil', 'Fijo Estable', 'Fijo Dyn'],
  '6.1TD': ['Fijo Fácil', 'Fijo Estable', 'Fijo Dyn'],
};

@Component({
  selector: 'app-public-comparator',
  standalone: true,
  imports: [ComparatorUploadComponent, ComparatorModalComponent, OfferRequestWizardComponent, BrandLoaderComponent],
  templateUrl: './public-comparator.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicComparator implements AfterViewInit, OnDestroy {
  private comparatorService       = inject(ComparatorService);
  private publicComparatorService = inject(PublicComparatorService);
  private platformId              = inject(PLATFORM_ID);

  @ViewChild('root', { static: true }) rootEl!: ElementRef<HTMLElement>;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.comparatorService.loadTariffsPublic();
      document.body.classList.add('apolo-light');
    }
  }

  readonly loading        = signal(false);
  readonly modalOpen      = signal(false);
  readonly result         = signal<ComparadorResult | null>(null);
  readonly ocrResult      = signal<OcrResult | null>(null);
  readonly fileId         = signal<string>('');
  readonly comparisonId   = signal<string>('');
  readonly loaderTitle    = EFFICIENCY_TIPS_LEAD;
  readonly loaderTip      = signal<string>(pickRandomEfficiencyTip());

  // Offer-request wizard state
  readonly wizardOpen      = signal(false);
  readonly wizardTariff    = signal<string | null>(null);
  readonly wizardProduct   = signal<string | null>(null);
  private  wizardSubmitted = signal(false);

  // En Coexpal el comparador público usa solo el producto 'Asociados' (con precios fijos cargados
  // en admin). En el resto de entornos se ofrece un único producto fijo por tarifa: el que más
  // ahorre al cliente segun el OCR (FIXED_CANDIDATES). Antes de recibir el OCR mostramos el
  // primer candidato como placeholder para que el modal tenga algo que seleccionar.
  readonly productsByTariff = computed<ComparatorProductsByTariff>(() => {
    if (environment.clientName === 'coexpal') {
      return { '2.0TD': ['Asociados'], '3.0TD': ['Asociados'], '6.1TD': ['Asociados'] };
    }
    const ocr = this.ocrResult();
    const tariffsLoaded = this.comparatorService.tariffs().length > 0;
    const result: ComparatorProductsByTariff = {};
    for (const [tarifa, candidatos] of Object.entries(FIXED_CANDIDATES)) {
      result[tarifa] = (!ocr || !tariffsLoaded)
        ? [candidatos[0]]
        : [this.pickBestFixedProduct(tarifa, candidatos, ocr)];
    }
    return result;
  });

  readonly feeLockedProducts = [
    'Fijo Snap Mini', 'Fijo Snap', 'Fijo Snap Maxi',
    'Promo 3M Lite', 'Promo 3M Pro', 'Promo 3M Plus',
  ];

  // ── iframe auto-resize ──────────────────────────────────────────────────
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(() => this.postHeight());
    this.resizeObserver.observe(this.rootEl.nativeElement);
    this.postHeight();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('apolo-light');
    }
  }

  private postHeight(): void {
    const height = this.rootEl.nativeElement.scrollHeight;
    window.parent?.postMessage({ type: 'apolo-comparador:resize', height }, '*');
  }

  private pickBestFixedProduct(tarifa: string, candidatos: string[], ocr: OcrResult): string {
    let mejor = candidatos[0];
    let mejorAhorro = -Infinity;
    for (const producto of candidatos) {
      const comisionBase = this.comparatorService.getComisionBase(producto, tarifa);
      const form: ComparadorFormValue = {
        tariff: tarifa,
        producto,
        precioMedio: 0,
        feeEnergia: 0,
        feePotencia: 0,
        comisionEnergia: comisionBase,
      };
      const ahorro = this.comparatorService.calculate(form, ocr).ahorroEstudio;
      if (ahorro > mejorAhorro) {
        mejorAhorro = ahorro;
        mejor = producto;
      }
    }
    return mejor;
  }

  // ── handlers ────────────────────────────────────────────────────────────
  onCompare(event: ComparadorCompareEvent): void {
    this.loaderTip.set(pickRandomEfficiencyTip());
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

        this.publicComparatorService
          .register(res.ocrData?.cliente?.cups)
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
