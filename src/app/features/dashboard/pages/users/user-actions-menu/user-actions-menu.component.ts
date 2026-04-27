import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener,
  ViewChild, effect, inject, input, output, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertService, SelectOption } from '@apolo-energies/ui';
import { SvgIcon, SettingsIcon } from '@apolo-energies/icons';
import { UserService } from '../../../../../services/user.service';
import { CatalogService } from '../../../../../services/catalog.service';
import { RestorePasswordModalComponent } from '../restore-password-modal/restore-password-modal.component';
import { SendContractModalComponent } from '../send-contract-modal/send-contract-modal.component';
import { UserRole, UserRoleLabel } from '../../../../../entities/user-role';

export interface UserRow {
  id:             string;
  fullName:       string;
  email:          string;
  phone:          string | null;
  role:           number;
  isActive:       boolean;
  isEnergyExpert: boolean;
  commissions:    { isActive: boolean; commissionType: { id: string; name: string } }[];
  providerId:     number | null;
  provider:       { id: number; name: string } | null;
  customerId?:      string | null;
  contractStatus?:  string | null;
}

const PANEL_H = 260;
const PANEL_W = 384; // w-96

const SELECT_CLS = [
  'w-full appearance-none rounded-md border border-input bg-background',
  'px-3 py-2 text-sm text-foreground cursor-pointer',
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
].join(' ');

@Component({
  selector: 'app-user-actions-menu',
  standalone: true,
  imports: [FormsModule, SvgIcon, RestorePasswordModalComponent, SendContractModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-0.5">

      <!-- Eye: navigate to user detail -->
      <button
        type="button"
        class="p-2 rounded-md hover:bg-muted cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
        title="Ver detalles"
        (click)="goToDetail()">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>

      <div #container>

      <!-- Gear trigger -->
      <button
        #triggerBtn
        type="button"
        class="p-2 rounded-md hover:bg-muted cursor-pointer"
        (click)="toggle($event)">
        <lib-svg-icon [icon]="settingsIcon" [size]="16" />
      </button>

      <!-- Floating panel -->
      @if (isOpen()) {
        <div
          class="fixed z-9999 w-96 rounded-lg border border-border bg-card shadow-xl"
          [style.top.px]="panelTop()"
          [style.left.px]="panelLeft()">

          <!-- 5 selects in 2-column grid -->
          <div class="grid grid-cols-2 gap-3 p-3">

            <select [class]="selectCls"
              [ngModel]="selectedRole()"
              (ngModelChange)="onRoleChange($event)">
              @for (opt of roleOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>

            <select [class]="selectCls"
              [ngModel]="selectedStatus()"
              (ngModelChange)="onStatusChange($event)">
              @for (opt of statusOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>

            <select [class]="selectCls"
              [ngModel]="selectedExpert()"
              (ngModelChange)="onExpertChange($event)">
              @for (opt of expertOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>

            <select [class]="selectCls"
              [ngModel]="selectedCommission()"
              (ngModelChange)="onCommissionChange($event)">
              <option value="">— Comisión —</option>
              @for (opt of commissionOptions(); track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>

            <select [class]="selectCls"
              [ngModel]="selectedProvider()"
              (ngModelChange)="onProviderChange($event)">
              <option value="">— Proveedor —</option>
              @for (opt of providerOptions(); track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>

          </div>

          <!-- Footer -->
          <div class="border-t border-border grid grid-cols-2">
            <button
              type="button"
              class="px-3 py-2 text-left text-xs sm:text-sm hover:bg-muted text-primary border-r border-border"
              (click)="openSendContractModal()">
              Enviar contrato
            </button>
            <button
              type="button"
              class="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-muted"
              (click)="openPasswordModal()">
              Restablecer contraseña
            </button>
          </div>
        </div>
      }
      </div><!-- /#container -->

    </div><!-- /.flex -->

    <app-restore-password-modal
      [open]="passwordModalOpen()"
      [userEmail]="user().email"
      [userName]="user().fullName"
      (closed)="passwordModalOpen.set(false)"
    />

    <app-send-contract-modal
      [open]="sendContractModalOpen()"
      [customerId]="user().customerId"
      [userName]="user().fullName"
      [userEmail]="user().email"
      (closed)="sendContractModalOpen.set(false)"
    />
  `,
})
export class UserActionsMenuComponent {
  @ViewChild('triggerBtn') private triggerRef!: ElementRef<HTMLButtonElement>;
  @ViewChild('container')  private containerRef!: ElementRef<HTMLDivElement>;

  readonly user    = input.required<UserRow>();
  readonly updated = output<void>();

  private readonly userService   = inject(UserService);
  private readonly catalogSvc    = inject(CatalogService);
  private readonly alertService  = inject(AlertService);
  private readonly router        = inject(Router);

  readonly settingsIcon = SettingsIcon;
  readonly selectCls    = SELECT_CLS;

  readonly isOpen                = signal(false);
  readonly panelTop              = signal(0);
  readonly panelLeft             = signal(0);
  readonly passwordModalOpen     = signal(false);
  readonly sendContractModalOpen = signal(false);

  readonly selectedRole       = signal('');
  readonly selectedStatus     = signal('');
  readonly selectedExpert     = signal('');
  readonly selectedCommission = signal('');
  readonly selectedProvider   = signal('');

  readonly commissionOptions = signal<SelectOption[]>([]);
  readonly providerOptions   = signal<SelectOption[]>([]);

  readonly roleOptions: SelectOption[] = Object.entries(UserRoleLabel).map(
    ([id, name]) => ({ value: id, label: name })
  );

  readonly statusOptions: SelectOption[] = [
    { value: 'true',  label: 'Activo' },
    { value: 'false', label: 'Inactivo' },
  ];

  readonly expertOptions: SelectOption[] = [
    { value: 'true',  label: 'Sí' },
    { value: 'false', label: 'No' },
  ];

  constructor() {
    // Sync selects whenever the user input changes
    effect(() => {
      const u = this.user();
      this.selectedRole.set(String(u.role));
      this.selectedStatus.set(String(u.isActive));
      this.selectedExpert.set(String(u.isEnergyExpert));
      this.selectedCommission.set(
        u.commissions?.find(c => c.isActive)?.commissionType?.id ?? ''
      );
      this.selectedProvider.set(u.providerId != null ? String(u.providerId) : '');
    });

    this.catalogSvc.get().subscribe(catalog => {
      this.commissionOptions.set(catalog.commissions.map(c => ({ value: c.id, label: c.name })));
      this.providerOptions.set(catalog.providers.map(p => ({ value: p.id, label: p.name })));
    });
  }

  // ─── Panel toggle & positioning ────────────────────────────────────────────

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isOpen()) {
      this.isOpen.set(false);
    } else {
      this.reposition();
      this.isOpen.set(true);
    }
  }

  private reposition(): void {
    const rect       = this.triggerRef.nativeElement.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove  = spaceBelow < PANEL_H && rect.top > PANEL_H;

    this.panelTop.set(openAbove ? rect.top - PANEL_H - 4 : rect.bottom + 4);
    this.panelLeft.set(
      Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_W - 8))
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.containerRef.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.isOpen()) this.reposition();
  }

  // ─── Select handlers ───────────────────────────────────────────────────────

  onRoleChange(value: string): void {
    this.selectedRole.set(value);
    this.userService.patch(this.user().id, { role: Number(value) as UserRole }).subscribe({
      next:  () => { this.alertService.show('Rol actualizado', 'success'); this.updated.emit(); },
      error: () => this.alertService.show('Error al actualizar el rol', 'error'),
    });
  }

  onStatusChange(value: string): void {
    this.selectedStatus.set(value);
    this.userService.patch(this.user().id, { isActive: value === 'true' }).subscribe({
      next:  () => { this.alertService.show('Estado actualizado', 'success'); this.updated.emit(); },
      error: () => this.alertService.show('Error al actualizar el estado', 'error'),
    });
  }

  onExpertChange(value: string): void {
    this.selectedExpert.set(value);
    this.userService.patch(this.user().id, { isEnergyExpert: value === 'true' }).subscribe({
      next:  () => { this.alertService.show('Energy Expert actualizado', 'success'); this.updated.emit(); },
      error: () => this.alertService.show('Error al actualizar Energy Expert', 'error'),
    });
  }

  onCommissionChange(value: string): void {
    this.selectedCommission.set(value);
    if (!value) return;
    this.userService.assignCommission(this.user().id, value).subscribe({
      next:  () => { this.alertService.show('Comisión actualizada', 'success'); this.updated.emit(); },
      error: () => this.alertService.show('Error al actualizar la comisión', 'error'),
    });
  }

  onProviderChange(value: string): void {
    this.selectedProvider.set(value);
    if (!value) return;
    this.userService.patch(this.user().id, { providerId: Number(value) }).subscribe({
      next:  () => { this.alertService.show('Proveedor actualizado', 'success'); this.updated.emit(); },
      error: () => this.alertService.show('Error al actualizar el proveedor', 'error'),
    });
  }

  openPasswordModal(): void {
    this.isOpen.set(false);
    this.passwordModalOpen.set(true);
  }

  openSendContractModal(): void {
    this.isOpen.set(false);
    this.sendContractModalOpen.set(true);
  }

  goToDetail(): void {
    this.router.navigate(['/dashboard/settings/users', this.user().id]);
  }
}
