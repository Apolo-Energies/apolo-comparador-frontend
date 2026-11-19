import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type SupportTicketCategory = 'IncidenciaContrato' | 'Comisiones' | 'AccesoPortal' | 'Otro';

export interface SendSupportTicketRequest {
  subject: string;
  category: SupportTicketCategory;
  description: string;
}

export interface SendSupportTicketResponse {
  reference: string;
}

/** "Abrir ticket" de Soporte: POST support/tickets → email al buzón de soporte. */
@Injectable({ providedIn: 'root' })
export class SupportTicketService {
  private readonly http = inject(HttpClient);

  send(req: SendSupportTicketRequest): Observable<SendSupportTicketResponse> {
    return this.http.post<SendSupportTicketResponse>(`${environment.apiUrl}/support/tickets`, req);
  }
}
