import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '@apolo-energies/auth';
import { ButtonComponent, InputFieldComponent, SelectFieldComponent, SliderComponent } from '@apolo-energies/ui';
import { CommissionService } from '../../../../../../core/services/commission.service';
import { ProviderService } from '../../../../../../core/services/provider.service';
import { FastDischargeStore } from '../../store/fast-discharge.store';
import { TramiteType } from '../../models/person.model';
import { SipsConsumo } from '../../../../../../core/models/sips.model';
import { LoadingOverlayComponent } from '../../../../../../shared/components/loading-overlay/loading-overlay.component';
import { FLAT_COMMISSION_PRODUCTS } from '../../../../../../shared/constants/flat-commission-products';
import {
  CalcFull,
  PriceRow,
  TRAMITE_OPTIONS,
  buildPriceTable,
  computeCalcFull,
  computeCommissionBase,
  computeCommissionEnergy,
  computeCommissionPotencia,
  findProductCommissionPercentage,
  findProductPriceType,
  findSelectedProductName,
  fmt2,
} from './select-product.helpers';

@Component({
  selector: 'app-fd-select-product',
  imports: [DecimalPipe, ButtonComponent, InputFieldComponent, SelectFieldComponent, SliderComponent, LoadingOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select-product.html',
})
export class SelectProductPage {
  private readonly router            = inject(Router);
  readonly store                     = inject(FastDischargeStore);
  private readonly providerService   = inject(ProviderService);
  private readonly commissionService = inject(CommissionService);
  private readonly auth              = inject(AuthService);

  readonly submitted       = signal(false);
  readonly tramites        = signal<TramiteType[]>([]);
  readonly selectedProduct = signal('');
  readonly feeEnergia      = signal(5);
  readonly feePotencia     = signal(1);
  readonly omiePrice       = signal(50);
  readonly localTariffCode = signal('');

  readonly tramiteOptions = TRAMITE_OPTIONS;

  private readonly provider = toSignal(this.providerService.getByUser(), { initialValue: null });

  readonly isLoading = computed(() => this.provider() === null);

  constructor() {
    const userId = this.auth.currentUser()?.id;
    if (userId) this.commissionService.load(String(userId));

    // Initialise from store (may have been pre-filled by SIPS in supply-point)
    const sp = this.store.supplyPoint();
    if (sp?.tariffType) this.localTariffCode.set(sp.tariffType);

    // Restore saved product selection
    const saved = this.store.product();
    if (saved) {
      this.tramites.set(saved.tramiteTypes);
      this.selectedProduct.set(saved.tipoProducto);
      this.feeEnergia.set(saved.feeEnergia);
      this.feePotencia.set(saved.feePotencia);
      this.omiePrice.set(saved.omiePrice);
      if (saved.tariffCode) this.localTariffCode.set(saved.tariffCode);
    }
  }

  // ── tariff / product options ───────────────────────────────────────────────

  readonly tariffOptions = computed(() =>
    (this.provider()?.tariffs ?? []).map(t => ({ value: t.code, label: t.code }))
  );

  readonly productOptions = computed(() => {
    const p    = this.provider();
    const code = this.localTariffCode();
    if (!p) return [];
    const tariff = code ? p.tariffs.find(t => t.code === code) : null;
    const source = tariff ? [tariff] : p.tariffs;
    return source.flatMap(t =>
      t.products
        .filter(prod => prod.isAvailable)
        .map(prod => ({ value: prod.id.toString(), label: prod.name }))
    );
  });

  readonly selectedProductName = computed(() =>
    findSelectedProductName(this.provider()?.tariffs ?? [], this.selectedProduct())
  );

  onTariffChange(code: string): void {
    this.localTariffCode.set(code);
    this.selectedProduct.set('');
  }

  // ── SIPS consumption ───────────────────────────────────────────────────────

  readonly hasConsumptionData = computed(() => this.store.consumos().length > 0);

  private readonly last12 = computed<SipsConsumo[]>(() =>
    this.store.consumos().slice(0, 12)
  );

  readonly periodosUsados = computed(() => this.last12().length);

  readonly annualKwhByPeriod = computed<number[]>(() => {
    const consumos = this.last12();
    return [1, 2, 3, 4, 5, 6].map(p => {
      const key = `energiaP${p}` as keyof SipsConsumo;
      return consumos.reduce((s, c) => s + (((c[key]) as number | null) ?? 0), 0) / 1000;
    });
  });

  readonly contractedKwByPeriod = computed<number[]>(() => {
    const sp = this.store.supplyPoint();
    if (!sp) return [0, 0, 0, 0, 0, 0];
    return [sp.p1, sp.p2, sp.p3, sp.p4, sp.p5, sp.p6].map(kw => kw ?? 0);
  });

  readonly annualKwh = computed(() => this.annualKwhByPeriod().reduce((s, v) => s + v, 0));
  readonly totalKw   = computed(() => this.contractedKwByPeriod().reduce((s, v) => s + v, 0));

  readonly annualKwhFmt = computed(() => Math.round(this.annualKwh()).toLocaleString('es-ES'));
  readonly totalKwFmt   = computed(() => fmt2(this.totalKw()));

  // ── commission base ────────────────────────────────────────────────────────

  private hasFlatCommissionOverride(): boolean {
    return FLAT_COMMISSION_PRODUCTS[this.selectedProductName()] !== undefined;
  }

  private commissionBase(): number {
    const name = this.selectedProductName();
    const code = this.localTariffCode();
    const productPct = findProductCommissionPercentage(this.provider()?.tariffs ?? [], code, name);
    return computeCommissionBase(productPct, FLAT_COMMISSION_PRODUCTS[name], this.commissionService.commission() || 0);
  }

  // ── calculation ────────────────────────────────────────────────────────────

  readonly showCards = computed(() =>
    !!this.selectedProductName() && !!this.localTariffCode()
  );

  private readonly calcFull = computed<CalcFull | null>(() =>
    computeCalcFull({
      tariffs:              this.provider()?.tariffs ?? [],
      code:                 this.localTariffCode(),
      name:                 this.selectedProductName(),
      omiePrice:            this.omiePrice(),
      feeEnergia:           this.feeEnergia(),
      feePotencia:          this.feePotencia(),
      commBase:             this.commissionBase(),
      annualKwhByPeriod:    this.annualKwhByPeriod(),
      contractedKwByPeriod: this.contractedKwByPeriod(),
    })
  );

  readonly priceTable = computed<PriceRow[]>(() => buildPriceTable(this.calcFull()));

  /** Annual estimated bill with the offered product (always positive). */
  readonly annualEstBill  = computed(() => parseFloat((this.calcFull()?.result?.totalOferta ?? 0).toFixed(2)));
  readonly monthlyEstBill = computed(() => parseFloat((this.annualEstBill() / 12).toFixed(2)));
  readonly commissionPct  = computed(() => this.commissionService.commission());

  readonly commissionEnergy = computed(() => {
    if (!this.selectedProductName()) return 0;
    return computeCommissionEnergy(this.hasFlatCommissionOverride(), this.commissionBase(), this.feeEnergia(), this.annualKwh());
  });

  readonly commissionPotencia = computed(() => {
    if (!this.selectedProductName() || this.hasFlatCommissionOverride()) return 0;
    return computeCommissionPotencia(this.hasFlatCommissionOverride(), this.commissionBase(), this.feePotencia(), this.totalKw());
  });

  // Total = energía + potencia (sin el coeficiente 0.50 del comparador)
  readonly commission        = computed(() =>
    parseFloat((this.commissionEnergy() + this.commissionPotencia()).toFixed(3))
  );
  readonly commissionMonthly = computed(() => parseFloat((this.commission() / 12).toFixed(2)));

  readonly commissionFmt        = computed(() => fmt2(this.commission()));
  readonly commissionMonthlyFmt = computed(() => fmt2(this.commissionMonthly()));
  readonly annualEstBillFmt     = computed(() => fmt2(this.annualEstBill()));
  readonly monthlyEstBillFmt    = computed(() => fmt2(this.monthlyEstBill()));

  // ── actions ───────────────────────────────────────────────────────────────

  isSelected(v: TramiteType): boolean { return this.tramites().includes(v); }

  toggle(v: TramiteType): void {
    const cur = this.tramites();
    this.tramites.set(cur.includes(v) ? cur.filter(t => t !== v) : [...cur, v]);
  }

  onBack(): void {
    this.router.navigate(['/dashboard/fast-discharge/supply-point']);
  }

  onSubmit(): void {
    this.submitted.set(true);
    if (this.tramites().length === 0) return;

    const tipoPrecioEnergia = findProductPriceType(this.provider()?.tariffs ?? [], this.selectedProduct());

    this.store.setProduct({
      tramiteTypes:      this.tramites(),
      tipoProducto:      this.selectedProduct(),
      tipoPrecioEnergia,
      productName:       this.selectedProductName(),
      tariffCode:        this.localTariffCode(),
      feeEnergia:        this.feeEnergia(),
      feePotencia:       this.feePotencia(),
      omiePrice:         this.omiePrice(),
      commission:        this.commission(),
      annualSavings:     this.annualEstBill(),
    });

    this.router.navigate(['/dashboard/fast-discharge/documents']);
  }
}
