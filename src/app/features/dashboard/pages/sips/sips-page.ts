import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@apolo-energies/auth';
import { SipsComponent, PS } from '@apolo-energies/sips';

@Component({
  selector: 'app-sips-page',
  standalone: true,
  imports: [SipsComponent],
  templateUrl: './sips-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SipsPageComponent {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  readonly token = computed(() => this.auth.token() ?? '');

  onComparativa(ps: PS) {
    this.router.navigate(['/dashboard/comparator'], {
      queryParams: { cups: ps.cups },
    });
  }
}