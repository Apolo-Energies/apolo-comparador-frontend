import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '@apolo-energies/auth';
import { getUserRoles } from '../../../core/helpers/auth.utils';
import { environment } from '../../../../environments/environment';

/**
 * Toggle Luz/Gas genérico basado en rutas reales (no un signal oculto) — usado
 * en Tarifas, Historial, Estadística y Reportes. Entrar por el sidebar siempre
 * lleva a la ruta Luz; este toggle navega a la ruta Gas correspondiente y viceversa.
 * Se oculta por completo (no solo el botón Gas) para Coexpal/Renova y para
 * Colaborador — mismo criterio que ya excluía las variantes de Gas del sidebar.
 */
@Component({
  selector: 'app-energy-route-toggle',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './energy-route-toggle.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnergyRouteToggleComponent {
  readonly luzUrl = input.required<string>();
  readonly gasUrl = input.required<string>();

  private readonly router = inject(Router);
  private readonly auth   = inject(AuthService);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly isGas = computed(() => this.currentUrl().startsWith(this.gasUrl().split('?')[0]));

  readonly visible = computed(() => {
    const isApolo = environment.features.userDetail;
    const roles = getUserRoles(this.auth.currentUser());
    const isColaborador = (roles.includes('Colaborador') || roles.includes('Colaborador - Referenciador')) && !roles.includes('Master');
    return isApolo && !isColaborador;
  });
}
