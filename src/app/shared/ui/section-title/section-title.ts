import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Título de bloque en versalitas pequeñas. */
@Component({
  selector: 'app-section-title',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `<h2 class="mb-3 text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground"><ng-content /></h2>`,
})
export class SectionTitleComponent {}
