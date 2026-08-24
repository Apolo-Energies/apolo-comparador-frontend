import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SipsApiResponse, SipsConsumo } from '../entities/sips.model';


@Injectable({ providedIn: 'root' })
export class SipsService {
  private readonly http = inject(HttpClient);

  getByCups(cups: string): Observable<SipsApiResponse> {
    return this.http.post<SipsApiResponse>(`${environment.apiUrl}/sips`, { cups });
  }

  downloadExcel(cups: string): Observable<Blob> {
    return this.http.post(`${environment.apiUrl}/sips/sips-excel`, { cups }, { responseType: 'blob' });
  }

  downloadMultiExcel(cups: string[]): Observable<Blob> {
    return this.http.post(`${environment.apiUrl}/sips/multi-excel`, { cups }, { responseType: 'blob' });
  }
}

// Consumo anual real desde el histórico SIPS luz. Ancla en la fecha más reciente
// disponible (no en hoy) porque CNMC publica con desfase — mismo criterio que usa
// GasSipsConsumptionRepository.GetAnnualKwhAsync en el backend gas.
//
// Umbrales de cobertura temporal (por días de datos reales, respeta huecos):
//  - < 90 días: SIPS insuficiente (1 sola estación) → 0 para caer al fallback de factura.
//  - 90-354 días: SIPS parcial pero cubre varias estaciones → escalar linealmente a 365.
//  - ≥ 355 días: año casi completo → suma directa (evita ruido por 1-2 días residuo).
export function sumAnnualKwh(consumos: SipsConsumo[] | undefined): number {
  if (!consumos?.length) return 0;
  const withEndDate = consumos.filter(c => !!c.fechaFin);
  if (!withEndDate.length) return 0;

  const latest = withEndDate
    .map(c => c.fechaFin)
    .sort((a, b) => b.localeCompare(a))[0];
  const anchor = new Date(latest);
  if (Number.isNaN(anchor.getTime())) return 0;
  const oneYearBack = new Date(anchor);
  oneYearBack.setFullYear(anchor.getFullYear() - 1);

  const inRange = withEndDate.filter(c => {
    const inicio = new Date(c.fechaInicio);
    return !Number.isNaN(inicio.getTime()) && inicio >= oneYearBack;
  });
  if (!inRange.length) return 0;

  const sumaKwh = inRange.reduce(
    (sum, c) =>
      sum +
      (c.energiaP1 ?? 0) + (c.energiaP2 ?? 0) + (c.energiaP3 ?? 0) +
      (c.energiaP4 ?? 0) + (c.energiaP5 ?? 0) + (c.energiaP6 ?? 0),
    0,
  );
  if (sumaKwh <= 0) return 0;

  // Días efectivamente cubiertos (suma de duraciones de cada registro). Clamp a 365
  // para evitar inflación por solapes de registros con corrección de datos.
  const daysCovered = Math.min(365, inRange.reduce((sum, c) => {
    const inicio = new Date(c.fechaInicio);
    const fin = new Date(c.fechaFin);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return sum;
    return sum + Math.max(0, (fin.getTime() - inicio.getTime()) / 86400000);
  }, 0));

  if (daysCovered < 90) return 0;
  if (daysCovered >= 355) return sumaKwh;
  return sumaKwh * (365 / daysCovered);
}
