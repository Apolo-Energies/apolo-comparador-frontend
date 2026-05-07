import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, inject, signal, TemplateRef, ViewChild, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataTableComponent, TableColumn } from '@apolo-energies/table';
import { AlertComponent, AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';
import { StarIcon, UiIconSource } from '@apolo-energies/icons';
import { SubUsersService, SubUser } from '../../../../services/sub-users.service';

@Component({
  selector: 'app-mis-colaboradores',
  standalone: true,
  imports: [DataTableComponent, ButtonComponent, AlertComponent, DialogComponent, ReactiveFormsModule, BrandLoaderComponent],
  templateUrl: './mis-colaboradores.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisColaboradoresPage implements AfterViewInit {
  private subUsersService = inject(SubUsersService);
  private alertService    = inject(AlertService);
  private fb              = inject(FormBuilder);
  private platformId      = inject(PLATFORM_ID);
  private cdr             = inject(ChangeDetectorRef);

  readonly data      = signal<SubUser[]>([]);
  readonly loading   = signal(false);
  readonly modalOpen = signal(false);
  readonly submitted = signal(false);

  readonly addIcon: UiIconSource = { type: 'apolo', icon: StarIcon, size: 16 };

  readonly form = this.fb.nonNullable.group({
    email:    ['', [Validators.required, Validators.email]],
    name:     ['', [Validators.required, Validators.maxLength(50)]],
    surnames: ['', [Validators.required, Validators.maxLength(50)]],
  });

  @ViewChild('statusTpl') statusTpl!: TemplateRef<{ $implicit: SubUser }>;
  @ViewChild('commTpl')   commTpl!:   TemplateRef<{ $implicit: SubUser }>;

  columns: TableColumn<SubUser>[] = [
    { key: 'fullName', label: 'Nombre' },
    { key: 'email',    label: 'Email' },
    { key: 'status',   label: 'Estado',    align: 'center' },
    { key: 'comm',     label: 'Comisión',  align: 'center' },
  ];

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  ngAfterViewInit() {
    const statusCol = this.columns.find(c => c.key === 'status');
    const commCol   = this.columns.find(c => c.key === 'comm');
    if (statusCol) statusCol.cellTemplate = this.statusTpl;
    if (commCol)   commCol.cellTemplate   = this.commTpl;
    this.cdr.markForCheck();
  }

  private load() {
    this.loading.set(true);
    this.subUsersService.getMySubUsers().subscribe({
      next: rows => { this.data.set(rows); this.loading.set(false); },
      error: ()  => { this.loading.set(false); },
    });
  }

  hasErr(field: string): boolean {
    const c = this.form.get(field);
    return !!c && c.invalid && (c.touched || this.submitted());
  }

  errMsg(field: string): string {
    const errors = this.form.get(field)?.errors;
    if (!errors) return '';
    if (errors['required'])  return 'Este campo es obligatorio';
    if (errors['email'])     return 'Email inválido';
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    return 'Campo inválido';
  }

  onOpenModal() {
    this.form.reset();
    this.submitted.set(false);
    this.modalOpen.set(true);
  }

  onCancel() {
    this.modalOpen.set(false);
    this.form.reset();
    this.submitted.set(false);
  }

  onSubmit() {
    this.submitted.set(true);
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    this.subUsersService.create({
      email:     raw.email.toLowerCase().trim(),
      name:      raw.name,
      surnames:  raw.surnames,
      role:      'Colaborador',
      personType: 'Individual',
    }).subscribe({
      next: () => {
        this.alertService.show('Colaborador creado correctamente', 'success');
        this.modalOpen.set(false);
        this.form.reset();
        this.submitted.set(false);
        this.load();
      },
      error: err => {
        if (err.status === 409 || err.status === 400) {
          this.alertService.show('Ya existe un usuario con ese email', 'error');
        } else if (err.status === 403) {
          this.alertService.show('No tienes permisos para crear este tipo de usuario', 'error');
        } else {
          this.alertService.show('Error al crear el colaborador', 'error');
        }
      },
    });
  }
}
