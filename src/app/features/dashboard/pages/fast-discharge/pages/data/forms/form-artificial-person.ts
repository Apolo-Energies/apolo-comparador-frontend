import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-artificial-person',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [formGroup]="form()" class="grid grid-cols-1 gap-5">

      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-muted-foreground">DNI Representante</label>
          <input
            formControlName="dni"
            placeholder="12345678A"
            class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
            [class.border-red-500]="showError('dni')"
          />
          @if (showError('dni')) {
            <span class="text-red-500 text-xs">{{ getError('dni') }}</span>
          }
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-muted-foreground">CIF</label>
          <input
            formControlName="cif"
            placeholder="B56263304"
            class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
            [class.border-red-500]="showError('cif')"
          />
          @if (showError('cif')) {
            <span class="text-red-500 text-xs">{{ getError('cif') }}</span>
          }
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-muted-foreground">Razón Social</label>
        <input
          formControlName="companyName"
          placeholder="Empresa S.L."
          class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
          [class.border-red-500]="showError('companyName')"
        />
        @if (showError('companyName')) {
          <span class="text-red-500 text-xs">{{ getError('companyName') }}</span>
        }
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-muted-foreground">Email</label>
        <input
          formControlName="email"
          type="email"
          placeholder="apolo@apoloenergies.es"
          class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
          [class.border-red-500]="showError('email')"
        />
        @if (showError('email')) {
          <span class="text-red-500 text-xs">{{ getError('email') }}</span>
        }
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-muted-foreground">Nombre Representante</label>
          <input
            formControlName="name"
            placeholder="Juan"
            class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
            [class.border-red-500]="showError('name')"
          />
          @if (showError('name')) {
            <span class="text-red-500 text-xs">{{ getError('name') }}</span>
          }
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-muted-foreground">Apellidos</label>
          <input
            formControlName="surnames"
            placeholder="García López"
            class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
            [class.border-red-500]="showError('surnames')"
          />
          @if (showError('surnames')) {
            <span class="text-red-500 text-xs">{{ getError('surnames') }}</span>
          }
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-muted-foreground">Domicilio Social</label>
        <input
          formControlName="address_1"
          placeholder="Calle Mayor 1, 28001 Madrid"
          class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
          [class.border-red-500]="showError('address_1')"
        />
        @if (showError('address_1')) {
          <span class="text-red-500 text-xs">{{ getError('address_1') }}</span>
        }
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-muted-foreground">Domicilio Notificaciones</label>
        <input
          formControlName="address_2"
          placeholder="Calle Mayor 1, 28001 Madrid"
          class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
          [class.border-red-500]="showError('address_2')"
        />
        @if (showError('address_2')) {
          <span class="text-red-500 text-xs">{{ getError('address_2') }}</span>
        }
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-muted-foreground">Teléfono</label>
          <input
            formControlName="phone"
            placeholder="+34612345678"
            class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
            [class.border-red-500]="showError('phone')"
          />
          @if (showError('phone')) {
            <span class="text-red-500 text-xs">{{ getError('phone') }}</span>
          }
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-muted-foreground">Cuenta Bancaria</label>
          <input
            formControlName="bank_account"
            placeholder="ES83 0182 6517 7302 0197 5760"
            (input)="onIbanInput($event)"
            class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
            [class.border-red-500]="showError('bank_account')"
          />
          @if (showError('bank_account')) {
            <span class="text-red-500 text-xs">{{ getError('bank_account') }}</span>
          }
        </div>
      </div>

    </div>
  `,
})
export class FormArtificialPersonComponent {
  readonly form = input.required<FormGroup>();
  readonly submitted = input(false);

  showError(field: string): boolean {
    const control = this.form().get(field);
    return !!control && control.invalid && (control.touched || this.submitted());
  }

  getError(field: string): string {
    const errors = this.form().get(field)?.errors;
    if (!errors) return '';
    if (errors['required']) return 'Este campo es obligatorio';
    if (errors['pattern']) return this.patternMessages[field] ?? 'Formato inválido';
    if (errors['email']) return 'Email inválido';
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    return 'Campo inválido';
  }

  onIbanInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/\s/g, '').toUpperCase();
    const formatted = clean.match(/.{1,4}/g)?.join(' ') ?? clean;
    input.value = formatted;
    this.form().get('bank_account')?.setValue(formatted, { emitEvent: true });
  }

  private readonly patternMessages: Record<string, string> = {
    dni: 'Formato inválido. Ej: 12345678A',
    cif: 'CIF inválido. Ej: B56263304',
    phone: 'Debe empezar con +34 y tener 9 dígitos',
    bank_account: 'IBAN inválido. Ej: ES83 0182 6517 7302 0197 5760',
  };
}
