import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

const INPUT_CLS = 'w-full px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';
const SELECT_CLS = 'w-full px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer';

@Component({
  selector: 'app-form-company-user',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [formGroup]="form()" class="space-y-4">

      <!-- Email -->
      <div class="space-y-1">
        <label class="text-sm font-normal text-foreground">Email <span class="text-red-500">*</span></label>
        <input formControlName="email" type="email" placeholder="empresa@email.com"
          [class]="inputCls" [class.border-red-500]="err('email')" />
        @if (err('email')) { <p class="text-xs text-red-500">{{ errMsg('email') }}</p> }
      </div>

      <!-- Rol -->
      <div class="space-y-1">
        <label class="text-sm font-normal text-foreground">Rol <span class="text-red-500">*</span></label>
        <select formControlName="role" [class]="selectCls" [class.border-red-500]="err('role')">
          <option value="" disabled>Seleccionar rol</option>
          @for (opt of roleOptions; track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
        @if (err('role')) { <p class="text-xs text-red-500">El rol es obligatorio</p> }
      </div>

      <!-- Razón Social -->
      <div class="space-y-1">
        <label class="text-sm font-normal text-foreground">Razón Social <span class="text-red-500">*</span></label>
        <input formControlName="companyName" placeholder="Empresa S.L."
          [class]="inputCls" [class.border-red-500]="err('companyName')" />
        @if (err('companyName')) { <p class="text-xs text-red-500">{{ errMsg('companyName') }}</p> }
      </div>

    </div>
  `,
})
export class FormCompanyUserComponent {
  readonly form = input.required<FormGroup>();
  readonly submitted = input(false);

  readonly inputCls = INPUT_CLS;
  readonly selectCls = SELECT_CLS;

  readonly roleOptions = [
    { value: '1', label: 'Master' },
    { value: '2', label: 'Colaborador' },
    { value: '4', label: 'Referenciador' },
    { value: '8', label: 'Tester' },
  ];

  err(field: string): boolean {
    const c = this.form().get(field);
    return !!c && c.invalid && (c.touched || this.submitted());
  }

  errMsg(field: string): string {
    const errors = this.form().get(field)?.errors;
    if (!errors) return '';
    if (errors['required']) return 'Este campo es obligatorio';
    if (errors['email']) return 'Email inválido';
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    if (errors['minlength']) return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    if (errors['pattern']) return 'Formato inválido';
    return 'Campo inválido';
  }

  onIban(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/\s/g, '').toUpperCase();
    const formatted = clean.match(/.{1,4}/g)?.join(' ') ?? clean;
    input.value = formatted;
    this.form().get('bankAccount')?.setValue(formatted, { emitEvent: true });
  }
}
