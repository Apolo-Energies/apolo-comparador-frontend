import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EnergyRouteToggleComponent } from '../energy-route-toggle/energy-route-toggle.component';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [EnergyRouteToggleComponent],
  templateUrl: './coming-soon.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoonComponent {
  private readonly route  = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router);

  readonly title: string =
    (this.route?.snapshot.data?.['title'] as string | undefined) ?? 'En desarrollo';

  readonly description =
    'Esta sección estará disponible próximamente.';

  /**
   * Presente solo en las rutas Gas de Analítica (Historial/Estadística/Reportes)
   * que aún no tienen página real — permite volver a la variante Luz con el
   * mismo toggle que usan sus hermanas ya implementadas. Otros usos genéricos
   * de "próximamente" no pasan este dato y simplemente no muestran el toggle.
   */
  readonly luzUrl: string | undefined = this.route?.snapshot.data?.['luzUrl'] as string | undefined;
  readonly gasUrl = this.router.url;
}
