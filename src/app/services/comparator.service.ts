import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { ComparadorFormValue, ComparadorResult, OcrResult } from '../features/dashboard/pages/comparator/comparator.models';
import { environment } from '../../environments/environment';
import { Tariff } from '../entities/provider.model';
import { ProviderService } from './provider.service';
import { CommissionService } from './commission.service';
import { calcularFactura } from './calculator.helpers';

const PERIOD_LABELS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;

const SNAP_ENERGIA: Record<string, number> = {
  'Fijo Snap Mini': 50,
  'Fijo Snap': 75,
  'Fijo Snap Maxi': 100,
};

const INDEX_ENERGIA: Record<string, number> = {
  'Index Coste': 0.5,
  'Index Base': 0.55,
  'Index Promo': 0.85,
};

const SNAP_PRODUCTS = ['Fijo Snap Mini', 'Fijo Snap', 'Fijo Snap Maxi'];

@Injectable({ providedIn: 'root' })
export class ComparatorService {
  private http = inject(HttpClient);
  private providerService = inject(ProviderService);
  private commissionService = inject(CommissionService);

  readonly tariffs = signal<Tariff[]>([]);
  private loaded = false;

  loadTariffs() {
    if (this.loaded) return;
    this.providerService.getByUser().pipe(
      tap(res => {
        this.tariffs.set(res.tariffs);
        this.loaded = true;
      })
    ).subscribe();
  }

  getComisionBase(producto: string): number {
    if (SNAP_PRODUCTS.includes(producto)) {
      const result = SNAP_ENERGIA[producto] ?? 0;
      console.log('[getComisionBase] SNAP:', { producto, result });
      return result;
    }

    const indexValue = INDEX_ENERGIA[producto];
    if (indexValue !== undefined) {
      console.log('[getComisionBase] INDEX:', { producto, result: indexValue });
      return indexValue;
    }

    // Cualquier otro producto → comisión del usuario (percentage / 100)
    const pct = this.commissionService.commission();
    const result = pct ? pct / 100 : 0;
    console.log('[getComisionBase] USER commission:', { producto, pct, result });
    return result;
  }

  upload(file: File, userId: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('userId', userId);
    return this.http.post<{ fileId: string; ocrData: OcrResult }>(`${environment.apiUrl}/file/upload-and-process`, form);
  }

  calculate(form: ComparadorFormValue, ocr: OcrResult): ComparadorResult {
    return calcularFactura(form, ocr, this.tariffs());
  }

  download(type: 'pdf' | 'excel', form: ComparadorFormValue, result: ComparadorResult | null, ocr: OcrResult | null, fileId: string) {
    if (!result || !ocr) return;

    const dias = result.dias ?? ocr.periodo_facturacion?.numero_dias ?? 0;
    const totalActual = ocr.total ?? 0;
    const totalOferta = totalActual - result.ahorroEstudio;

    const baseActual = (ocr.totales_electricidad?.energia?.activa ?? 0)
      + (ocr.totales_electricidad?.potencia?.contratada ?? 0);
    const ieActual = ocr.ie?.importe ?? 0;
    const ivaActual = ocr.iva?.importe ?? 0;

    const subTotalOferta = totalOferta / (1 + 0.21);
    const ieOferta = subTotalOferta * 0.0511269632 / (1 + 0.0511269632);
    const baseOferta = subTotalOferta - ieOferta;
    const ivaOferta = totalOferta - subTotalOferta;

    const lineas = [
      ...PERIOD_LABELS.map((label, idx) => {
        const kwh = ocr.energia?.[idx]?.activa?.kwh ?? 0;
        const precioActual = ocr.energia?.[idx]?.activa?.tarifa ?? 0;
        const costeActual = ocr.energia?.[idx]?.activa?.importe ?? 0;
        const periodo = result.periodos.find(p => Number(p.periodo) === idx + 1);
        return {
          termino: `ENERGÍA ${label}`,
          unidad: 'kWh',
          valor: kwh,
          precioActual,
          costeActual,
          precioOferta: periodo?.precioEnergiaOferta ?? 0,
          costeOferta: periodo?.costeEnergia ?? 0,
        };
      }),
      ...PERIOD_LABELS.map((label, idx) => {
        const kw = ocr.potencia?.[idx]?.contratada?.kw ?? 0;
        const precioActual = ocr.potencia?.[idx]?.contratada?.tarifa ?? 0;
        const costeActual = ocr.potencia?.[idx]?.contratada?.importe ?? 0;
        const periodo = result.periodos.find(p => Number(p.periodo) === idx + 1);
        return {
          termino: `POTENCIA ${label}`,
          unidad: 'kW',
          valor: kw,
          precioActual,
          costeActual,
          precioOferta: periodo?.precioPotenciaOferta ?? 0,
          costeOferta: periodo?.costePotencia ?? 0,
        };
      }),
    ];

    const payload = {
      fileId,
      cups: ocr.cliente?.cups ?? '',
      providerId: 1,
      datos: {
        titulo: 'Comparativa de oferta',
        tarifa: form.tariff,
        modalidad: form.producto,
        periodo: ocr.periodo_facturacion?.fecha_fin ?? '',
        diasFactura: dias,
        ahorro: result.ahorroEstudio,
        ahorroPorcentaje: result.ahorro_porcent,
        ahorroAnual: result.ahorroXAnio,
        consumoAnual: (ocr.energia?.reduce((a, e) => a + (e.activa?.kwh ?? 0), 0) ?? 0) * 10,
        precioPromedioOmie: form.precioMedio,
        feeEnergia: form.feeEnergia,
        feePotencia: form.feePotencia,
      },
      cliente: {
        nombreCliente: ocr.cliente?.titular ?? '',
        razonSocial: '',
        cif: ocr.cliente?.nif ?? '',
        direccion: [
          ocr.cliente?.direccion?.tipo_via,
          ocr.cliente?.direccion?.nombre_via,
          ocr.cliente?.direccion?.numero,
          ocr.cliente?.direccion?.detalles,
        ].filter(Boolean).join(' '),
        cp: ocr.cliente?.direccion?.cp ?? '',
        provincia: ocr.cliente?.direccion?.provincia ?? '',
      },
      totales: {
        baseActual,
        baseOferta: Number(baseOferta.toFixed(2)),
        impuestoElectricoActual: ieActual,
        impuestoElectricoOferta: Number(ieOferta.toFixed(2)),
        alquilerEquipo: 0,
        ivaActual,
        ivaOferta: Number(ivaOferta.toFixed(2)),
        totalActual,
        totalOferta: Number(totalOferta.toFixed(2)),
        otrosNoComunesActual: 0,
        otrosNoComunesOferta: 0,
        otrosComunesSinIeActual: 0,
        otrosComunesSinIeOferta: 0,
        otrosComunesConIeActual: 0,
        otrosComunesConIeOferta: 0,
      },
      lineas,
    };

    return this.http.post(
      `${environment.apiUrl}/reports/${type}`,
      payload,
      { responseType: 'blob' }
    ).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comparador.${type === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}
