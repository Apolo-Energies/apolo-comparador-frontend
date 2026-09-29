import { computed, signal } from '@angular/core';
import { SelectOption } from '@apolo-energies/ui';
import { ComparadorFormValue, FeeMode } from '../../../../../../core/models/comparator.model';
import { ComparatorProductsByTariff } from '../../comparator-ui.model';
import { emptyPeriods } from './comparator-modal.helpers';

/** Dependencias externas (inputs del componente) que el controller necesita leer. */
export interface ComparatorFormControllerContext {
  productsByTariff:  () => ComparatorProductsByTariff;
  feeLockedProducts: () => string[];
  isReferrer:        () => boolean;
  comisionBase:      () => number;
  /** Se invoca tras cada cambio manual del colaborador (no en el reset por factura nueva). */
  onChange:          () => void;
}

/**
 * Estado y handlers del formulario de tarifa / producto / fees (global y por
 * período) / comisión del modal de comparación. Clase plana sin DI de
 * Angular, instanciada por `ComparatorModalComponent`.
 */
export class ComparatorFormController {
  readonly tariff          = signal('');
  readonly producto        = signal('');
  readonly precioMedio     = signal(0);
  readonly feeEnergia      = signal(0);
  readonly feePotencia     = signal(0);
  readonly comisionEnergia = signal(0);

  // Fees por período (P1..P6). Sólo se aplican cuando feeMode() === FeeMode.Periods.
  readonly feeMode             = signal<FeeMode>(FeeMode.Global);
  readonly feeEnergiaByPeriod  = signal<number[]>(emptyPeriods());
  readonly feePotenciaByPeriod = signal<number[]>(emptyPeriods());

  // Nº de periodos relevantes según la tarifa. 2.0TD → 3 energía / 2 potencia.
  // Resto (3.0TD, 6.X) → 6 y 6.
  readonly energiaPeriods = computed<number[]>(() =>
    this.tariff().startsWith('2.') ? [1, 2, 3] : [1, 2, 3, 4, 5, 6]
  );
  readonly potenciaPeriods = computed<number[]>(() =>
    this.tariff().startsWith('2.') ? [1, 2] : [1, 2, 3, 4, 5, 6]
  );
  readonly energiaGridClass = computed(() =>
    this.tariff().startsWith('2.') ? 'grid-cols-3' : 'grid-cols-6'
  );
  readonly potenciaGridClass = computed(() =>
    this.tariff().startsWith('2.') ? 'grid-cols-2' : 'grid-cols-6'
  );

  readonly hasEnergiaOverrides = computed(() =>
    this.feeEnergiaByPeriod().some(v => v !== this.feeEnergia())
  );
  readonly hasPotenciaOverrides = computed(() =>
    this.feePotenciaByPeriod().some(v => v !== this.feePotencia())
  );
  readonly hasPerPeriodOverrides = computed(() =>
    this.hasEnergiaOverrides() || this.hasPotenciaOverrides()
  );

  // ── derived select options ─────────────────────────────────────────────────
  readonly tarifaOptions = computed<SelectOption[]>(() =>
    Object.keys(this.ctx.productsByTariff()).map(t => ({ value: t, label: t }))
  );

  readonly productoOptions = computed<SelectOption[]>(() =>
    (this.ctx.productsByTariff()[this.tariff()] ?? []).map(p => ({ value: p, label: p }))
  );

  readonly isFeeBlocked = computed(() =>
    this.ctx.feeLockedProducts().includes(this.producto())
  );

  readonly effectiveComision = computed(() =>
    this.ctx.isReferrer() ? this.comisionEnergia() : this.ctx.comisionBase()
  );

  constructor(private readonly ctx: ComparatorFormControllerContext) {}

  /** Reset completo del formulario al llegar un OCR nuevo (factura distinta).
   *  No dispara onChange: el caller emite una sola vez tras resetear todo. */
  reset(tariff: string, producto: string, referrerDefaultFee: number): void {
    this.tariff.set(tariff);
    this.producto.set(producto);
    this.precioMedio.set(0);
    this.feeEnergia.set(0);
    this.feePotencia.set(0);
    this.comisionEnergia.set(referrerDefaultFee);
    this.feeMode.set(FeeMode.Global);
    this.feeEnergiaByPeriod.set(emptyPeriods());
    this.feePotenciaByPeriod.set(emptyPeriods());
  }

  /** Sincroniza la comisión con la base cuando el colaborador no es referrer. */
  syncComisionBase(base: number): void {
    if (!this.ctx.isReferrer()) this.comisionEnergia.set(base);
  }

  // ── form handlers ──────────────────────────────────────────────────────────

  onTariffChange(value: string): void {
    const producto = this.ctx.productsByTariff()[value]?.[0] ?? '';
    this.tariff.set(value);
    this.producto.set(producto);
    this.applyFeeBlocking(producto);
    this.ctx.onChange();
  }

  onProductoChange(value: string): void {
    this.producto.set(value);
    this.applyFeeBlocking(value);
    this.ctx.onChange();
  }

  onPrecioMedioChange(value: string): void {
    this.precioMedio.set(Number(value) || 0);
    this.ctx.onChange();
  }

  onFeeEnergiaChange(value: number): void {
    this.feeEnergia.set(value);
    this.ctx.onChange();
  }

  onFeePotenciaChange(value: number): void {
    this.feePotencia.set(value);
    this.ctx.onChange();
  }

  onFeeModeChange(mode: FeeMode): void {
    if (this.isFeeBlocked()) return;
    // Al entrar en Periods por primera vez, inicializamos los inputs con el
    // valor global para que el usuario sólo modifique lo que necesite.
    if (mode === FeeMode.Periods) {
      if (this.feeEnergiaByPeriod().every(v => v === 0) || !this.hasEnergiaOverrides()) {
        this.feeEnergiaByPeriod.set(Array(6).fill(this.feeEnergia()));
      }
      if (this.feePotenciaByPeriod().every(v => v === 0) || !this.hasPotenciaOverrides()) {
        this.feePotenciaByPeriod.set(Array(6).fill(this.feePotencia()));
      }
    }
    this.feeMode.set(mode);
    this.ctx.onChange();
  }

  onFeeEnergiaPeriodChange(index: number, raw: string | number): void {
    const value = typeof raw === 'string' ? parseFloat(raw.replace(',', '.')) : raw;
    const safe  = Number.isFinite(value) ? value : 0;
    const arr = [...this.feeEnergiaByPeriod()];
    arr[index] = safe;
    this.feeEnergiaByPeriod.set(arr);
    this.ctx.onChange();
  }

  onFeePotenciaPeriodChange(index: number, raw: string | number): void {
    const value = typeof raw === 'string' ? parseFloat(raw.replace(',', '.')) : raw;
    const safe  = Number.isFinite(value) ? value : 0;
    const arr = [...this.feePotenciaByPeriod()];
    arr[index] = safe;
    this.feePotenciaByPeriod.set(arr);
    this.ctx.onChange();
  }

  resetFeeEnergiaOverrides(): void {
    this.feeEnergiaByPeriod.set(Array(6).fill(this.feeEnergia()));
    this.ctx.onChange();
  }

  resetFeePotenciaOverrides(): void {
    this.feePotenciaByPeriod.set(Array(6).fill(this.feePotencia()));
    this.ctx.onChange();
  }

  onComisionEnergiaChange(value: string): void {
    this.comisionEnergia.set(Number(value) || 0);
    this.ctx.onChange();
  }

  buildFormValue(): ComparadorFormValue {
    return {
      tariff:              this.tariff(),
      producto:            this.producto(),
      precioMedio:         this.precioMedio(),
      feeEnergia:          this.feeEnergia(),
      feePotencia:         this.feePotencia(),
      comisionEnergia:     this.effectiveComision(),
      feeMode:             this.feeMode(),
      feeEnergiaByPeriod:  this.feeEnergiaByPeriod(),
      feePotenciaByPeriod: this.feePotenciaByPeriod(),
    };
  }

  private applyFeeBlocking(producto: string): void {
    if (this.ctx.feeLockedProducts().includes(producto)) {
      this.feeEnergia.set(0);
      this.feePotencia.set(0);
      this.feeMode.set(FeeMode.Global);
      this.feeEnergiaByPeriod.set(emptyPeriods());
      this.feePotenciaByPeriod.set(emptyPeriods());
    }
  }
}
