import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ContractAction, ContractStatusResponse } from '../entities/contract-status.model';

@Injectable({ providedIn: 'root' })
export class ContractStatusService {
  private readonly http = inject(HttpClient);

  readonly status  = signal<ContractStatusResponse | null>(null);
  readonly loading = signal(false);

  readonly availableActions    = computed(() => this.status()?.availableActions ?? [] as ContractAction[]);
  readonly signatureStatus     = computed(() => this.status()?.contract?.signatureStatus ?? null);
  readonly completionPct       = computed(() => this.status()?.documents.completionPercentage ?? 0);
  readonly daysUntilExpiration = computed(() => this.status()?.contract?.daysUntilExpiration ?? null);
  readonly contractId          = computed(() => this.status()?.contract?.id ?? null);

  readonly canRequestSignature = computed(() => this.availableActions().includes('RequestSignature'));
  readonly canRenew            = computed(() => this.availableActions().includes('Renew'));
  readonly canResend           = computed(() => this.availableActions().includes('Resend'));
  readonly isInProgress        = computed(() => this.signatureStatus() === 'InProgress');
  readonly isExpiringSoon      = computed(() => {
    const days = this.daysUntilExpiration();
    return days !== null && days >= 0 && days < 30;
  });
  readonly hasActionableButton = computed(() =>
    this.canRequestSignature() || this.canRenew() || this.canResend()
  );

  load(customerId: string): Observable<ContractStatusResponse> {
    this.loading.set(true);
    return this.http
      .get<ContractStatusResponse>(`${environment.apiUrl}/contracts/contract-status/${customerId}`)
      .pipe(
        tap(s => { this.status.set(s); this.loading.set(false); }),
        catchError(err => { this.loading.set(false); return throwError(() => err); }),
      );
  }

  requestSignature(contractId: string): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/contracts/${contractId}/request-signature`, {});
  }

  renew(customerId: string): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/contracts/renew`, { customerId });
  }

  resend(contractId: string): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/contracts/${contractId}/resend`, {});
  }

  clear(): void {
    this.status.set(null);
  }
}
