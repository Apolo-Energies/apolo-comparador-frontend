import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { BRAND_THEMES, DEFAULT_BRAND, LoaderBrand, LoaderTheme } from './brand-loader.config';

const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_ARC_RATIO = 0.3;
const SIMULATION_CAP = 92;
const SIMULATION_INTERVAL_MS = 220;

@Component({
  selector: 'app-brand-loader',
  standalone: true,
  templateUrl: './brand-loader.component.html',
  styleUrl: './brand-loader.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandLoaderComponent {
  readonly visible = input<boolean>(true);
  readonly fullscreen = input<boolean>(true);
  readonly inline = input<boolean>(false);
  readonly title = input<string>('Analizando tu factura');
  readonly description = input<string | null>(
    'Estamos procesando tu documento para encontrar la mejor propuesta de ahorro.',
  );
  readonly microcopy = input<string | null>('Esto puede tardar unos segundos');
  readonly progress = input<number | null>(null);
  readonly brand = input<LoaderBrand | null>(null);
  readonly size = input<number>(160);

  // ── section toggles (each part can be shown/hidden independently) ─────────
  readonly showBackdrop    = input<boolean>(true);
  readonly showLogo        = input<boolean>(true);
  readonly showWordmark    = input<boolean>(true);
  readonly showTitle       = input<boolean>(true);
  readonly showDescription = input<boolean>(true);
  readonly showBar         = input<boolean>(true);
  readonly showPercent     = input<boolean>(true);
  readonly showMicrocopy     = input<boolean>(true);
  readonly showMicrocopyIcon = input<boolean>(true);

  readonly radius = RING_RADIUS;
  readonly ringDashArray = `${RING_CIRCUMFERENCE * RING_ARC_RATIO} ${RING_CIRCUMFERENCE}`;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly simulated = signal(0);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  readonly theme = computed<LoaderTheme>(() => {
    const active = this.brand() ?? (environment.clientName as LoaderBrand) ?? DEFAULT_BRAND;
    return BRAND_THEMES[active] ?? BRAND_THEMES[DEFAULT_BRAND];
  });

  readonly displayProgress = computed(() => {
    const real = this.progress();
    if (real !== null && real !== undefined) {
      return Math.max(0, Math.min(100, real));
    }
    return this.simulated();
  });

  readonly progressLabel = computed(() => `${Math.round(this.displayProgress())}%`);

  readonly outerClass = computed(() => {
    if (this.inline()) return 'flex items-center justify-center';
    const pos = this.fullscreen() ? 'fixed' : 'absolute';
    const overlay = this.showBackdrop() ? 'bl-overlay' : '';
    return `${pos} inset-0 z-50 flex items-center justify-center ${overlay}`.trim();
  });

  readonly outerBackground = computed(() =>
    !this.inline() && this.showBackdrop() ? this.theme().backdrop : null,
  );

  constructor() {
    effect((onCleanup) => {
      const visible = this.visible();
      const hasReal = this.progress() !== null && this.progress() !== undefined;

      if (!isPlatformBrowser(this.platformId)) return;

      if (visible && !hasReal) {
        this.startSimulation();
      } else {
        this.stopSimulation();
        if (!visible) this.simulated.set(0);
      }

      onCleanup(() => this.stopSimulation());
    });
  }

  private startSimulation(): void {
    if (this.intervalId !== null) return;
    this.simulated.set(0);
    this.intervalId = setInterval(() => {
      this.simulated.update((v) => {
        const remaining = SIMULATION_CAP - v;
        if (remaining <= 0) return v;
        const step = Math.max(0.4, remaining * 0.035);
        return Math.min(SIMULATION_CAP, v + step);
      });
    }, SIMULATION_INTERVAL_MS);
  }

  private stopSimulation(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
