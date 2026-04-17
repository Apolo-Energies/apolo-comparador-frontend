import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center min-h-screen bg-body gap-6 px-4">
      <div class="flex flex-col items-center gap-2 text-center">
        <span class="text-7xl font-bold text-primary">403</span>
        <h1 class="text-2xl font-semibold text-gray-800">Acceso denegado</h1>
        <p class="text-gray-500 max-w-sm">
          No tienes permisos para ver esta página.
          Contacta a tu administrador si crees que esto es un error.
        </p>
      </div>
      <button
        (click)="goBack()"
        class="px-6 py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 transition-opacity"
      >
        Volver al comparador
      </button>
    </div>
  `,
})
export class ForbiddenComponent {
  private router = inject(Router);

  goBack() {
    this.router.navigate(['/dashboard/comparator']);
  }
}
