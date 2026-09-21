import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forbidden.html',
})
export class ForbiddenComponent {
  private router = inject(Router);

  goBack() {
    this.router.navigate(['/dashboard/comparator']);
  }
}
