import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@apolo-energies/ui';

@Component({
  selector: 'app-fd-welcome',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './welcome.html',
})
export class WelcomePage {
  private readonly router = inject(Router);

  onStart(): void {
    this.router.navigate(['/dashboard/fast-discharge/data']);
  }
}
