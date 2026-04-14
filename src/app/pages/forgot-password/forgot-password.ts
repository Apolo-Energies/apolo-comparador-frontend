import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { PasswordService } from '../../services/password.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputFieldComponent, RouterLink],
  templateUrl: './forgot-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private fb              = inject(FormBuilder);
  private passwordService = inject(PasswordService);

  readonly submitted = signal(false);
  readonly loading   = signal(false);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);

    this.passwordService.forgotPassword({ email: this.form.getRawValue().email! })
      .subscribe({
        next: () => {
          this.submitted.set(true);
          this.loading.set(false);
        },
        error: () => {
          // Always show success (backend always returns 200)
          this.submitted.set(true);
          this.loading.set(false);
        },
      });
  }
}