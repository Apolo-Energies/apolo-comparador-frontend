import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '@apolo-energies/auth';
import { ButtonComponent, InputFieldComponent, SelectFieldComponent, SliderComponent } from '@apolo-energies/ui';
import { CommissionService } from '../../../../../../services/commission.service';
import { ProviderService } from '../../../../../../services/provider.service';
import { FastDischargeStore } from '../../store/fast-discharge.store';
import { TramiteType } from '../../models/person.models';
import { SipsConsumo } from '../../../../../../entities/sips.model';
import { calcularFactura } from '../../../../../../services/calculator.helpers';
import {
  ComparadorFormValue,
  ComparadorResult,
  OcrResult,
} from '../../../comparator/comparator.models';

interface TramiteOption { value: TramiteType; label: string; }
interface PriceRow {
  periodo:        number | string;
  energiaBase:    number;
  energiaOferta:  number;
  potenciaOferta: number;
}
interface CalcFull {
  ref:            ComparadorResult;
  result:         ComparadorResult;
  referenceTotal: number;
}

const TRAMITE_OPTIONS: TramiteOption[] = [
  { value: 'ALTA_NUEVA',      label: 'Alta nueva'      },
  { value: 'NUEVO_TITULAR',   label: 'Nuevo titular'   },
  { value: 'CAMBIO_TARIFA',   label: 'Cambio tarifa'   },
  { value: 'CAMBIO_POTENCIA', label: 'Cambio potencia' },
];

const SNAP_ENERGIA: Record<string, number> = {
  'Fijo Snap Mini': 50, 'Fijo Snap': 75, 'Fijo Snap Maxi': 100,
};
const INDEX_ENERGIA: Record<string, number> = {
  'Index Coste': 0.5, 'Index Base': 0.55, 'Index Promo': 0.85,
};

const fmt2 = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

@Component({
  selector: 'app-fd-select-product',
  imports: [DecimalPipe, ButtonComponent, InputFieldComponent, SelectFieldComponent, SliderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center min-h-full px-4 py-8">
      <div class="w-full max-w-2xl bg-card border border-border rounded-lg shadow-xl px-8 py-8 space-y-6"
           style="max-height: 90vh; overflow-y: auto;">

        <div>
          <p class="text-xl font-bold text-foreground">Selecciona el Producto</p>
          <p class="text-sm text-muted-foreground">Elige el tipo de trámite y configura las condiciones del contrato.</p>
        </div>

        <form (submit)="$event.preventDefault(); onSubmit()" class="space-y-6">

          <!-- Tramite type pills -->
          <div class="grid grid-cols-2 gap-3">
            @for (opt of tramiteOptions; track opt.value) {
              <button
                type="button"
                class="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left"
                [style.border-color]="isSelected(opt.value) ? 'var(--color-accent, #12AFF0)' : ''"
                [style.background-color]="isSelected(opt.value) ? 'rgba(18, 175, 240, 0.07)' : ''"
                (click)="toggle(opt.value)"
              >
                <span
                  class="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-all duration-200"
                  [style.background-color]="isSelected(opt.value) ? 'var(--color-accent, #12AFF0)' : ''"
                  [style.border-color]="isSelected(opt.value) ? 'var(--color-accent, #12AFF0)' : ''"
                >
                  <span
                    class="pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-200"
                    style="background: white;"
                    [style.transform]="isSelected(opt.value) ? 'translateX(16px)' : 'translateX(0)'"
                  ></span>
                </span>
                <span class="text-sm font-medium text-foreground">{{ opt.label }}</span>
              </button>
            }
          </div>
          @if (submitted() && tramites().length === 0) {
            <span class="text-red-500 text-xs -mt-2 block">Selecciona al menos un tipo de trámite</span>
          }

          <!-- Tarifa + Tipo de producto + OMIE -->
          <div class="grid grid-cols-3 gap-3">
            <div>
              <ui-select
                label="Tarifa"
                placeholder="Seleccionar..."
                [options]="tariffOptions()"
                [value]="localTariffCode()"
                (valueChange)="onTariffChange($event)"
              />
            </div>
            <div>
              <ui-select
                label="Tipo de producto"
                placeholder="Seleccionar..."
                [options]="productOptions()"
                [value]="selectedProduct()"
                (valueChange)="selectedProduct.set($event)"
              />
            </div>
            <div>
              <ui-input
                label="OMIE (€/MWh)"
                type="number"
                placeholder="50"
                [value]="omiePrice().toString()"
                (valueChange)="omiePrice.set(+$event || 0)"
              />
            </div>
          </div>

          <!-- Fee energía -->
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-foreground">Fee energía</p>
              <span class="text-sm font-bold text-primary-button">{{ feeEnergia() }}</span>
            </div>
            <ui-slider [value]="feeEnergia()" [min]="0" [max]="100" (valueChange)="feeEnergia.set($event)" />
            <div class="flex justify-between text-xs text-muted-foreground"><span>0</span><span>100</span></div>
          </div>

          <!-- Fee potencia -->
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-foreground">Fee potencia</p>
              <span class="text-sm font-bold text-primary-button">{{ feePotencia() }}</span>
            </div>
            <ui-slider [value]="feePotencia()" [min]="0" [max]="100" (valueChange)="feePotencia.set($event)" />
            <div class="flex justify-between text-xs text-muted-foreground"><span>0</span><span>100</span></div>
          </div>

          <!-- Price table -->
          @if (priceTable().length > 0) {
            <div class="rounded-xl border border-border overflow-hidden">
              <table class="w-full text-xs">
                <thead>
                  <tr class="bg-muted/50 text-muted-foreground">
                    <th class="px-3 py-2 text-left font-semibold">Período</th>
                    <th class="px-3 py-2 text-right font-semibold">E. Base<br><span class="font-normal">(€/kWh)</span></th>
                    <th class="px-3 py-2 text-right font-semibold text-primary-button">+ Incr.<br><span class="font-normal">(€/kWh)</span></th>
                    <th class="px-3 py-2 text-right font-semibold">E. Oferta<br><span class="font-normal">(€/kWh)</span></th>
                    <th class="px-3 py-2 text-right font-semibold">Potencia<br><span class="font-normal">(€/kW/día)</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of priceTable(); track row.periodo) {
                    <tr class="border-t border-border">
                      <td class="px-3 py-2 font-semibold text-foreground">P{{ row.periodo }}</td>
                      <td class="px-3 py-2 text-right text-muted-foreground">{{ row.energiaBase | number:'1.4-4' }}</td>
                      <td class="px-3 py-2 text-right text-primary-button font-medium">+{{ (row.energiaOferta - row.energiaBase) | number:'1.4-4' }}</td>
                      <td class="px-3 py-2 text-right font-semibold text-foreground">{{ row.energiaOferta | number:'1.4-4' }}</td>
                      <td class="px-3 py-2 text-right text-foreground">{{ row.potenciaOferta | number:'1.4-4' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <!-- Result cards -->
          @if (showCards()) {
            <div class="grid grid-cols-2 gap-3">

              <!-- Comisión comercial -->
              <div class="rounded-xl border border-border bg-card px-4 py-4 space-y-2">
                <p class="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Comisión comercial</p>
                <div class="flex items-end gap-1.5">
                  <span class="text-2xl font-bold text-primary-button">{{ commissionFmt() }} €</span>
                  <span class="text-sm text-muted-foreground mb-0.5">/ año</span>
                </div>
                <p class="text-xs text-muted-foreground">
                  + {{ commissionPct() }}% · {{ periodosUsados() }} registros
                </p>
              </div>

              <!-- Ahorro cliente -->
              <div class="rounded-xl border border-border bg-card px-4 py-4 space-y-2">
                <p class="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Ahorro cliente</p>
                <div class="space-y-0.5">
                  <p class="text-lg font-bold" [style.color]="annualSavings() >= 0 ? 'var(--color-accent,#12AFF0)' : '#f87171'">
                    {{ monthlySavingsFmt() }} € <span class="text-xs font-normal text-muted-foreground">/ mes</span>
                  </p>
                  <p class="text-base font-semibold" [style.color]="annualSavings() >= 0 ? 'var(--color-accent,#12AFF0)' : '#f87171'">
                    {{ annualSavingsFmt() }} € <span class="text-xs font-normal text-muted-foreground">/ año</span>
                  </p>
                </div>
                <p class="text-xs font-medium" [style.color]="annualSavings() >= 0 ? 'var(--color-accent,#12AFF0)' : '#f87171'">
                  {{ savingsPctFmt() }}% de variación
                </p>
              </div>

            </div>

            <!-- Consumption summary -->
            <div class="flex gap-3">
              <div class="flex-1 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm">
                <p class="text-xs text-muted-foreground">Consumo anual</p>
                @if (hasConsumptionData()) {
                  <p class="font-semibold text-foreground">{{ annualKwhFmt() }} kWh</p>
                } @else {
                  <p class="text-muted-foreground italic text-xs">Sin datos SIPS</p>
                }
              </div>
              <div class="flex-1 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm">
                <p class="text-xs text-muted-foreground">Potencia total</p>
                <p class="font-semibold text-foreground">{{ totalKwFmt() }} kW</p>
              </div>
            </div>
          }

          <!-- Footer -->
          <div class="border-t border-border pt-4 flex items-center justify-between">
            <ui-button label="Volver"    variant="secondary" size="sm" type="button" (click)="onBack()" />
            <ui-button label="Siguiente" size="sm"           type="submit" />
          </div>

        </form>
      </div>
    </div>
  `,
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
  readonly feeEnergia      = signal(50);
  readonly feePotencia     = signal(50);
  readonly omiePrice       = signal(50);
  readonly localTariffCode = signal('');

  readonly tramiteOptions = TRAMITE_OPTIONS;

  private readonly provider = toSignal(this.providerService.getByUser(), { initialValue: null });

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
        .filter(prod => prod.isAvailable !== false)
        .map(prod => ({ value: prod.id.toString(), label: prod.name }))
    );
  });

  readonly selectedProductName = computed(() => {
    const id = parseInt(this.selectedProduct());
    if (!id) return '';
    for (const t of (this.provider()?.tariffs ?? [])) {
      const prod = t.products.find(p => p.id === id);
      if (prod) return prod.name;
    }
    return '';
  });

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

  private commissionBase(): number {
    const name = this.selectedProductName();
    const code = this.localTariffCode();
    const tariff  = this.provider()?.tariffs.find(t => t.code === code);
    const product = tariff?.products.find(p => p.name === name);
    if (product?.commissionPercentage != null) return product.commissionPercentage / 100;
    if (SNAP_ENERGIA[name] !== undefined) return SNAP_ENERGIA[name];
    if (INDEX_ENERGIA[name] !== undefined) return INDEX_ENERGIA[name];
    return (this.commissionService.commission() || 0) / 100;
  }

  private buildOcr(referenceTotal: number): OcrResult {
    return {
      total:    referenceTotal,
      energia:  this.annualKwhByPeriod().map((kwh, i) => ({ p: i + 1, activa: { kwh } })),
      potencia: this.contractedKwByPeriod().map(kw => ({ contratada: { kw } })),
      periodo_facturacion:  { numero_dias: 365 },
      totales_electricidad: { energia: { activa: 0 }, potencia: { contratada: 0 } },
    };
  }

  // ── calculation ────────────────────────────────────────────────────────────

  readonly showCards = computed(() =>
    !!this.selectedProductName() && !!this.localTariffCode()
  );

  private readonly calcFull = computed<CalcFull | null>(() => {
    const tariffs = this.provider()?.tariffs ?? [];
    const code    = this.localTariffCode();
    const name    = this.selectedProductName();
    if (!tariffs.length || !code || !name) return null;

    const commBase = this.commissionBase();

    const formRef: ComparadorFormValue = {
      tariff: code, producto: name,
      precioMedio: this.omiePrice(), feeEnergia: 0, feePotencia: 0, comisionEnergia: 0,
    };
    const ref = calcularFactura(formRef, this.buildOcr(0), tariffs);
    const referenceTotal = -ref.ahorroEstudio;

    const formActual: ComparadorFormValue = {
      tariff: code, producto: name,
      precioMedio: this.omiePrice(),
      feeEnergia:  this.feeEnergia(),
      feePotencia: this.feePotencia(),
      comisionEnergia: commBase,
    };
    const result = calcularFactura(formActual, this.buildOcr(referenceTotal), tariffs);
    return { ref, result, referenceTotal };
  });

  readonly calcResult    = computed(() => this.calcFull()?.result ?? null);

  readonly priceTable = computed<PriceRow[]>(() => {
    const full = this.calcFull();
    if (!full) return [];
    return full.result.periodos.map(p => ({
      periodo:        p.periodo,
      energiaBase:    full.ref.periodos.find(r => r.periodo === p.periodo)?.precioEnergiaOferta ?? 0,
      energiaOferta:  p.precioEnergiaOferta,
      potenciaOferta: p.precioPotenciaOferta,
    }));
  });

  readonly commission    = computed(() => this.calcResult()?.comision      ?? 0);
  readonly annualSavings = computed(() => this.calcResult()?.ahorroEstudio ?? 0);
  readonly monthlySavings = computed(() => Math.round((this.annualSavings() / 12) * 100) / 100);
  readonly savingsPct    = computed(() => this.calcResult()?.ahorro_porcent ?? 0);
  readonly commissionPct = computed(() => this.commissionService.commission());

  readonly commissionFmt     = computed(() => fmt2(this.commission()));
  readonly annualSavingsFmt  = computed(() => fmt2(this.annualSavings()));
  readonly monthlySavingsFmt = computed(() => fmt2(this.monthlySavings()));
  readonly savingsPctFmt     = computed(() =>
    this.savingsPct().toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );

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

    this.store.setProduct({
      tramiteTypes:  this.tramites(),
      tipoProducto:  this.selectedProduct(),
      productName:   this.selectedProductName(),
      tariffCode:    this.localTariffCode(),
      feeEnergia:    this.feeEnergia(),
      feePotencia:   this.feePotencia(),
      omiePrice:     this.omiePrice(),
      commission:    this.commission(),
      annualSavings: this.annualSavings(),
    });

    this.router.navigate(['/dashboard/fast-discharge/documents']);
  }
}
