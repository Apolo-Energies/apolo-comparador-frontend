import {
  ChangeDetectionStrategy, Component, computed, inject, input, output, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { PasswordService } from '../../../../../core/services/password.service';
import { generateStrongPassword, matchPasswordsValidator, passwordStrengthValidator } from '../../../../../core/helpers/password.utils';

type Mode = 'email' | 'manual';

@Component({
  selector: 'app-restore-password-modal',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './restore-password-modal.html',
})
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
