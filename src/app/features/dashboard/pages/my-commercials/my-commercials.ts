import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, inject, signal, TemplateRef, ViewChild, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataTableComponent, TableColumn } from '@apolo-energies/table';
import { AlertComponent, AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { StarIcon, UiIconSource } from '@apolo-energies/icons';
import { SubUsersService, SubUser } from '../../../../services/sub-users.service';
import { UserActionsMenuComponent, UserRow } from '../users/user-actions-menu/user-actions-menu.component';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';

@Component({
  selector: 'app-my-commercials',
  standalone: true,
  imports: [
    DataTableComponent, ButtonComponent, AlertComponent, DialogComponent,
    ReactiveFormsModule, UserActionsMenuComponent, TableSkeletonComponent,
  ],
  templateUrl: './my-commercials.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyComercialsPage implements AfterViewInit {
  private subUsersService = inject(SubUsersService);
  private alertService    = inject(AlertService);
  private fb              = inject(FormBuilder);
  private platformId      = inject(PLATFORM_ID);
  private cdr             = inject(ChangeDetectorRef);
  private globalLoading   = inject(GlobalLoadingService);

  readonly data      = signal<SubUser[]>([]);
  readonly loading   = signal(false);
  readonly modalOpen = signal(false);
  readonly submitted = signal(false);
  readonly saving    = signal(false);

  readonly addIcon: UiIconSource = { type: 'apolo', icon: StarIcon, size: 16 };

  readonly form = this.fb.nonNullable.group({
    email:    ['', [Validators.required, Validators.email]],
    name:     ['', [Validators.required, Validators.maxLength(50)]],
    surnames: ['', [Validators.required, Validators.maxLength(50)]],
  });

  @ViewChild('statusTpl') statusTpl!: TemplateRef<{ $implicit: SubUser }>;
  @ViewChild('commTpl')   commTpl!:   TemplateRef<{ $implicit: SubUser }>;
  @ViewChild('actionsTpl') actionsTpl!: TemplateRef<{ $implicit: SubUser }>;

  columns: TableColumn<SubUser>[] = [
    { key: 'fullName', label: 'Name' },
    { key: 'email',    label: 'Email' },
    { key: 'status',   label: 'Status',     align: 'center' },
    { key: 'comm',     label: 'Commission',  align: 'center' },
    { key: 'actions',  label: '',            align: 'center' },
  ];

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  ngAfterViewInit() {
    const statusCol  = this.columns.find(c => c.key === 'status');
    const commCol    = this.columns.find(c => c.key === 'comm');
    const actionsCol = this.columns.find(c => c.key === 'actions');
    if (statusCol)  statusCol.cellTemplate  = this.statusTpl;
    if (commCol)    commCol.cellTemplate    = this.commTpl;
    if (actionsCol) actionsCol.cellTemplate = this.actionsTpl;
    this.cdr.markForCheck();
  }

  load() {
    this.loading.set(true);
    this.globalLoading.start();
    this.subUsersService.getMySubUsers().subscribe({
      next: rows => { this.data.set(rows); this.loading.set(false); this.globalLoading.stop(); },
      error: ()  => { this.loading.set(false); this.globalLoading.stop(); },
    });
  }

  toSubUserRow(sub: SubUser): UserRow {
    return {
      id:             sub.userId,
      fullName:       sub.fullName,
      email:          sub.email,
      phone:          null,
      role:           sub.role,
      isActive:       sub.isActive,
      isEnergyExpert: false,
      commissions:    [],
      providerId:     null,
      provider:       null,
      isSubUser:      true,
    };
  }

  hasErr(field: string): boolean {
    const c = this.form.get(field);
    return !!c && c.invalid && (c.touched || this.submitted());
  }

  errMsg(field: string): string {
    const errors = this.form.get(field)?.errors;
    if (!errors) return '';
    if (errors['required'])  return 'This field is required';
    if (errors['email'])     return 'Invalid email';
    if (errors['maxlength']) return `Max ${errors['maxlength'].requiredLength} characters`;
    return 'Invalid field';
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

    this.saving.set(true);
    const raw = this.form.getRawValue();
    this.subUsersService.create({
      email:    raw.email.toLowerCase().trim(),
      fullName: `${raw.name.trim()} ${raw.surnames.trim()}`,
    }).subscribe({
      next: () => {
        this.alertService.show('Comercial creado correctamente', 'success');
        this.modalOpen.set(false);
        this.form.reset();
        this.submitted.set(false);
        this.saving.set(false);
        this.load();
      },
      error: err => {
        this.saving.set(false);
        if (err.status === 409 || err.status === 400) {
          this.alertService.show('Ya existe un usuario con ese email', 'error');
        } else if (err.status === 403) {
          this.alertService.show('No tienes permiso para crear este tipo de usuario', 'error');
        } else {
          this.alertService.show('Error al crear el comercial', 'error');
        }
      },
    });
  }
}
