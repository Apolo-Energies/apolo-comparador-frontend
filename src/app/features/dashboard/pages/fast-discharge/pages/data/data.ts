import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '@apolo-energies/ui';
import { FastDischargeStore } from '../../store/fast-discharge.store';
import { ArtificialPerson, NaturalPerson } from '../../models/person.models';
import { FormNaturalPersonComponent } from './forms/form-natural-person';
import { FormArtificialPersonComponent } from './forms/form-artificial-person';

type PersonView = 'Individual' | 'Company';

@Component({
  selector: 'app-fd-data',
  imports: [ReactiveFormsModule, ButtonComponent, FormNaturalPersonComponent, FormArtificialPersonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center min-h-full px-4 py-8">
      <div class="w-full max-w-xl bg-card border border-border rounded-lg shadow-xl px-8 py-6 flex flex-col" style="max-height: 90vh">

        <!-- Header fijo -->
        <div class="shrink-0 space-y-4">

          <!-- Barra de progreso -->
          <div class="space-y-1">
            <div class="flex justify-between text-sm text-muted-foreground">
              <span>Progreso</span>
              <span>{{ progress() }}%</span>
            </div>
            <div class="w-full bg-muted rounded-full h-1.5">
              <div
                class="bg-primary-button h-1.5 rounded-full transition-all duration-300"
                [style.width.%]="progress()"
              ></div>
            </div>
          </div>

          <!-- Título -->
          <div>
            <p class="text-base font-semibold text-foreground">Información básica</p>
            <p class="text-sm text-muted-foreground">Introduce los datos de contacto.</p>
          </div>

          <!-- Toggle -->
          <div class="flex rounded-lg border border-border p-1 bg-muted gap-1">
            @for (opt of viewOptions; track opt.value) {
              <button
                type="button"
                (click)="setView(opt.value)"
                class="flex-1 text-sm py-1.5 rounded-md transition-all font-medium"
                [class.bg-card]="view() === opt.value"
                [class.text-foreground]="view() === opt.value"
                [class.shadow-sm]="view() === opt.value"
                [class.text-muted-foreground]="view() !== opt.value"
              >
                {{ opt.label }}
              </button>
            }
          </div>

        </div>

        <!-- Formulario con scroll -->
        <form
          [formGroup]="activeForm()"
          (ngSubmit)="onSubmit()"
          class="flex flex-col flex-1 min-h-0 mt-4"
        >
          <div class="flex-1 overflow-y-auto pr-1 space-y-1">
            @if (view() === 'Individual') {
              <app-form-natural-person [form]="naturalForm" [submitted]="submitted()" />
            } @else {
              <app-form-artificial-person [form]="companyForm" [submitted]="submitted()" />
            }
          </div>

          <div class="shrink-0 border-t border-border pt-4 mt-4 flex justify-center bg-card">
            <ui-button label="Siguiente" size="sm" type="submit" />
          </div>
        </form>

      </div>
    </div>
  `,
})
export class DataPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly store = inject(FastDischargeStore);

  readonly view = signal<PersonView>('Individual');
  readonly submitted = signal(false);

  readonly viewOptions = [
    { value: 'Individual' as PersonView, label: 'Persona Física' },
    { value: 'Company' as PersonView, label: 'Persona Jurídica' },
  ];

  readonly naturalForm = this.fb.nonNullable.group({
    dni:          ['', [Validators.required, Validators.pattern(/^[0-9]{8}[A-Za-z]$/)]],
    email:        ['', [Validators.required, Validators.email]],
    name:         ['', [Validators.required, Validators.maxLength(50)]],
    surnames:     ['', [Validators.required, Validators.maxLength(50)]],
    address_1:    ['', Validators.required],
    address_2:    ['', Validators.required],
    phone:        ['', [Validators.required, Validators.pattern(/^\+34[0-9]{9}$/)]],
    bank_account: ['', [Validators.required, Validators.pattern(/^ES\d{2}(?:\s?\d{4}){5}$/)]],
  });

  readonly companyForm = this.fb.nonNullable.group({
    dni:          ['', [Validators.required, Validators.pattern(/^[0-9]{8}[A-Za-z]$/)]],
    cif:          ['', [Validators.required, Validators.pattern(/^[A-Z]\d{7}[A-Z0-9]$/)]],
    companyName:  ['', [Validators.required, Validators.maxLength(50)]],
    email:        ['', [Validators.required, Validators.email]],
    name:         ['', [Validators.required, Validators.maxLength(50)]],
    surnames:     ['', [Validators.required, Validators.maxLength(50)]],
    address_1:    ['', Validators.required],
    address_2:    ['', Validators.required],
    phone:        ['', [Validators.required, Validators.pattern(/^\+34[0-9]{9}$/)]],
    bank_account: ['', [Validators.required, Validators.pattern(/^ES\d{2}(?:\s?\d{4}){5}$/)]],
  });

  readonly activeForm = computed(() =>
    this.view() === 'Individual' ? this.naturalForm : this.companyForm
  );

  readonly progress = computed(() => {
    const controls = Object.values(this.activeForm().controls);
    const filled = controls.filter(c => {
      const v = c.value;
      return typeof v === 'string' && v.trim() !== '';
    }).length;
    return Math.round((filled / controls.length) * 100);
  });

  setView(v: PersonView): void {
    this.view.set(v);
    this.submitted.set(false);
  }

  onSubmit(): void {
    this.submitted.set(true);

    if (this.activeForm().invalid) return;

    if (this.view() === 'Individual') {
      const raw = this.naturalForm.getRawValue();
      this.store.setPerson({ type: 'Individual', ...raw } as NaturalPerson);
    } else {
      const raw = this.companyForm.getRawValue();
      this.store.setPerson({ type: 'Company', ...raw } as ArtificialPerson);
    }

    this.router.navigate(['/dashboard/altaRapida/documents']);
  }
}
