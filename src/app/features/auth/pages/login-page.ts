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
  template: `
    <ui-alert />

    <div class="w-[80vw] h-[80vh] rounded-lg p-8 bg-card backdrop-blur-sm border border-border shadow-xl overflow-hidden">
      <div class="grid grid-cols-1 md:grid-cols-2 md:h-full">

        <div class="hidden md:flex items-center justify-center h-full">
          <apolo-login-slider [slides]="slides()" />
        </div>

        <div class="flex justify-center md:items-start items-start py-10 md:py-0 md:pl-10">
          <div class="w-full max-w-md mt-0 md:mt-20">
            <p class="text-3xl font-semibold mb-6 md:mb-8 leading-tight text-foreground text-center md:text-left">
              {{ titleLine1() }}<br />{{ titleLine2() }}
            </p>

            <apolo-login-form
              [loading]="loading()"
              [submitLabel]="submitLabel()"
              [rememberLabel]="rememberLabel()"
              (formSubmit)="onFormSubmit($event)"
            />

            <a
              routerLink="/forgot-password"
              class="block text-center mt-4 text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors cursor-pointer"
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </div>

      </div>
    </div>
  `,
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
