import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Provider } from '../../../../../entities/provider.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-provider-tab',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-card rounded-lg border border-border p-6">
      <!-- Provider name and status badge -->
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-foreground mb-2">{{ provider().name }}</h2>
        <span class="inline-block mt-2 px-3 py-1 text-sm font-medium rounded-lg bg-green-100 text-green-800">
          Activo
        </span>
      </div>

      <!-- Two cards: Tarifas registradas and Estado -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Tarifas registradas card -->
        <div class="bg-background rounded-lg border border-border p-6">
          <p class="text-xl text-foreground mb-3">Tarifas registradas</p>
          <p class="text-5xl font-bold text-foreground text-center">{{ provider().tariffs.length }}</p>
        </div>

        <!-- Estado card -->
        <div class="bg-background rounded-lg border border-border p-6">
          <p class="text-xl text-foreground mb-3">Estado</p>
          <p class="text-3xl font-bold text-green-600 dark:text-green-400 text-center">Operativo</p>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderTabComponent {
  readonly provider = input.required<Provider>();
}
