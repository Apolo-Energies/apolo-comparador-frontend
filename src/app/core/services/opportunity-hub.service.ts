import { Injectable, OnDestroy } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OpportunitySummary, parseOpportunityStatus } from '../models/opportunity.model';

@Injectable({ providedIn: 'root' })
export class OpportunityHubService implements OnDestroy {
  private connection: HubConnection | null = null;

  private readonly _opportunityUpdated$ = new Subject<OpportunitySummary>();
  readonly opportunityUpdated$ = this._opportunityUpdated$.asObservable();

  start(): void {
    if (this.connection) return;

    this.connection = new HubConnectionBuilder()
      .withUrl(`${environment.hubUrl}?tenant=${environment.clientName}`, { withCredentials: true })
      .withAutomaticReconnect()
      .configureLogging(environment.production ? LogLevel.Error : LogLevel.Warning)
      .build();

    this.connection.on('OpportunityUpdated', (data: OpportunitySummary) => {
      this._opportunityUpdated$.next({
        ...data,
        status: parseOpportunityStatus(data.status as unknown as string | number),
      });
    });

    this.connection.start().catch(err =>
      console.warn('[OpportunityHub] connection error:', err)
    );
  }

  stop(): void {
    this.connection?.stop();
    this.connection = null;
  }

  ngOnDestroy(): void { this.stop(); }
}
