import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SipsApiResponse } from '../entities/sips.model';


@Injectable({ providedIn: 'root' })
export class SipsService {
  private readonly http = inject(HttpClient);

  getByCups(cups: string): Observable<SipsApiResponse> {
    return this.http.get<SipsApiResponse>(`${environment.apiUrl}/sips/${cups}`);
  }

  downloadExcel(cups: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/sips/${cups}/excel`, { responseType: 'blob' });
  }
}
