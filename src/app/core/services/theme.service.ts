import { computed, DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ColorScheme = 'light' | 'dark';

const STORAGE_KEY = 'color-scheme';

/**
 * Tema blanco / negro del portal.
 * - sin preferencia guardada, sigue al sistema (y reacciona si este cambia);
 * - el selector tiene dos estados: el destino es lo contrario de lo que se ve; si coincide
 *   con el sistema se borra lo guardado en vez de fijarlo;
 * - lo guardado nunca se borra porque el sistema pase a coincidir;
 * - se sincroniza entre pestañas (evento storage) y mantiene <meta name="color-scheme">.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Preferencia guardada: null = seguir al sistema. */
  readonly stored = signal<ColorScheme | null>(this.readStored());
  /** Esquema del sistema operativo. */
  readonly system = signal<ColorScheme>('light');
  /** Tema que se pinta. */
  readonly resolved = computed<ColorScheme>(() => this.stored() ?? this.system());
  readonly isDark = computed(() => this.resolved() === 'dark');

  /** True mientras el portal autenticado está montado (lo marca Layout). */
  readonly portalActive = signal(false);
  /**
   * Tema efectivo para componentes compartidos con páginas públicas (loaders):
   * fuera del portal el login y las públicas no cambian, así que no es "negro".
   */
  readonly portalDark = computed(() => this.portalActive() && this.isDark());

  constructor() {
    if (!this.isBrowser) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    this.system.set(mq.matches ? 'dark' : 'light');
    const onSystem = (e: MediaQueryListEvent) => this.system.set(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onSystem);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      this.stored.set(this.parse(e.newValue));
      this.syncMeta();
    };
    window.addEventListener('storage', onStorage);

    inject(DestroyRef).onDestroy(() => {
      mq.removeEventListener('change', onSystem);
      window.removeEventListener('storage', onStorage);
    });
    this.syncMeta();
  }

  /** Cambia al tema contrario del que se ve (modelo de dos estados). */
  toggle(): void {
    const target: ColorScheme = this.resolved() === 'dark' ? 'light' : 'dark';
    const next = target === this.system() ? null : target;
    this.stored.set(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* datos del sitio bloqueados: el tema se aplica igual, solo no se recuerda */ }
    this.syncMeta();
  }

  /** <meta name="color-scheme">: lo guardado o "light dark" (seguir al sistema). */
  private syncMeta(): void {
    if (!this.isBrowser) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'color-scheme';
      document.head.appendChild(meta);
    }
    meta.content = this.stored() ?? 'light dark';
  }

  private readStored(): ColorScheme | null {
    if (!this.isBrowser) return null;
    try { return this.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
  }

  private parse(v: string | null): ColorScheme | null {
    return v === 'light' || v === 'dark' ? v : null;
  }
}
