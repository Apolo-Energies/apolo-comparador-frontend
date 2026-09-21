import {
  ChangeDetectionStrategy, Component, computed, ElementRef, HostListener,
  ViewChild, effect, inject, input, output, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertService, SelectOption } from '@apolo-energies/ui';
import { DeleteUserModalComponent } from '../delete-user-modal/delete-user-modal.component';
import { SvgIcon, SettingsIcon } from '@apolo-energies/icons';
import { UserService } from '../../../../../core/services/user.service';
import { CatalogService } from '../../../../../core/services/catalog.service';
import { RestorePasswordModalComponent } from '../restore-password-modal/restore-password-modal.component';
import { SendContractModalComponent } from '../send-contract-modal/send-contract-modal.component';
import { DelegationPickerModalComponent } from '../delegation-picker-modal/delegation-picker-modal.component';
import { UserRole, UserRoleLabel, normalizeRoleToOptionValue } from '../../../../../core/models/user-role';
import { PotentialParent } from '../../../../../core/models/user.model';
import { Delegation } from '../../../../../core/models/delegation.model';
import { environment } from '../../../../../../environments/environment';
import { UserRow } from './user-row.model';
import { ACTION_BTN_CLS, computePanelPosition, SELECT_CLS } from './user-actions-menu.helpers';

export type { UserRow, SubUserSummary } from './user-row.model';

@Component({
  selector: 'app-user-actions-menu',
  standalone: true,
  imports: [FormsModule, SvgIcon, RestorePasswordModalComponent, SendContractModalComponent, DeleteUserModalComponent, DelegationPickerModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-actions-menu.html',
})
export class UserActionsMenuComponent {
  @ViewChild('triggerBtn') private triggerRef!: ElementRef<HTMLButtonElement>;
  @ViewChild('container')  private containerRef!: ElementRef<HTMLDivElement>;

  readonly user              = input.required<UserRow>();
  readonly potentialParents  = input<PotentialParent[]>([]);
  readonly canReassignParent = input<boolean>(false);

  readonly updated       = output<void>();
  readonly parentChanged = output<string | null>();

  private readonly userService   = inject(UserService);
  private readonly catalogSvc    = inject(CatalogService);
  private readonly alertService  = inject(AlertService);
  private readonly router        = inject(Router);

  readonly settingsIcon    = SettingsIcon;
  readonly selectCls       = SELECT_CLS;
  readonly actionBtnCls    = ACTION_BTN_CLS;
  readonly showUserDetail  = environment.features.userDetail;
  readonly showContracts   = environment.features.contracts;
  readonly isSubUser       = computed(() => !!this.user().isSubUser);

  readonly isOpen                = signal(false);
  readonly panelTop              = signal(0);
  readonly panelLeft             = signal(0);
  readonly passwordModalOpen     = signal(false);
  readonly sendContractModalOpen = signal(false);
  readonly deleteConfirmOpen     = signal(false);
  readonly delegationPickerOpen  = signal(false);

  readonly selectedRole       = signal('');
  readonly selectedStatus     = signal('');
  readonly selectedExpert     = signal('');
  readonly selectedCommission = signal('');
  readonly selectedParent     = signal('');

  readonly parentSelectOptions = computed<SelectOption[]>(() => {
    const me = this.user().id;
    return this.potentialParents()
      .filter(p => p.id !== me)
      .map(p => ({ value: p.id, label: p.fullName }));
  });

  readonly commissionOptions = signal<SelectOption[]>([]);

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
      this.selectedRole.set(normalizeRoleToOptionValue(u.role));
      this.selectedStatus.set(String(u.isActive));
      this.selectedExpert.set(String(u.isEnergyExpert));
      this.selectedCommission.set(
        u.commissions?.find(c => c.isActive)?.commissionType?.id ?? ''
      );
      this.selectedParent.set((u as { parentUserId?: string | null }).parentUserId ?? '');
    });

    this.catalogSvc.get().subscribe(catalog => {
      this.commissionOptions.set(catalog.commissions.map(c => ({ value: c.id, label: c.name })));
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
    const rect = this.triggerRef.nativeElement.getBoundingClientRect();
    const { top, left } = computePanelPosition(rect, {
      width:  window.innerWidth,
      height: window.innerHeight,
    });
    this.panelTop.set(top);
    this.panelLeft.set(left);
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
    const isExpert = value === 'true';

    if (isExpert) {
      this.isOpen.set(false);
      this.delegationPickerOpen.set(true);
      return;
    }

    this.userService.patch(this.user().id, {
      isEnergyExpert: false,
      clearDelegation: true,
    }).subscribe({
      next: () => {
        this.alertService.show('Energy Expert actualizado', 'success');
        this.updated.emit();
      },
      error: () => this.alertService.show('Error al actualizar Energy Expert', 'error'),
    });
  }

  onDelegationPickerClosed(): void {
    this.delegationPickerOpen.set(false);
    this.selectedExpert.set(String(this.user().isEnergyExpert));
  }

  onDelegationSelected(delegation: Delegation): void {
    this.userService.patch(this.user().id, {
      isEnergyExpert: true,
      delegationId: delegation.id,
    }).subscribe({
      next: () => {
        this.alertService.show(`Energy Expert activado con delegación "${delegation.name}"`, 'success');
        this.delegationPickerOpen.set(false);
        this.updated.emit();
      },
      error: () => this.alertService.show('Error al asignar la delegación', 'error'),
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

  onParentChange(value: string): void {
    this.selectedParent.set(value);
    // Delegate the assignment to the parent component so it can centralize the reload + alert.
    this.parentChanged.emit(value || null);
  }

  openDeleteConfirm(): void {
    this.deleteConfirmOpen.set(true);
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
