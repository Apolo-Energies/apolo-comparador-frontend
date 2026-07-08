import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { EnergyType } from '../entities/energy-type.enum';

const STORAGE_KEY = 'apolo:energy-context';

@Injectable({ providedIn: 'root' })
export class EnergyContextService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly _current = signal<EnergyType>(this.readInitial());

  readonly current = this._current.asReadonly();
  readonly isElectricity = computed(() => this._current() === EnergyType.Electricity);
  readonly isGas = computed(() => this._current() === EnergyType.Gas);

  set(value: EnergyType): void {
    this._current.set(value);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(STORAGE_KEY, String(value));
      } catch {
        // ignore quota / privacy mode errors — in-memory state still wins for the session
      }
    }
  }

  toggle(): void {
    this.set(this.isGas() ? EnergyType.Electricity : EnergyType.Gas);
  }

  private readInitial(): EnergyType {
    if (!isPlatformBrowser(this.platformId)) return EnergyType.Electricity;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return EnergyType.Electricity;
      return Number(raw) === EnergyType.Gas ? EnergyType.Gas : EnergyType.Electricity;
    } catch {
      return EnergyType.Electricity;
    }
  }
}
