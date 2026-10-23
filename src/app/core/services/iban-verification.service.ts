import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IbanVerificationRequest, IbanVerificationResponse } from '../models/iban-verification.model';

@Injectable({ providedIn: 'root' })
export class IbanVerificationService {
  private readonly http = inject(HttpClient);

  verify(payload: IbanVerificationRequest): Observable<IbanVerificationResponse> {
    return this.http.post<IbanVerificationResponse>(`${environment.apiUrl}/iban-verification/verify`, payload);
  }
}
