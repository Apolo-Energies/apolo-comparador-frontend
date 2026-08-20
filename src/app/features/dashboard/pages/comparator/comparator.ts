import { ChangeDetectionStrategy, Component, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '@apolo-energies/auth';
import { getUserRoles } from '../../../../utils/auth.utils';
import { ComparatorService } from '../../../../services/comparator.service';
import { CommissionService } from '../../../../services/commission.service';
import { UserService } from '../../../../services/user.service';
import { SubUsersService } from '../../../../services/sub-users.service';
import { SipsService, sumAnnualKwh } from '../../../../services/sips.service';
import { ComparatorUploadComponent } from './components/comparator-upload/comparator-upload';
import { ComparatorModalComponent } from './components/comparator-modal/comparator-modal';
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
  imports: [ComparatorUploadComponent, ComparatorModalComponent, BrandLoaderComponent, LoadingOverlayComponent, RouterLink],
  templateUrl: './comparator.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Comparator {
  private auth              = inject(AuthService);
  private comparatorService = inject(ComparatorService);
  private commissionService = inject(CommissionService);
  private userService       = inject(UserService);
  private subUsersService   = inject(SubUsersService);
  private sipsService       = inject(SipsService);
  private platformId        = inject(PLATFORM_ID);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.comparatorService.loadTariffs();
      const userId = this.auth.currentUser()?.id;
      if (userId) {
        this.subUsersService.getMyCommission().subscribe({
          next: myCommission => {
            this.subUserPoolPct.set(myCommission.percentageOfParentPool);
            this.commissionService.loadForUserOnce(myCommission.parentUserId).subscribe((parentPct: number) => {
              this.commissionService.commission.set(parentPct);
            });
          },
          error: () => {
            // 404 → not a sub-user, load own commission normally
            this.commissionService.loadForUser(String(userId));
          },
        });
      }
      if (this.isMaster()) this.loadUsers();
    }
  }

  // ── state ──────────────────────────────────────────────────────────────────

  readonly isApolo        = environment.clientName === 'apolo';
  readonly loading        = signal(false);
  readonly usersLoading   = signal(false);
  readonly modalOpen      = signal(false);
  readonly result         = signal<ComparadorResult | null>(null);
  readonly ocrResult      = signal<OcrResult | null>(null);
  readonly fileId         = signal<string>('');
  readonly selectedUserId = signal<string>('');
  readonly comisionBase   = signal(0);
  readonly subUserPoolPct = signal<number | null>(null);
  readonly users          = signal<ComparadorUser[]>([]);
  /**
   * Consumo anual del CUPS vía SIPS (histórico real 12 meses). Preferido sobre la
   * extrapolación de la factura porque una factura de invierno/verano sesga el anual
   * hasta ±50%. Fallback a extrapolación (kwh × 365/dias) si el CUPS no está en SIPS.
   */
  readonly sipsAnnualKwh  = signal(0);
  /** Último form emitido por el modal — permite recomputar si SIPS llega después. */
  private readonly lastForm = signal<ComparadorFormValue | null>(null);

  // ── computed roles ─────────────────────────────────────────────────────────

  readonly currentUser = this.auth.currentUser;

  readonly isMaster = computed(() =>
    getUserRoles(this.currentUser()).includes('Master')
  );

  readonly isReferrer = computed(() => {
    const roles = getUserRoles(this.currentUser());
    return roles.includes('Referenciador') && !roles.includes('Colaborador') && !roles.includes('Colaborador - Referenciador');
  });

  readonly isComercial = computed(() =>
    getUserRoles(this.currentUser()).includes('Comercial')
  );

  // ── static config ──────────────────────────────────────────────────────────

  readonly productsByTariff = computed<ComparatorProductsByTariff>(() =>
    Object.fromEntries(
      this.comparatorService.tariffs().map(t => [
        t.code,
        t.products
          .filter(p => p.isAvailable)
          .sort((a, b) => {
            if (a.type === b.type) return 0;
            return a.type === 'Indexed' ? -1 : 1;
          })
          .map(p => p.name),
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
    this.sipsAnnualKwh.set(0);
    this.lastForm.set(null);

    const selectedId = this.isMaster() ? (event.userId || '') : '';
    this.selectedUserId.set(selectedId);
    const userId = selectedId || this.auth.currentUser()?.id || '';

    this.comparatorService.upload(event.file, String(userId)).subscribe({
      next: (res) => {
        this.fileId.set(res.fileId);
        this.ocrResult.set(res.ocrData);
        this.loading.set(false);
        this.modalOpen.set(true);
        this.loadSipsAnnualKwh(res.ocrData.cliente?.cups);
      },
      error: () => this.loading.set(false),
    });
  }

  /**
   * Consulta SIPS por CUPS y guarda el consumo anual real (suma últimos 12 meses).
   * Si el modal ya empezó a emitir formValues, recomputa con el nuevo dato para que
   * ahorro anual, comisión y PDF queden consistentes.
   */
  private loadSipsAnnualKwh(cups: string | undefined): void {
    if (!cups) return;
    this.sipsService.getByCups(cups).subscribe({
      next: (sips) => {
        this.sipsAnnualKwh.set(sumAnnualKwh(sips.consumos));
        const form = this.lastForm();
        if (form) this.onFormChange(form);
      },
      error: () => this.sipsAnnualKwh.set(0),
    });
  }

  onFormChange(form: ComparadorFormValue): void {
    const ocr = this.ocrResult();
    if (!ocr) return;

    const selectedUser  = this.isMaster() ? this.users().find(u => u.id === this.selectedUserId()) : undefined;
    const commissionPct = this.isMaster()
      ? (selectedUser?.commissionPct ?? undefined)
      : (this.commissionService.commission() || undefined);
    const base = this.comparatorService.getComisionBase(form.producto, form.tariff, commissionPct);
    this.comisionBase.set(base);

    // For non-referrers always override comisionEnergia with the fresh base
    const correctedForm: ComparadorFormValue = this.isReferrer()
      ? form
      : { ...form, comisionEnergia: base };

    this.lastForm.set(correctedForm);
    const calculated = this.comparatorService.calculate(correctedForm, ocr, this.sipsAnnualKwh());

    // Sub-user: scale the full commission (energy + potencia) by their pool percentage
    const poolPct = this.subUserPoolPct();
    if (poolPct !== null) {
      calculated.comision = parseFloat((calculated.comision * poolPct / 100).toFixed(3));
    }

    this.result.set(calculated);
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
      this.sipsAnnualKwh(),
    );
  }

  // ── private ────────────────────────────────────────────────────────────────

  private loadUsers() {
    this.usersLoading.set(true);
    this.userService.getByFilters({ pageSize: 200 }).subscribe({
      next: res => {
        this.users.set(
          res.items.map(u => ({
            id:            u.id,
            name:          u.fullName,
            commissionPct: u.commissions?.find(c => c.isActive)?.commissionType?.percentage ?? null,
          }))
        );
        this.usersLoading.set(false);
      },
      error: () => this.usersLoading.set(false),
    });
  }
}
