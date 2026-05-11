import { ChangeDetectionStrategy, Component, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '@apolo-energies/auth';
import { getUserRoles } from '../../../../utils/auth.utils';
import { ComparatorService } from '../../../../services/comparator.service';
import { CommissionService } from '../../../../services/commission.service';
import { UserService } from '../../../../services/user.service';
import { ComparadorUploadComponent } from './components/comparador-upload/comparador-upload';
import { ComparadorModalComponent } from './components/comparador-modal/comparador-modal';
import { LoadingOverlayComponent } from '../../../../shared/components/loading-overlay/loading-overlay.component';
import {
  ComparadorCompareEvent,
  ComparadorDownloadEvent,
  ComparadorFormValue,
  ComparadorResult,
  ComparadorUser,
  ComparatorProductsByTariff,
  OcrResult,
} from './comparator.models';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-comparator',
  standalone: true,
  imports: [ComparadorUploadComponent, ComparadorModalComponent, BrandLoaderComponent, LoadingOverlayComponent],
  templateUrl: './comparator.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Comparator {
  private auth              = inject(AuthService);
  private comparatorService = inject(ComparatorService);
  private commissionService = inject(CommissionService);
  private userService       = inject(UserService);
  private platformId        = inject(PLATFORM_ID);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.comparatorService.loadTariffs();
      const userId = this.auth.currentUser()?.id;
      if (userId) this.commissionService.load(String(userId));
      if (this.isMaster()) this.loadUsers();
    }
  }

  // ── state ──────────────────────────────────────────────────────────────────

  readonly isApolo        = environment.clientName === 'apolo';
  readonly loading        = signal(false);
  readonly modalOpen      = signal(false);
  readonly result         = signal<ComparadorResult | null>(null);
  readonly ocrResult      = signal<OcrResult | null>(null);
  readonly fileId         = signal<string>('');
  readonly selectedUserId = signal<string>('');
  readonly comisionBase   = signal(0);
  readonly users          = signal<ComparadorUser[]>([]);

  // ── computed roles ─────────────────────────────────────────────────────────

  readonly currentUser = this.auth.currentUser;

  readonly isMaster = computed(() =>
    getUserRoles(this.currentUser()).includes('Master')
  );

  readonly isReferrer = computed(() =>
    getUserRoles(this.currentUser()).includes('Referenciador')
  );

  // ── static config ──────────────────────────────────────────────────────────

  readonly productsByTariff = computed<ComparatorProductsByTariff>(() =>
    Object.fromEntries(
      this.comparatorService.tariffs().map(t => [
        t.code,
        t.products.filter(p => p.isAvailable).map(p => p.name),
      ])
    )
  );

  readonly feeLockedProducts = [
    'Fijo Snap Mini', 'Fijo Snap', 'Fijo Snap Maxi',
    'Promo 3M Lite', 'Promo 3M Pro', 'Promo 3M Plus',
  ];

  // ── handlers ───────────────────────────────────────────────────────────────

  onCompare(event: ComparadorCompareEvent): void {
    this.loading.set(true);
    this.result.set(null);
    this.ocrResult.set(null);

    const selectedId = this.isMaster() ? (event.userId || '') : '';
    this.selectedUserId.set(selectedId);
    const userId = selectedId || this.auth.currentUser()?.id || '';

    if (this.isMaster()) {
      this.commissionService.loadForUser(String(userId));
    }

    this.comparatorService.upload(event.file, String(userId)).subscribe({
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

    const base = this.comparatorService.getComisionBase(form.producto, form.tariff);
    this.comisionBase.set(base);

    // For non-referrers always override comisionEnergia with the fresh base
    const correctedForm: ComparadorFormValue = this.isReferrer()
      ? form
      : { ...form, comisionEnergia: base };

    this.result.set(this.comparatorService.calculate(correctedForm, ocr));
  }

  onDownload(event: ComparadorDownloadEvent): void {
    const targetUserId = this.isMaster() ? (this.selectedUserId() || undefined) : undefined;
    this.comparatorService.download(
      event.type,
      event.formValue,
      this.result(),
      this.ocrResult(),
      this.fileId(),
      targetUserId,
    );
  }

  // ── private ────────────────────────────────────────────────────────────────

  private loadUsers() {
    this.userService.getByFilters({ pageSize: 200 }).subscribe(res => {
      this.users.set(
        res.items.map(u => ({ id: u.id, name: u.fullName }))
      );
    });
  }
}
