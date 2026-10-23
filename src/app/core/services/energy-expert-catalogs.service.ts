import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EnergyExpertCatalogs } from '../models/energy-expert-catalogs.model';

/**
 * Catálogos de Autoconsumo (tarifas + los desplegables de generación/
 * compensación) para el alta rápida de Luz. Cualquier usuario autenticado
 * puede pedirlos (no hace falta ser Master). Se cachean en el backend contra
 * Control (EE) y recién se pueblan después de correr una alta real en ese
 * mismo proceso — antes de eso, cada campo sale en null.
 */
@Injectable({ providedIn: 'root' })
export class EnergyExpertCatalogsService {
  private readonly http = inject(HttpClient);

  getCatalogs(): Observable<EnergyExpertCatalogs> {
    return this.http.get<EnergyExpertCatalogs>(`${environment.apiUrl}/energy-expert/catalogs`);
  }
}
