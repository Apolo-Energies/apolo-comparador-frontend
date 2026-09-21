import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import {
  AUTH_CONFIG, AuthService, LoginFormComponent, LoginFormValue, LoginSlide, LoginSliderComponent,
} from '@apolo-energies/auth';
import { AlertComponent, AlertService } from '@apolo-energies/ui';

/**
 * Página de login propia (en vez de usar `apolo-login-page` de la librería directo) para poder
 * agregar el link "¿Olvidaste tu contraseña?" justo debajo del botón, dentro de la misma tarjeta —
 * la librería no expone ningún punto de extensión para eso. Reusa `apolo-login-slider` y
 * `apolo-login-form` (los bloques que sí exporta) y replica la lógica de envío de `LoginPageComponent`.
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [LoginSliderComponent, LoginFormComponent, AlertComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-page.html',
})
export class LoginPage {
  readonly slides        = input<LoginSlide[]>([]);
  readonly titleLine1    = input('Acceder al');
  readonly titleLine2    = input('Panel de Control');
  readonly submitLabel   = input('Iniciar Sesión');
  readonly rememberLabel = input('Recordar contraseña');

  private readonly auth         = inject(AuthService);
  private readonly router       = inject(Router);
  private readonly config       = inject(AUTH_CONFIG);
  private readonly destroyRef   = inject(DestroyRef);
  private readonly alertService = inject(AlertService);

  readonly loading = signal(false);

  onFormSubmit(value: LoginFormValue): void {
    this.loading.set(true);
    this.auth
      .signIn({ username: value.email, password: value.password })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.router.navigateByUrl(this.config.homeRedirect);
        },
        error: () => {
          this.loading.set(false);
          this.alertService.show('Credenciales incorrectas. Por favor, inténtelo de nuevo.', 'error');
        },
      });
  }
}
