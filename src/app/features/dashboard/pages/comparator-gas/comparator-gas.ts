import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '@apolo-energies/auth';
import { ComparatorGasService } from '../../../../services/comparator-gas.service';
import { UserService } from '../../../../services/user.service';
import { GasProductService } from '../../../../services/gas-product.service';
import { ComparatorUploadComponent } from '../comparator/components/comparator-upload/comparator-upload';
import { ComparatorGasModalComponent } from './components/comparator-gas-modal/comparator-gas-modal';
import { LoadingOverlayComponent } from '../../../../shared/components/loading-overlay/loading-overlay.component';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';
import { ComparadorCompareEvent, ComparadorUser } from '../comparator/comparator.models';
import {
  GasDownloadEvent,
  GasFormValue,
  GasOcrResult,
  GasProductsByTariff,
  GasResult,
} from './comparator-gas.models';
import { calcularFacturaGas, DEFAULT_GAS_PRODUCTS } from './gas-calculator.helpers';
import { GasProductType } from '../../../../entities/gas-product.model';
import { environment } from '../../../../../environments/environment';
import { getUserRoles } from '../../../../utils/auth.utils';

@Component({
  selector: 'app-comparator-gas',
  standalone: true,
  imports: [
    ComparatorUploadComponent,
    ComparatorGasModalComponent,
    LoadingOverlayComponent,
    BrandLoaderComponent,
  ],
  templateUrl: './comparator-gas.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparatorGas {
  private readonly auth           = inject(AuthService);
  private readonly gasService     = inject(ComparatorGasService);
  private readonly userService    = inject(UserService);
  private readonly productService = inject(GasProductService);
  private readonly platformId     = inject(PLATFORM_ID);

  // ── state ──────────────────────────────────────────────────────────────────
  readonly isApolo  = environment.clientName === 'apolo';
  readonly loading  = signal(false);
  readonly modalOpen = signal(false);
  readonly ocrData  = signal<GasOcrResult | null>(null);
  readonly result   = signal<GasResult | null>(null);
  readonly fileId   = signal<string>('');
  readonly errorMsg = signal<string | null>(null);
  readonly comisionBase = signal(0);
  readonly selectedUserId = signal<string>('');
  readonly users          = signal<ComparadorUser[]>([]);
  readonly usersLoading   = signal(false);

  // ── roles ──────────────────────────────────────────────────────────────────
  readonly currentUser = this.auth.currentUser;
  readonly isMaster    = computed(() => getUserRoles(this.currentUser()).includes('Master'));

  /** Productos cargados del backend (admin en /dashboard/gas/products). Si la
      request falla o devuelve vacio, cae al hardcoded para no romper el comparador. */
  private readonly remoteProducts = signal<GasProductsByTariff | null>(null);
  readonly productsByTariff = computed<GasProductsByTariff>(() =>
    this.remoteProducts() ?? DEFAULT_GAS_PRODUCTS);

  // Derivado de la flag feeLocked de cada producto (admin la setea en /dashboard/gas/products).
  readonly feeLockedProducts = computed<string[]>(() => {
    const grouped = this.productsByTariff();
    const names = new Set<string>();
    for (const tariff of Object.keys(grouped)) {
      for (const p of grouped[tariff]) {
        if (p.feeLocked) names.add(p.name);
      }
    }
    return Array.from(names);
  });

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.isMaster()) this.loadUsers();
    this.loadProducts();
  }

  private loadProducts(): void {
    this.productService.list(undefined, true).subscribe({
      next: products => {
        const grouped: GasProductsByTariff = {};
        for (const p of products) {
          (grouped[p.tariffCode] ??= []).push({
            name: p.name,
            type: p.type === GasProductType.Indexed ? 'Indexed' : 'Fixed',
            precioEnergia: p.precioEnergia,
            precioFijoDia: p.precioFijoDia,
            feeLocked: p.feeLocked,
          });
        }
        if (Object.keys(grouped).length > 0) this.remoteProducts.set(grouped);
      },
      error: () => { /* fallback al hardcoded sin romper la UI */ },
    });
  }

  private loadUsers(): void {
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

  // ── handlers ───────────────────────────────────────────────────────────────

  onCompare(event: ComparadorCompareEvent): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.result.set(null);
    this.ocrData.set(null);

    const userId = this.isMaster() ? event.userId : '';
    this.selectedUserId.set(userId);

    this.gasService.uploadGas(event.file, userId || undefined).subscribe({
      next: (res) => {
        this.fileId.set(res.fileId);
        this.ocrData.set(res.ocrData);
        this.loading.set(false);
        this.modalOpen.set(true);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.message ?? err?.message ?? 'Error al procesar la factura.');
        this.loading.set(false);
      },
    });
  }

  onFormChange(form: GasFormValue): void {
    const ocr = this.ocrData();
    if (!ocr) return;
    const calc = calcularFacturaGas(form, ocr, this.productsByTariff());
    this.result.set(calc);
  }

  onDownload(event: GasDownloadEvent): void {
    this.gasService.download(event.type, event.formValue, this.result(), this.ocrData(), this.fileId());
  }
}
