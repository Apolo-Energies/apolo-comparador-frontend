import {
  ChangeDetectionStrategy, Component, computed, inject, input, output, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { PasswordService } from '../../../../../services/password.service';
import { generateStrongPassword, matchPasswordsValidator, passwordStrengthValidator } from '../../../../../utils/password.utils';

type Mode = 'email' | 'manual';

@Component({
  selector: 'app-restore-password-modal',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <ui-dialog
    [open]="open()"
    [closeable]="true"
    maxWidth="max-w-md"
    (openChange)="onOpenChange($event)"
  >
    <div class="px-4 pt-4 pb-4 space-y-4 overflow-x-hidden whitespace-normal">
      <h2 class="text-lg text-foreground font-semibold">Restablecer contraseña</h2>

      <!-- Selector de modo -->
      <div class="flex rounded-lg border border-border p-1 gap-1">
        <button
          type="button"
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
          [class.bg-primary-button]="mode() === 'email'"
          [class.text-white]="mode() === 'email'"
          [class.text-muted-foreground]="mode() !== 'email'"
          (click)="mode.set('email')"
        >
          Enviar correo
        </button>
        <button
          type="button"
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
          [class.bg-primary-button]="mode() === 'manual'"
          [class.text-white]="mode() === 'manual'"
          [class.text-muted-foreground]="mode() !== 'manual'"
          (click)="mode.set('manual')"
        >
          Establecer manualmente
        </button>
      </div>

      @if (mode() === 'email') {
        <p class="text-sm text-muted-foreground wrap-break-word">
          ¿Quieres enviar un correo de recuperación a:
          <br />
          <strong>{{ userEmail() }}</strong>?
        </p>
      } @else {
        <p class="text-xs text-muted-foreground wrap-break-word">
          Se aplicará de inmediato para <strong>{{ userName() || userEmail() }}</strong>.
        </p>

        <form [formGroup]="form" (ngSubmit)="onSubmitManual()" class="space-y-3">

          <div class="space-y-1">
            <div class="flex items-center justify-between gap-2">
              <label class="text-sm font-medium text-foreground">Nueva contraseña</label>
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  (click)="onGenerate()"
                  class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-primary-button hover:bg-accent/10 transition-colors cursor-pointer"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Generar
                </button>
                <button
                  type="button"
                  (click)="onCopy()"
                  [disabled]="!hasPassword()"
                  class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  [class.border-green-500]="copied()"
                  [class.text-green-500]="copied()"
                  [class.border-border]="!copied()"
                  [class.text-muted-foreground]="!copied()"
                  [class.hover:bg-accent/10]="!copied()"
                >
                  @if (copied()) {
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  } @else {
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  }
                  {{ copied() ? '¡Copiada!' : 'Copiar' }}
                </button>
              </div>
            </div>
            <div class="relative">
              <input
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="newPassword"
                placeholder="••••••••"
                class="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                (blur)="form.controls.newPassword.markAsTouched()"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                (click)="showPassword.set(!showPassword())">
                @if (showPassword()) {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                } @else {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                }
              </button>
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-sm font-medium text-foreground">Confirmar contraseña</label>
            <div class="relative">
              <input
                [type]="showConfirm() ? 'text' : 'password'"
                formControlName="confirmPassword"
                placeholder="••••••••"
                class="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                (blur)="form.controls.confirmPassword.markAsTouched()"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                (click)="showConfirm.set(!showConfirm())">
                @if (showConfirm()) {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                } @else {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                }
              </button>
            </div>
            @if (confirmStatus() === 'match') {
              <span class="text-xs text-green-500">Las contraseñas coinciden</span>
            } @else if (confirmStatus() === 'mismatch') {
              <span class="text-xs text-red-500">Las contraseñas no coinciden</span>
            }
          </div>

          <!-- Checklist de requisitos -->
          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            @for (req of passwordRequirements(); track req.label) {
              <div class="flex items-center gap-1.5 text-xs transition-colors"
                   [class.text-green-500]="req.met"
                   [class.text-red-500]="!req.met">
                @if (req.met) {
                  <svg class="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                } @else {
                  <svg class="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                }
                <span>{{ req.label }}</span>
              </div>
            }
          </div>
        </form>
      }

      <div class="flex flex-wrap justify-between gap-2 pt-4 border-t border-border">

        <ui-button
          label="Cancelar"
          variant="outline"
          size="sm"
          class="text-foreground"
          (click)="closed.emit()"
        />

        @if (loading()) {
          <button disabled class="inline-flex items-center justify-center min-w-32 rounded-md px-4 py-2 bg-primary-button text-white text-sm font-semibold cursor-not-allowed opacity-80">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="white"/>
            </svg>
          </button>
        } @else if (mode() === 'email') {
          <ui-button label="Enviar correo" variant="default" size="sm" (click)="onConfirmEmail()" />
        } @else {
          <ui-button label="Guardar" variant="default" size="sm" [disabled]="form.invalid" (click)="onSubmitManual()" />
        }

      </div>
    </div>
  </ui-dialog>
`})
export class RestorePasswordModalComponent {
  readonly open = input(false);
  readonly userId = input('');
  readonly userEmail = input('');
  readonly userName = input('');
  readonly closed = output<void>();

  private readonly fb              = inject(FormBuilder);
  private readonly passwordService = inject(PasswordService);
  private readonly alertService    = inject(AlertService);

  readonly loading = signal(false);
  readonly mode    = signal<Mode>('email');

  readonly showPassword = signal(false);
  readonly showConfirm  = signal(false);
  readonly copied       = signal(false);

  readonly form = this.fb.group({
    newPassword:     ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: matchPasswordsValidator });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly hasPassword = computed(() => !!this.formValue().newPassword);

  readonly passwordRequirements = computed(() => {
    const v = this.formValue().newPassword ?? '';
    return [
      { label: 'Mínimo 8 caracteres',   met: v.length >= 8 },
      { label: 'Una mayúscula',         met: /[A-Z]/.test(v) },
      { label: 'Una minúscula',         met: /[a-z]/.test(v) },
      { label: 'Un número',             met: /[0-9]/.test(v) },
      { label: 'Un carácter especial',  met: /[^a-zA-Z0-9]/.test(v) },
    ];
  });

  readonly confirmStatus = computed<'idle' | 'match' | 'mismatch'>(() => {
    const { newPassword, confirmPassword } = this.formValue();
    if (!confirmPassword) return 'idle';
    return newPassword === confirmPassword ? 'match' : 'mismatch';
  });

  onOpenChange(isOpen: boolean): void {
    if (!isOpen) this.reset();
  }

  onGenerate(): void {
    const generated = generateStrongPassword();
    this.form.setValue({ newPassword: generated, confirmPassword: generated });
    this.form.markAllAsTouched();
    this.showPassword.set(true);
    this.showConfirm.set(true);
  }

  onCopy(): void {
    const value = this.form.getRawValue().newPassword;
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    });
  }

  onConfirmEmail(): void {
    const email = this.userEmail();
    if (!email) return;

    this.loading.set(true);
    this.passwordService.forgotPassword({ email }).subscribe({
      next: () => {
        this.alertService.show('Correo enviado correctamente', 'success');
        this.loading.set(false);
        this.reset();
      },
      error: () => {
        this.alertService.show('Error al enviar el correo', 'error');
        this.loading.set(false);
      },
    });
  }

  onSubmitManual(): void {
    if (this.form.invalid) return;
    const userId = this.userId();
    if (!userId) return;

    const { newPassword, confirmPassword } = this.form.getRawValue();

    this.loading.set(true);
    this.passwordService.adminSetPassword(userId, {
      newPassword: newPassword!,
      confirmPassword: confirmPassword!,
    }).subscribe({
      next: () => {
        this.alertService.show('Contraseña actualizada correctamente', 'success');
        this.loading.set(false);
        this.reset();
      },
      error: (err) => {
        this.loading.set(false);
        const message = err?.status === 401
          ? 'No autorizado. Iniciá sesión de nuevo.'
          : err?.status === 403
          ? 'No tenés permisos para esta acción (se requiere rol Master).'
          : err?.error?.error ?? 'No se pudo establecer la contraseña';
        this.alertService.show(message, 'error');
      },
    });
  }

  private reset(): void {
    this.mode.set('email');
    this.form.reset();
    this.showPassword.set(false);
    this.showConfirm.set(false);
    this.copied.set(false);
    this.closed.emit();
  }
}
