import { ChangeDetectionStrategy, Component, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ComparadorComponent,
  ComparadorModalComponent,
  ComparadorCompareEvent,
  ComparadorFormValue,
  ComparadorResult,
  ComparadorUser,
  ComparatorProductsByTariff,
  OcrResult,
} from '@apolo-energies/comparator';
import { AuthService } from '@apolo-energies/auth';
import { getUserRoles } from '../../../../utils/auth.utils';
import { ComparatorService } from '../../../../services/comparator.service';
import { CommissionService } from '../../../../services/commission.service';

@Component({
  selector: 'app-comparator',
  imports: [ComparadorComponent, ComparadorModalComponent],
  templateUrl: './comparator.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Comparator {
  private auth              = inject(AuthService);
  private comparatorService = inject(ComparatorService);
  private commissionService = inject(CommissionService);
  private platformId        = inject(PLATFORM_ID);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.comparatorService.loadTariffs();
      const userId = this.auth.currentUser()?.id;
      if (userId) this.commissionService.load(String(userId));
    }
  }

  readonly loading   = signal(false);
  readonly modalOpen = signal(false);
  readonly result    = signal<ComparadorResult | null>(null);
  readonly ocrResult = signal<OcrResult | null>(null);
  readonly fileId    = signal<string>('');

  readonly currentUser = this.auth.currentUser;

  readonly isMaster = computed(() =>
    getUserRoles(this.currentUser()).includes('Master')
  );

  readonly isReferrer = computed(() =>
    getUserRoles(this.currentUser()).includes('Referenciador')
  );

  readonly comisionBase = signal(0);

  readonly users = signal<ComparadorUser[]>([]);

  readonly productsByTariff: ComparatorProductsByTariff = {
    '2.0TD': ['Index Base', 'Index Coste', 'Index Promo', 'Fijo Snap', 'Fijo Snap Mini', 'Passpool'],
    '3.0TD': ['Index Base', 'Index Coste', 'Index Promo', 'Fijo Fácil', 'Fijo Estable', 'Fijo Dyn', 'Promo 3M Pro'],
    '6.1TD': ['Index Base', 'Index Coste', 'Index Promo', 'Fijo Fácil', 'Fijo Estable', 'Fijo Dyn', 'Promo 3M Pro'],
  };

  readonly feeLockedProducts = ['Fijo Snap', 'Fijo Snap Mini', 'Fijo Snap Maxi', 'Promo 3M Pro'];

  onCompare(event: ComparadorCompareEvent): void {
    this.loading.set(true);
    this.comparatorService.upload(event.file, event.userId).subscribe({
      next: (res) => {
        this.fileId.set(res.fileId);
        this.ocrResult.set(res.ocrData);
        this.loading.set(false);
        this.modalOpen.set(true);
      },
      error: () => this.loading.set(false),
    });
  }

  onFormChange(form: ComparadorFormValue): void {
    const ocr = this.ocrResult();
    if (!ocr) return;
    const base = this.comparatorService.getComisionBase(form.producto);
    console.log('[onFormChange]', {
      producto:        form.producto,
      comisionBase:    base,
      comisionEnergia: form.comisionEnergia,
      feePotencia:     form.feePotencia,
      feeEnergia:      form.feeEnergia,
    });
    this.comisionBase.set(base);
    this.result.set(this.comparatorService.calculate(form, ocr));
  }

  onDownload(event: { type: 'pdf' | 'excel'; formValue: ComparadorFormValue }): void {
    this.comparatorService.download(event.type, event.formValue, this.result(), this.ocrResult(), this.fileId());
  }
}
