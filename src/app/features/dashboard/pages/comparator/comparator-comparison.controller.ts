import { signal } from '@angular/core';
import { ComparatorService } from '../../../../core/services/comparator.service';
import { SipsService, sumAnnualKwh } from '../../../../core/services/sips.service';
import { ComparadorFormValue, ComparadorResult, OcrResult } from '../../../../core/models/comparator.model';
import { ComparadorCompareEvent, ComparadorDownloadEvent } from './comparator-events.model';
import { ComparadorUser } from './comparator-ui.model';

/**
 * Dependencias externas que el controller necesita leer del componente
 * (roles, usuario actual, comisión) sin acoplarse a Angular DI.
 */
export interface ComparisonDeps {
  currentUserId:  () => string | number | undefined;
  isMaster:       () => boolean;
  isReferrer:     () => boolean;
  users:          () => ComparadorUser[];
  commission:     () => number;
  subUserPoolPct: () => number | null;
}

/**
 * Estado y handlers del flujo de comparación: subir factura, esperar el OCR,
 * consultar SIPS, recalcular con el form emitido por el modal y descargar el
 * resultado. Clase plana sin DI de Angular, instanciada por el propio
 * componente `Comparator`.
 */
export class ComparisonController {
  readonly loading        = signal(false);
  readonly modalOpen      = signal(false);
  readonly result         = signal<ComparadorResult | null>(null);
  readonly ocrResult      = signal<OcrResult | null>(null);
  readonly fileId         = signal<string>('');
  readonly selectedUserId = signal<string>('');
  readonly comisionBase   = signal(0);
  /**
   * Consumo anual del CUPS vía SIPS (histórico real 12 meses). Preferido sobre la
   * extrapolación de la factura porque una factura de invierno/verano sesga el anual
   * hasta ±50%. Fallback a extrapolación (kwh × 365/dias) si el CUPS no está en SIPS.
   */
  readonly sipsAnnualKwh  = signal(0);
  /** Último form emitido por el modal — permite recomputar si SIPS llega después. */
  private readonly lastForm = signal<ComparadorFormValue | null>(null);

  constructor(
    private readonly comparatorService: ComparatorService,
    private readonly sipsService: SipsService,
    private readonly deps: ComparisonDeps,
  ) {}

  onCompare(event: ComparadorCompareEvent): void {
    this.loading.set(true);
    this.result.set(null);
    this.ocrResult.set(null);
    this.sipsAnnualKwh.set(0);
    this.lastForm.set(null);

    const selectedId = this.deps.isMaster() ? (event.userId || '') : '';
    this.selectedUserId.set(selectedId);
    const userId = selectedId || this.deps.currentUserId() || '';

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

  onFormChange(form: ComparadorFormValue): void {
    const ocr = this.ocrResult();
    if (!ocr) return;

    const selectedUser  = this.deps.isMaster() ? this.deps.users().find(u => u.id === this.selectedUserId()) : undefined;
    const commissionPct = this.deps.isMaster()
      ? (selectedUser?.commissionPct ?? undefined)
      : (this.deps.commission() || undefined);
    const base = this.comparatorService.getComisionBase(form.producto, form.tariff, commissionPct);
    this.comisionBase.set(base);

    // For non-referrers always override comisionEnergia with the fresh base
    const correctedForm: ComparadorFormValue = this.deps.isReferrer()
      ? form
      : { ...form, comisionEnergia: base };

    this.lastForm.set(correctedForm);
    const calculated = this.comparatorService.calculate(correctedForm, ocr, this.sipsAnnualKwh());

    // Sub-user: scale the full commission (energy + potencia) by their pool percentage
    const poolPct = this.deps.subUserPoolPct();
    if (poolPct !== null) {
      calculated.comision = parseFloat((calculated.comision * poolPct / 100).toFixed(3));
    }

    this.result.set(calculated);
  }

  onDownload(event: ComparadorDownloadEvent): void {
    const targetUserId = this.deps.isMaster() ? (this.selectedUserId() || undefined) : undefined;
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

  /**
   * Consulta SIPS por CUPS y guarda el consumo anual real (suma últimos 12 meses).
   * Si el modal ya empezó a emitir formValues, recomputa con el nuevo dato para que
   * ahorro anual, comisión y PDF queden consistentes.
   */
  private loadSipsAnnualKwh(cups: string | undefined): void {
    if (!cups) return;
    this.sipsService.getByCups(cups).subscribe({
      next: (sips) => {
        const annualKwh = sumAnnualKwh(sips.consumos);
        this.sipsAnnualKwh.set(annualKwh);
        const form = this.lastForm();
        if (form) this.onFormChange(form);
      },
      error: () => this.sipsAnnualKwh.set(0),
    });
  }
}
