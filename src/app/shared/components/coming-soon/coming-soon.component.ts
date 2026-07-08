import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  templateUrl: './coming-soon.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoonComponent {
  private readonly route = inject(ActivatedRoute, { optional: true });

  readonly title: string =
    (this.route?.snapshot.data?.['title'] as string | undefined) ?? 'En desarrollo';

  readonly description =
    'Esta sección estará disponible próximamente.';
}
