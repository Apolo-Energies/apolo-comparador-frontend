import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@apolo-energies/ui';

@Component({
  selector: 'app-fd-welcome',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex items-start justify-center pt-20">
      <div class="w-full max-w-lg bg-card border border-border rounded-lg shadow-xl px-8 py-8 space-y-6">

        <div class="flex flex-col text-center px-6 space-y-2">
          <p class="text-lg font-semibold text-foreground">
            Bienvenido al proceso de activación
          </p>
          <p class="text-sm text-muted-foreground">
            Estás a punto de iniciar el proceso de activación como colaborador oficial de Apolo Energies.
          </p>
        </div>

        <div class="border-t border-border pt-6 flex justify-center">
          <ui-button
            label="Iniciar el proceso"
            size="sm"
            (click)="onStart()"
          />
        </div>

      </div>
    </div>
  `,
})
export class WelcomePage {
  private readonly router = inject(Router);

  onStart(): void {
    this.router.navigate(['/dashboard/fast-discharge/data']);
  }
}
