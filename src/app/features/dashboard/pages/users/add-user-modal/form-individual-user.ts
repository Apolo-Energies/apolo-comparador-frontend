import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

const INPUT_CLS = 'w-full px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';
const SELECT_CLS = 'w-full px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer';

@Component({
  selector: 'app-form-individual-user',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form-individual-user.html',
})
export class FormIndividualUserComponent {
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
    if (errors['required'])  return 'Este campo es obligatorio';
    if (errors['email'])     return 'Email inválido';
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    return 'Campo inválido';
  }
}
