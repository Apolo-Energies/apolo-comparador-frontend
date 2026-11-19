import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Título de pantalla + subtítulo + acciones (`<div actions>…</div>`). */
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-foreground text-balance">{{ title() }}</h1>
        @if (subtitle()) { <p class="mt-1 max-w-[70ch] text-sm text-muted-foreground">{{ subtitle() }}</p> }
      </div>
      <div class="flex flex-wrap items-center gap-2"><ng-content select="[actions]" /></div>
    </header>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null | undefined>(null);
}
