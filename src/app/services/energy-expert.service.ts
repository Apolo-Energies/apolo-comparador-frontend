import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ── View models (mirror del backend `Apolo.Domain.ValueObjects.EnergyExpert`) ──

export interface InvoicesKpis {
  numImpagadas:    number;
  importeImpagado: number;
}

export interface PieSegment {
  label: string;
  value: number;
  color: string | null;
}

export interface PieBreakdown {
  total:    number;
  segments: PieSegment[];
}

/** Devuelto por /portal/contratos-consumos — ambos pies en una sola llamada. */
export interface ServicesKpis {
  contratos: PieBreakdown;
  consumos:  PieBreakdown;
}

export interface AltasBajasPoint {
  etiqueta:     string;
  fecha:        string | null;
  altas:        number | null;
  bajas:        number | null;
  renovaciones: number | null;
}

export interface AltasBajasSeries {
  points: AltasBajasPoint[];
}

export interface Delegacion {
  id:      number;
  nombre:  string;
  logoUrl: string | null;
}

export interface LiquidacionesKpis {
  numeroTotal:     number;
  importeTotal:    number;
  numeroActivas:   number;
  importeActivas:  number;
  numeroEmitidas:  number;
  importeEmitidas: number;
  numeroOtros:     number;
  importeOtros:    number;
}

/**
 * Thin wrapper sobre los endpoints /energy-expert/portal/* del backend, que a su vez
 * scrapean el dashboard del portal /Comerciales/ reutilizando la sesión de wences@.
 * Los números que devuelve son los mismos que muestra el portal MVC.
 */
@Injectable({ providedIn: 'root' })
export class EnergyExpertService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/energy-expert/portal`;

  /**
   * Todos los métodos de lectura aceptan `idDelegacion`:
   * - `undefined` o `null` → "Todos" (para Masters). Los non-Master users son forzados en
   *    backend a su propia delegación del JWT, ignorando este parámetro.
   * - número → filtra por esa delegación (solo para Master; para non-Master no tiene efecto).
   */
  getInvoicesKpis(idDelegacion?: number | null): Observable<InvoicesKpis> {
    return this.http.get<InvoicesKpis>(`${this.baseUrl}/invoices/resumen`, { params: this.delegParams(idDelegacion) });
  }

  getServicesKpis(idDelegacion?: number | null): Observable<ServicesKpis> {
    return this.http.get<ServicesKpis>(`${this.baseUrl}/contratos-consumos`, { params: this.delegParams(idDelegacion) });
  }

  getAltasBajas(tipo: 'meses' | 'dias', fechas?: string, idDelegacion?: number | null): Observable<AltasBajasSeries> {
    let params = new HttpParams().set('tipo', tipo);
    if (fechas)                             params = params.set('fechas',       fechas);
    if (idDelegacion != null)               params = params.set('idDelegacion', idDelegacion);
    return this.http.get<AltasBajasSeries>(`${this.baseUrl}/altas-bajas`, { params });
  }

  getLiquidacionesKpis(idDelegacion?: number | null): Observable<LiquidacionesKpis> {
    return this.http.get<LiquidacionesKpis>(`${this.baseUrl}/liquidaciones`, { params: this.delegParams(idDelegacion) });
  }

  getDelegaciones(): Observable<Delegacion[]> {
    return this.http.get<Delegacion[]>(`${this.baseUrl}/delegaciones`);
  }

  private delegParams(idDelegacion?: number | null): HttpParams {
    let params = new HttpParams();
    if (idDelegacion != null) params = params.set('idDelegacion', idDelegacion);
    return params;
  }
}
