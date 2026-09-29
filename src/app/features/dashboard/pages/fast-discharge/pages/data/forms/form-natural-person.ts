import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-natural-person',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form-natural-person.html',
})
export class FormNaturalPersonComponent {
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
    phone: 'Debe empezar con +34 y tener 9 dígitos',
    bank_account: 'IBAN inválido. Ej: ES83 0182 6517 7302 0197 5760',
  };
}
