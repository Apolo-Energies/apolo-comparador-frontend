import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertComponent, AlertService } from '@apolo-energies/ui';
import { AuthService } from '@apolo-energies/auth';
import { PasswordService } from '../../services/password.service';
import { passwordStrengthValidator, matchPasswordsValidator } from '../../utils/password.utils';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent],
  templateUrl: './reset-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent implements OnInit {
  private fb              = inject(FormBuilder);
  private passwordService = inject(PasswordService);
  private route           = inject(ActivatedRoute);
  private alertService    = inject(AlertService);
  private authService     = inject(AuthService);

  readonly loading      = signal(false);
  readonly done         = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirm  = signal(false);

  private userId = '';
  private token  = '';

  readonly form = this.fb.group({
    newPassword:     ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: matchPasswordsValidator });

  ngOnInit() {
    this.userId = this.route.snapshot.queryParamMap.get('userId') ?? '';
    this.token  = this.route.snapshot.queryParamMap.get('token')  ?? '';
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);

    this.passwordService.resetPassword({
      userId:      this.userId,
      token:       this.token,
      newPassword: this.form.getRawValue().newPassword!,
    }).subscribe({
      next: () => {
        this.done.set(true);
        this.loading.set(false);
        // If another account is still logged in (a manager opened the email link
        // while signed in), clear that session so the user lands on the login screen
        // and signs in with the new password.
        setTimeout(() => this.authService.signOut(), 3000);
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err.status === 400
          ? 'El enlace es inválido o ha expirado'
          : 'Error al restablecer la contraseña';
        this.alertService.show(msg, 'error');
      },
    });
  }

  goToLogin() {
    this.authService.signOut();
  }
}