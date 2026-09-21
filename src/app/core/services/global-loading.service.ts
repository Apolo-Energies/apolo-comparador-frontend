import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GlobalLoadingService {
  private readonly _count = signal(0);
  readonly loading = computed(() => this._count() > 0);

  start(): void { this._count.update(n => n + 1); }
  stop(): void  { this._count.update(n => Math.max(0, n - 1)); }
}
