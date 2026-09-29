import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Sub-navegación de las 3 páginas de Tarifas · Gas (Tramos/Parámetros/Productos).
 * Mismo look que el tab-strip de rates-page (Luz), pero con rutas reales vía
 * routerLink en vez de un signal interno — cada tab es su propia página.
 */
@Component({
  selector: 'app-gas-tariffs-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './gas-tariffs-nav.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GasTariffsNavComponent {}
