import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

export type StatState = 'loading' | 'ok' | 'error' | 'hidden';

/**
 * Cifra con etiqueta. Con `link` toda la tarjeta navega al detalle.
 * Solo presenta: el valor lo calcula la pantalla a partir de un endpoint existente.
 */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    @if (state() !== 'hidden') {
      @if (link() && state() === 'ok') {
        <a [routerLink]="link()" [queryParams]="queryParams()"
           class="group block h-full rounded-lg border border-border bg-card p-4 transition-colors duration-150 hover:border-primary/60 hover:bg-primary/5">
          <ng-container [ngTemplateOutlet]="body" />
          <span class="mt-2 inline-block text-xs font-medium text-primary">Ver detalle →</span>
        </a>
      } @else {
        <div class="h-full rounded-lg border border-border bg-card p-4">
          <ng-container [ngTemplateOutlet]="body" />
        </div>
      }
    }

    <ng-template #body>
      <p class="text-xs text-muted-foreground">{{ label() }}</p>
      @switch (state()) {
        @case ('loading') {
          <div class="mt-2 h-7 w-20 animate-pulse rounded bg-muted" aria-label="Cargando"></div>
          <div class="mt-2 h-3 w-28 animate-pulse rounded bg-muted"></div>
        }
        @case ('error') {
          <p class="mt-1 text-sm text-danger">No se pudo cargar</p>
          <button type="button" (click)="retry.emit(); $event.preventDefault()"
                  class="mt-1 text-xs font-medium text-primary underline-offset-4 hover:underline">
            Reintentar
          </button>
        }
        @default {
          <p class="mt-0.5 text-[26px] font-semibold leading-tight tracking-[-0.02em] tabular-nums text-foreground">
            {{ value() ?? '—' }}
          </p>
          @if (hint()) { <p class="mt-0.5 text-xs text-muted-foreground">{{ hint() }}</p> }
        }
      }
    </ng-template>
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input<string | number | null>(null);
  readonly hint = input<string | null | undefined>(null);
  readonly link = input<string | null | undefined>(null);
  readonly queryParams = input<Record<string, string> | null | undefined>(null);
  readonly state = input<StatState>('ok');
  readonly retry = output<void>();
}
