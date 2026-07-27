import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, effect, inject, input, output, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertComponent, AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { ApoloIcons, XIcon, UiIconSource } from '@apolo-energies/icons';
import { SubUsersService, SubUser } from '../../../../../services/sub-users.service';

export interface CommissionsParent {
  id:       string;
  fullName: string;
}

interface Row extends SubUser {
  draftPercentage: string;
  saving: boolean;
}

@Component({
  selector: 'app-manage-commissions-modal',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, FormsModule, ApoloIcons, AlertComponent],
  templateUrl: './manage-commissions-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageCommissionsModalComponent {
  readonly open       = input<boolean>(false);
  readonly parentUser = input<CommissionsParent | null>(null);

  readonly closed  = output<void>();
  /** Emitted whenever a commission was successfully changed so the parent can refresh its table. */
  readonly changed = output<void>();

  private readonly subUsersService = inject(SubUsersService);
  private readonly alertService    = inject(AlertService);
  private readonly cdr             = inject(ChangeDetectorRef);

  readonly rows    = signal<Row[]>([]);
  readonly loading = signal(false);

  readonly deleteIcon: UiIconSource = { type: 'apolo', icon: XIcon, size: 14 };

  constructor() {
    effect(() => {
      const parent = this.parentUser();
      if (this.open() && parent) {
        this.load(parent.id);
      } else if (!this.open()) {
        this.rows.set([]);
      }
    });
  }

  private load(parentId: string): void {
    this.loading.set(true);
    this.subUsersService.getSubUsersByParent(parentId).subscribe({
      next: subs => {
        this.rows.set(subs.map(s => ({
          ...s,
          draftPercentage: s.commissionPercentage !== null ? String(s.commissionPercentage) : '',
          saving: false,
        })));
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading.set(false);
        this.alertService.show('No se pudieron cargar los comerciales', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  onSave(row: Row): void {
    const parent = this.parentUser();
    if (!parent) return;

    const pct = parseFloat(row.draftPercentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      this.alertService.show('El porcentaje debe estar entre 0 y 100', 'error');
      return;
    }

    row.saving = true;
    this.cdr.markForCheck();

    this.subUsersService.assignCommission({
      parentUserId: parent.id,
      subUserId:    row.userId,
      percentage:   pct,
    }).subscribe({
      next: () => {
        row.commissionPercentage = pct;
        row.saving = false;
        this.alertService.show('Comisión asignada correctamente', 'success');
        this.changed.emit();
        this.cdr.markForCheck();
      },
      error: err => {
        row.saving = false;
        this.cdr.markForCheck();
        if (err?.status === 400) {
          this.alertService.show('El porcentaje supera el límite permitido', 'error');
        } else {
          this.alertService.show('Error al asignar la comisión', 'error');
        }
      },
    });
  }

  onDelete(row: Row): void {
    const parent = this.parentUser();
    if (!parent) return;

    row.saving = true;
    this.cdr.markForCheck();

    this.subUsersService.deleteCommission(row.userId, parent.id).subscribe({
      next: () => {
        row.commissionPercentage = null;
        row.draftPercentage = '';
        row.saving = false;
        this.alertService.show('Comisión eliminada correctamente', 'success');
        this.changed.emit();
        this.cdr.markForCheck();
      },
      error: () => {
        row.saving = false;
        this.alertService.show('Error al eliminar la comisión', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  onClose(): void {
    this.closed.emit();
  }
}
