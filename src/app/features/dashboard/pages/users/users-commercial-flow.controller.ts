import { signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { UserService } from '../../../../core/services/user.service';
import { SubUsersService } from '../../../../core/services/sub-users.service';
import { CommercialFormValue, CommercialParent } from './add-commercial-modal/add-commercial-modal';
import { UserRow } from './user-actions-menu/user-actions-menu.component';

/** UserRoles.Comercial value expected by the backend. */
const ROLE_COMERCIAL = 16;

export interface UsersCommercialFlowDeps {
  userService:     UserService;
  subUsersService: SubUsersService;
  alertService:    AlertService;
  /** Called after the commercial (and, if any, its commission) was saved so the page can reload the table. */
  onSaved:         () => void;
}

/**
 * Encapsulates the "add commercial to a collaborator" contextual modal flow
 * (open, cancel, create + optional commission assignment). Extracted from
 * UsersPageComponent to keep the page under the file-size guideline (R1).
 */
export class UsersCommercialFlowController {
  constructor(private readonly deps: UsersCommercialFlowDeps) {}

  readonly modalOpen = signal(false);
  readonly parent    = signal<CommercialParent | null>(null);
  readonly saving    = signal(false);

  openFor(parent: UserRow): void {
    this.parent.set({ id: parent.id, fullName: parent.fullName });
    this.modalOpen.set(true);
  }

  cancel(): void {
    this.modalOpen.set(false);
    this.parent.set(null);
  }

  create(value: CommercialFormValue): void {
    const parent = this.parent();
    if (!parent) return;

    this.saving.set(true);
    this.deps.userService.create({
      personType:   0,
      email:        value.email,
      role:         ROLE_COMERCIAL,
      name:         value.name,
      surnames:     value.surnames,
      parentUserId: parent.id,
    }).subscribe({
      next: (created) => {
        const percentage = value.commissionPercentage;
        if (percentage != null && created?.id) {
          this.deps.subUsersService.assignCommission({
            parentUserId: parent.id,
            subUserId:    created.id,
            percentage,
          }).subscribe({
            next: () => this.finish(parent.fullName, percentage),
            error: () => {
              this.saving.set(false);
              this.modalOpen.set(false);
              this.parent.set(null);
              this.deps.alertService.show(
                `Comercial creado, pero no se pudo asignar la comisión (${percentage}%). Asígnala desde "Gestionar comisiones".`,
                'error',
              );
              this.deps.onSaved();
            },
          });
        } else {
          this.finish(parent.fullName, null);
        }
      },
      error: (err) => {
        this.saving.set(false);
        if (err?.status === 409) {
          this.deps.alertService.show('Ya existe un usuario con ese email', 'error');
        } else if (err?.status === 403) {
          this.deps.alertService.show('No tienes permiso para crear este comercial', 'error');
        } else {
          this.deps.alertService.show('No se pudo crear el comercial', 'error');
        }
      },
    });
  }

  private finish(parentName: string, percentage: number | null): void {
    this.saving.set(false);
    this.modalOpen.set(false);
    this.parent.set(null);
    const suffix = percentage != null ? ` con ${percentage}% de comisión` : '';
    this.deps.alertService.show(`Comercial añadido a ${parentName}${suffix}`, 'success');
    this.deps.onSaved();
  }
}
