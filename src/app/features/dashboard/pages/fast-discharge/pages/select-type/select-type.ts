import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

/** Entrada de "Alta Rápida": elegir Luz o Gas antes de arrancar el flujo correspondiente. */
@Component({
  selector: 'app-fd-select-type',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select-type.html',
})
export class SelectTypePage {
  private readonly router = inject(Router);

  readonly illustration = '/images/logo/ownership-imag.webp';

  selectLuz(): void {
    this.router.navigate(['/dashboard/fast-discharge/data']);
  }

  selectGas(): void {
    this.router.navigate(['/dashboard/gas/quixotic-contracts/new']);
  }
}
