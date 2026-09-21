import { ComparatorService } from '../../../../core/services/comparator.service';
import { CommissionService } from '../../../../core/services/commission.service';
import { ComparadorFormValue, OcrResult } from '../../../../core/models/comparator.model';
import { ComparadorUser, ComparatorProductsByTariff } from '../comparator/comparator-ui.model';
import { MultiItem } from './comparator-multiple.helpers';

/** Dependencias que necesita el cálculo de un formulario/resultado de comparación. */
export interface ComputeContext {
  comparatorService: ComparatorService;
  commissionService: CommissionService;
  selectedUser:       () => ComparadorUser | null;
  isReferrer:         () => boolean;
  productsByTariff:   () => ComparatorProductsByTariff;
  globals:            () => { feeEnergia: number; feePotencia: number; precioMedio: number };
}

function resolveCommissionPct(ctx: ComputeContext): number | undefined {
  return (ctx.selectedUser()?.commissionPct ?? ctx.commissionService.commission()) || undefined;
}

/** Construye el formulario inicial de una factura recién procesada para una tarifa dada. */
export function buildForm(ctx: ComputeContext, ocr: OcrResult, tariff: string): ComparadorFormValue {
  const producto = ctx.productsByTariff()[tariff]?.[0] ?? '';
  const comision = ctx.comparatorService.getComisionBase(producto, tariff, resolveCommissionPct(ctx));
  const globals  = ctx.globals();
  return {
    tariff, producto,
    precioMedio: globals.precioMedio,
    feeEnergia:  globals.feeEnergia,
    feePotencia: globals.feePotencia,
    comisionEnergia: comision,
  };
}

/** Recalcula el resultado de un item aplicando la comisión correspondiente al formulario dado. */
export function computeItem(ctx: ComputeContext, item: MultiItem, form: ComparadorFormValue): MultiItem {
  const base = ctx.comparatorService.getComisionBase(form.producto, form.tariff, resolveCommissionPct(ctx));
  const correctedForm = ctx.isReferrer() ? form : { ...form, comisionEnergia: base };
  const result = ctx.comparatorService.calculate(correctedForm, item.ocrResult!);
  return { ...item, form: correctedForm, result };
}
