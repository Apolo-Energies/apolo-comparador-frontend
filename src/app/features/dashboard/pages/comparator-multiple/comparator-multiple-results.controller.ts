import { computed, signal } from '@angular/core';
import { AlertService, SelectOption } from '@apolo-energies/ui';
import { BatchFileResult, ComparatorService } from '../../../../core/services/comparator.service';
import { CommissionService } from '../../../../core/services/commission.service';
import { ComparadorFormValue } from '../../../../core/models/comparator.model';
import { ComparatorProductsByTariff, ComparadorUser } from '../comparator/comparator-ui.model';
import {
  MultiItem, emptyComparadorForm, detectTariff, genId,
} from './comparator-multiple.helpers';
import { ComputeContext, buildForm, computeItem } from './comparator-multiple-compute.helpers';

/** Dependencias externas (computed del componente) que el controller necesita leer. */
export interface ResultsControllerContext {
  selectedUser:     () => ComparadorUser | null;
  isReferrer:       () => boolean;
  productsByTariff: () => ComparatorProductsByTariff;
}

/**
 * Estado y handlers del flujo de resultados de la comparación múltiple:
 * procesar facturas, controles globales, vista de detalle y recálculo.
 * Clase plana sin DI de Angular, instanciada por `ComparatorMultiple`.
 */
export class ResultsController {
  readonly phase         = signal<'upload' | 'results'>('upload');
  readonly viewMode      = signal<'grid' | 'detail'>('grid');
  readonly processing    = signal(false);
  readonly items         = signal<MultiItem[]>([]);
  readonly detailItemId  = signal<string | null>(null);
  readonly periodosOpen  = signal(true);

  readonly globalFeeEnergia  = signal(0);
  readonly globalFeePotencia = signal(0);
  readonly globalPrecioMedio = signal(0);
  readonly globalProducto    = signal('');

  readonly detailItem    = computed(() => this.items().find(i => i.id === this.detailItemId()) ?? null);
  readonly readyCount    = computed(() => this.items().filter(i => i.status === 'ready').length);
  readonly totalAhorro   = computed(() => this.items().reduce((s, i) => s + (i.result?.ahorroXAnio ?? 0), 0));
  readonly totalComision = computed(() => this.items().reduce((s, i) => s + (i.result?.comision ?? 0), 0));

  private readonly computeCtx: ComputeContext;

  constructor(
    private readonly comparatorService: ComparatorService,
    private readonly commissionService: CommissionService,
    private readonly alertService: AlertService,
    private readonly ctx: ResultsControllerContext,
  ) {
    this.computeCtx = {
      comparatorService: this.comparatorService,
      commissionService: this.commissionService,
      selectedUser:       this.ctx.selectedUser,
      isReferrer:         this.ctx.isReferrer,
      productsByTariff:   this.ctx.productsByTariff,
      globals: () => ({
        feeEnergia:  this.globalFeeEnergia(),
        feePotencia: this.globalFeePotencia(),
        precioMedio: this.globalPrecioMedio(),
      }),
    };
  }

  // ── procesar / volver ────────────────────────────────────────────────────

  process(files: File[], userId: string | undefined, onDone: () => void): void {
    this.processing.set(true);
    this.items.set([]);

    this.comparatorService.batchProcess(files, userId).subscribe({
      next: (results: BatchFileResult[]) => {
        const newItems = files.map((file, idx) => this.buildItemFromResult(file, results[idx]));
        this.items.set(newItems);
        this.phase.set('results');
        this.viewMode.set('grid');
        this.processing.set(false);
        onDone();
      },
      error: () => {
        this.alertService.show('Error al procesar las facturas', 'error');
        this.processing.set(false);
      },
    });
  }

  /** Vuelve a la fase de carga, descartando los resultados actuales. */
  reset(): void {
    this.phase.set('upload');
    this.viewMode.set('grid');
    this.items.set([]);
    this.globalFeeEnergia.set(0);
    this.globalFeePotencia.set(0);
    this.globalPrecioMedio.set(0);
  }

  // ── controles globales ──────────────────────────────────────────────────

  onGlobalFeeEnergiaChange(v: number): void  { this.globalFeeEnergia.set(v); this.recalculateAll(); }
  onGlobalFeePotenciaChange(v: number): void { this.globalFeePotencia.set(v); this.recalculateAll(); }

  onGlobalPrecioMedioChange(v: string): void {
    this.globalPrecioMedio.set(Math.min(60, Math.max(0, Number(v) || 0)));
    this.recalculateAll();
  }

  onGlobalProductoChange(value: string): void {
    this.globalProducto.set(value);
    // Auto-set OMIE based on product type of the first ready item
    const firstReady = this.items().find(i => i.status === 'ready');
    if (firstReady) {
      const isIndexed = this.comparatorService.tariffs()
        .find(t => t.code === firstReady.form.tariff)
        ?.products.find(p => p.name === value)?.type === 'Indexed';
      if (!isIndexed) this.globalPrecioMedio.set(0);
      else if (this.globalPrecioMedio() < 20) this.globalPrecioMedio.set(20);
    }
    // Apply to each item — use the product if available for its tariff, otherwise keep current
    this.items.update(list => list.map(item => {
      if (item.status !== 'ready' || !item.ocrResult) return item;
      const available = this.ctx.productsByTariff()[item.form.tariff] ?? [];
      const producto = available.includes(value) ? value : item.form.producto;
      return computeItem(this.computeCtx, item, { ...item.form, producto });
    }));
  }

  // ── vista de detalle ────────────────────────────────────────────────────

  openDetail(id: string): void { this.detailItemId.set(id); this.viewMode.set('detail'); }
  backToGrid(): void { this.viewMode.set('grid'); this.detailItemId.set(null); }

  onDetailTariffChange(item: MultiItem, value: string): void {
    const producto = this.ctx.productsByTariff()[value]?.[0] ?? '';
    this.applyItemChange(item, { ...item.form, tariff: value, producto });
  }

  onDetailProductoChange(item: MultiItem, value: string): void {
    const isIndexed = this.comparatorService.tariffs()
      .find(t => t.code === item.form.tariff)
      ?.products.find(p => p.name === value)
      ?.type === 'Indexed';
    if (!isIndexed) {
      this.globalPrecioMedio.set(0);
    } else if (this.globalPrecioMedio() < 20) {
      this.globalPrecioMedio.set(20);
    }
    this.applyItemChange(item, { ...item.form, producto: value });
    this.recalculateAll();
  }

  productoOptions(tariff: string): SelectOption[] {
    return (this.ctx.productsByTariff()[tariff] ?? []).map(p => ({ value: p, label: p }));
  }

  onDownload(type: 'pdf' | 'excel', isMaster: boolean, selectedUserId: string): void {
    const item = this.detailItem();
    if (!item?.ocrResult || !item.result) return;
    const targetUserId = isMaster ? (selectedUserId || undefined) : undefined;
    this.comparatorService.download(type, item.form, item.result, item.ocrResult, item.fileId, targetUserId);
  }

  retryItem(item: MultiItem, userId: string | undefined): void {
    this.comparatorService.batchProcess([item.file], userId).subscribe({
      next: (results: BatchFileResult[]) => {
        const res = results[0];
        if (!res?.success || !res.data) return;
        const { fileId, ocrData } = res.data;
        const tariff = detectTariff(ocrData, Object.keys(this.ctx.productsByTariff()));
        const form   = buildForm(this.computeCtx, ocrData, tariff);
        const result = this.comparatorService.calculate(form, ocrData);
        this.items.update(list => list.map(i =>
          i.id === item.id
            ? { ...i, status: 'ready' as const, ocrResult: ocrData, result, form, fileId, error: null }
            : i
        ));
      },
      error: () => this.alertService.show('Error al reintentar', 'error'),
    });
  }

  // ── privados ─────────────────────────────────────────────────────────────

  private buildItemFromResult(file: File, res: BatchFileResult | undefined): MultiItem {
    if (!res?.success || !res.data) {
      return {
        id: genId(), file, fileName: file.name, status: 'error',
        ocrResult: null, result: null, form: emptyComparadorForm(),
        fileId: '', error: res?.error ?? 'Error al procesar',
      };
    }
    const { fileId, ocrData } = res.data;
    const tariff = detectTariff(ocrData, Object.keys(this.ctx.productsByTariff()));
    const form   = buildForm(this.computeCtx, ocrData, tariff);
    const result = this.comparatorService.calculate(form, ocrData);
    return {
      id: genId(), file, fileName: file.name, status: 'ready',
      ocrResult: ocrData, result, form, fileId, error: null,
    };
  }

  private recalculateAll(): void {
    this.items.update(list => list.map(item => {
      if (item.status !== 'ready' || !item.ocrResult) return item;
      const form: ComparadorFormValue = {
        ...item.form,
        feeEnergia:  this.globalFeeEnergia(),
        feePotencia: this.globalFeePotencia(),
        precioMedio: this.globalPrecioMedio(),
      };
      return computeItem(this.computeCtx, item, form);
    }));
  }

  private applyItemChange(item: MultiItem, form: ComparadorFormValue): void {
    if (!item.ocrResult) return;
    const updated: ComparadorFormValue = {
      ...form,
      feeEnergia:  this.globalFeeEnergia(),
      feePotencia: this.globalFeePotencia(),
      precioMedio: this.globalPrecioMedio(),
    };
    const result = computeItem(this.computeCtx, item, updated);
    this.items.update(list => list.map(i => i.id === item.id ? result : i));
  }
}
