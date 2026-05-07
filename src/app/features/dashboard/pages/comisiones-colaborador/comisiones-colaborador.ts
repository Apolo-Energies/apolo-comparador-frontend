import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, inject, signal, TemplateRef, ViewChild, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent, TableColumn } from '@apolo-energies/table';
import { AlertComponent, AlertService } from '@apolo-energies/ui';
import { ApoloIcons, XIcon, UiIconSource } from '@apolo-energies/icons';
import { SubUsersService, SubUser } from '../../../../services/sub-users.service';
import { RefreshTokenService } from '../../../../services/refresh-token.service';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';

interface SubUserRow extends SubUser {
  draftPercentage: string;
  saving: boolean;
}

@Component({
  selector: 'app-comisiones-colaborador',
  standalone: true,
  imports: [DataTableComponent, AlertComponent, FormsModule, ApoloIcons, BrandLoaderComponent],
  templateUrl: './comisiones-colaborador.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComisionesColaboradorPage implements AfterViewInit {
  private subUsersService      = inject(SubUsersService);
  private alertService         = inject(AlertService);
  private refreshTokenService  = inject(RefreshTokenService);
  private platformId           = inject(PLATFORM_ID);
  private cdr                  = inject(ChangeDetectorRef);

  readonly data    = signal<SubUserRow[]>([]);
  readonly loading = signal(false);

  readonly deleteIcon: UiIconSource = { type: 'apolo', icon: XIcon, size: 15 };

  @ViewChild('commTpl')   commTpl!:   TemplateRef<{ $implicit: SubUserRow }>;
  @ViewChild('actionsTpl') actionsTpl!: TemplateRef<{ $implicit: SubUserRow }>;

  columns: TableColumn<SubUserRow>[] = [
    { key: 'fullName', label: 'Colaborador' },
    { key: 'email',    label: 'Email' },
    { key: 'comm',     label: 'Comisión (%)', align: 'center' },
    { key: 'actions',  label: 'Acciones',     align: 'center' },
  ];

  private get parentUserId(): string {
    return this.refreshTokenService.getUserIdFromToken() ?? '';
  }

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  ngAfterViewInit() {
    const commCol    = this.columns.find(c => c.key === 'comm');
    const actionsCol = this.columns.find(c => c.key === 'actions');
    if (commCol)    commCol.cellTemplate    = this.commTpl;
    if (actionsCol) actionsCol.cellTemplate = this.actionsTpl;
    this.cdr.markForCheck();
  }

  private load() {
    this.loading.set(true);
    this.subUsersService.getMySubUsers().subscribe({
      next: rows => {
        this.data.set(rows.map(r => ({
          ...r,
          draftPercentage: r.commissionPercentage !== null ? String(r.commissionPercentage) : '',
          saving: false,
        })));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSave(row: SubUserRow) {
    const pct = parseFloat(row.draftPercentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      this.alertService.show('El porcentaje debe estar entre 0 y 100', 'error');
      return;
    }

    row.saving = true;
    this.cdr.markForCheck();

    this.subUsersService.assignCommission({
      parentUserId: this.parentUserId,
      subUserId:    row.userId,
      percentage:   pct,
    }).subscribe({
      next: () => {
        row.commissionPercentage = pct;
        row.saving = false;
        this.alertService.show('Comisión asignada correctamente', 'success');
        this.cdr.markForCheck();
      },
      error: err => {
        row.saving = false;
        this.cdr.markForCheck();
        if (err.status === 400) {
          this.alertService.show('El porcentaje supera el límite permitido', 'error');
        } else {
          this.alertService.show('Error al asignar la comisión', 'error');
        }
      },
    });
  }

  onDelete(row: SubUserRow) {
    row.saving = true;
    this.cdr.markForCheck();

    this.subUsersService.deleteCommission(row.userId).subscribe({
      next: () => {
        row.commissionPercentage = null;
        row.draftPercentage = '';
        row.saving = false;
        this.alertService.show('Comisión eliminada correctamente', 'success');
        this.cdr.markForCheck();
      },
      error: () => {
        row.saving = false;
        this.alertService.show('Error al eliminar la comisión', 'error');
        this.cdr.markForCheck();
      },
    });
  }
}
