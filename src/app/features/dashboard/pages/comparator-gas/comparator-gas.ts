import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '@apolo-energies/auth';
import { ApoloGasPricing, ComparatorGasService } from '../../../../services/comparator-gas.service';
import { GasSipsService } from '../../../../services/gas-sips.service';
import { UserService } from '../../../../services/user.service';
import { ComparatorUploadComponent } from '../comparator/components/comparator-upload/comparator-upload';
import { ComparatorGasModalComponent } from './components/comparator-gas-modal/comparator-gas-modal';
import { LoadingOverlayComponent } from '../../../../shared/components/loading-overlay/loading-overlay.component';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';
import { ComparadorCompareEvent, ComparadorUser } from '../comparator/comparator.models';
import {
  GasDownloadEvent,
  GasOcrResult,
  GasResult,
} from './comparator-gas.models';
import { calcularFacturaGas, CalcularFacturaGasOverrides } from './gas-calculator.helpers';
import { GasModalOverrides } from './components/comparator-gas-modal/comparator-gas-modal';
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
  private readonly auth        = inject(AuthService);
  private readonly gasService  = inject(ComparatorGasService);
  private readonly sipsService = inject(GasSipsService);
  private readonly userService = inject(UserService);
  private readonly platformId  = inject(PLATFORM_ID);

  readonly isApolo   = environment.clientName === 'apolo';
  readonly loading   = signal(false);
  readonly modalOpen = signal(false);
  readonly ocrData   = signal<GasOcrResult | null>(null);
  readonly result    = signal<GasResult | null>(null);
  readonly fileId    = signal<string>('');
  readonly errorMsg  = signal<string | null>(null);
  /** Si /gas/comparison falla, mostramos error en modal en vez de fallback estático. */
  readonly pricingError   = signal<string | null>(null);
  readonly pricingInfo    = signal<ApoloGasPricing | null>(null);
  readonly overrides      = signal<CalcularFacturaGasOverrides | undefined>(undefined);
  /** Override MIBGAS del input del modal. null = usa el del admin/backend. */
  readonly mibgasOverride = signal<number | null>(null);
  readonly selectedUserId = signal<string>('');
  readonly users          = signal<ComparadorUser[]>([]);
  readonly usersLoading   = signal(false);
  /**
   * Consumo anual del CUPS vía SIPS (CNMC). Preferido sobre la proyección de la
   * factura por la estacionalidad del gas (invierno ~5× verano). Fallback a
   * proyección kwh × 365/dias si el CUPS no está en SIPS.
   */
  readonly sipsAnnualKwh = signal(0);

  readonly currentUser = this.auth.currentUser;
  readonly isMaster    = computed(() => getUserRoles(this.currentUser()).includes('Master'));

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.isMaster()) this.loadUsers();
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

  onCompare(event: ComparadorCompareEvent): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.pricingError.set(null);
    this.pricingInfo.set(null);
    this.overrides.set(undefined);
    this.mibgasOverride.set(null);
    this.result.set(null);
    this.ocrData.set(null);
    this.sipsAnnualKwh.set(0);

    const userId = this.isMaster() ? event.userId : '';
    this.selectedUserId.set(userId);

    this.gasService.uploadGas(event.file, userId || undefined).subscribe({
      next: (res) => {
        this.fileId.set(res.fileId);
        this.ocrData.set(res.ocrData);
        this.loading.set(false);
        this.modalOpen.set(true);
        this.loadSipsAnnualKwh(res.ocrData.cliente?.cups);
        this.recompute();
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.message ?? err?.message ?? 'Error al procesar la factura.');
        this.loading.set(false);
      },
    });
  }

  /** Al llegar el SIPS, recomputa: cambia el annualKwh y con eso el bracket RL. */
  private loadSipsAnnualKwh(cups: string | undefined): void {
    if (!cups) return;
    this.sipsService.getByCups(cups).subscribe({
      next: (sips) => {
        this.sipsAnnualKwh.set(sips.annualKwh ?? 0);
        this.recompute();
      },
      error: () => this.sipsAnnualKwh.set(0),
    });
  }

  private recompute(): void {
    const ocr = this.ocrData();
    if (!ocr) return;

    const sipsAnnual = this.sipsAnnualKwh();
    const kwhTotal   = ocr.consumo?.kwh_total ?? 0;
    const dias       = ocr.periodo_facturacion?.numero_dias ?? 0;
    const annualKwh  = sipsAnnual > 0
      ? sipsAnnual
      : (dias > 0 ? kwhTotal * (365 / dias) : kwhTotal);

    if (annualKwh <= 0) {
      this.pricingError.set('No se pudo determinar el consumo anual de la factura.');
      this.result.set(null);
      return;
    }

    this.gasService.getApoloPricing(annualKwh, this.mibgasOverride()).subscribe({
      next: (pricing) => {
        if (!pricing) {
          this.pricingError.set('No se pudo calcular el precio Apolo ahora mismo. Reintenta en unos minutos o contacta a soporte.');
          this.pricingInfo.set(null);
          this.result.set(null);
          return;
        }
        this.pricingError.set(null);
        this.pricingInfo.set(pricing);
        this.result.set(calcularFacturaGas(ocr, pricing, annualKwh, this.overrides()));
      },
      error: () => {
        this.pricingError.set('No se pudo calcular el precio Apolo ahora mismo. Reintenta en unos minutos o contacta a soporte.');
        this.pricingInfo.set(null);
        this.result.set(null);
      },
    });
  }

  onDownload(event: GasDownloadEvent): void {
    this.gasService.download(event.type, this.result(), this.ocrData(), this.fileId());
  }

  // MIBGAS override requiere ida al backend (afecta al pricing base). Los otros
  // sliders (margen fijo, fee energía) solo aplican overrides locales sobre el
  // pricing ya cacheado — más rápido y sin costo de red.
  onOverridesChange(overrides: GasModalOverrides): void {
    this.overrides.set({
      fijoMarginPct:    overrides.fijoMarginPct,
      feeEnergiaEurMwh: overrides.feeEnergiaEurMwh,
    });
    const mibgasChanged = overrides.mibgasOverride !== this.mibgasOverride();
    this.mibgasOverride.set(overrides.mibgasOverride);

    const ocr = this.ocrData();
    if (!ocr) return;

    if (mibgasChanged) {
      this.recompute();
      return;
    }

    const pricing = this.pricingInfo();
    if (!pricing) return;
    const annualKwh = this.sipsAnnualKwh() > 0
      ? this.sipsAnnualKwh()
      : ((ocr.periodo_facturacion?.numero_dias ?? 0) > 0
          ? (ocr.consumo?.kwh_total ?? 0) * (365 / (ocr.periodo_facturacion?.numero_dias ?? 30))
          : (ocr.consumo?.kwh_total ?? 0));
    this.result.set(calcularFacturaGas(ocr, pricing, annualKwh, this.overrides()));
  }
}
