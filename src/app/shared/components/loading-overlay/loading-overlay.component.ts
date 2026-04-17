import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  template: `
    @if (loading()) {
      <div class="fixed inset-0 z-50 bg-black/50 flex flex-col items-center justify-center gap-4">
        <div class="h-16 w-16 rounded-full border-4 border-white/20 border-t-primary animate-spin"></div>
        <p class="text-white text-sm font-medium tracking-wide">Cargando...</p>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlayComponent {
  readonly loading = input(false);
}
