import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
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
import { BrandLoaderComponent } from '../../shared/components/brand-loader/brand-loader.component';
import {
  ComparadorCompareEvent,
  ComparadorFormValue,
  ComparadorResult,
  ComparatorProductsByTariff,
  OcrResult,
} from '../dashboard/pages/comparator/comparator.models';

@Component({
  selector: 'app-public-comparator',
  standalone: true,
  imports: [ComparatorUploadComponent, ComparatorModalComponent, BrandLoaderComponent],
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

  readonly productsByTariff: ComparatorProductsByTariff = {
    '2.0TD': ['Index Base', 'Index Coste', 'Index Promo', 'Fijo Snap', 'Fijo Snap Mini', 'Passpool'],
    '3.0TD': ['Index Base', 'Index Coste', 'Index Promo', 'Fijo Fácil', 'Fijo Estable', 'Fijo Dyn', 'Promo 3M Pro'],
    '6.1TD': ['Index Base', 'Index Coste', 'Index Promo', 'Fijo Fácil', 'Fijo Estable', 'Fijo Dyn', 'Promo 3M Pro'],
  };

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

  // ── handlers ────────────────────────────────────────────────────────────
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

  onSolicitarOferta(): void {
    const id = this.comparisonId();
    if (id) {
      this.publicComparatorService.markContratarClicked(id).subscribe();
    }

    const url = id
      ? `https://apolo-energies.com/contratar?comparisonId=${id}`
      : 'https://apolo-energies.com/contratar';
    window.parent?.postMessage({ type: 'apolo-comparador:contratar', url }, '*');
  }
}
