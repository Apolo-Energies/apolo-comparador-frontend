import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlertComponent, AlertService, ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { PasswordService } from '../../services/password.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputFieldComponent, AlertComponent, RouterLink],
  templateUrl: './reset-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent implements OnInit {
  private fb              = inject(FormBuilder);
  private passwordService = inject(PasswordService);
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);
  private alertService    = inject(AlertService);

  readonly loading = signal(false);
  readonly done    = signal(false);

  private userId = '';
  private token  = '';

  readonly form = this.fb.group({
    newPassword:     ['', [Validators.required, Validators.minLength(8), Validators.pattern(/\d/)]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: this.matchPasswords });

  private matchPasswords(group: import('@angular/forms').AbstractControl) {
    const pw  = group.get('newPassword')?.value;
    const cpw = group.get('confirmPassword')?.value;
    return pw === cpw ? null : { mismatch: true };
  }

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
        setTimeout(() => this.router.navigate(['/']), 3000);
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
}