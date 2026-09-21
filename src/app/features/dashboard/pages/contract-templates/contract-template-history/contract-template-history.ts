import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  effect, inject, input, OnInit, output, signal,
} from '@angular/core';
import { AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { ContractTemplateService } from '../../../../../core/services/contract-template.service';
import { ContractTemplate } from '../../../../../core/models/contract-template.model';

@Component({
  selector: 'app-contract-template-history',
  standalone: true,
  imports: [DialogComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contract-template-history.html',
})
export class ContractTemplateHistoryComponent {
  readonly open = input<boolean>(false);
  readonly code = input<string>('');

  readonly closed = output<void>();

  private templateService = inject(ContractTemplateService);
  private alertService    = inject(AlertService);
  private cdr             = inject(ChangeDetectorRef);

  readonly loading     = signal(false);
  readonly history     = signal<ContractTemplate[]>([]);
  readonly activatingId = signal<string | null>(null);
  readonly skeletonRows = [1, 2, 3];

  constructor() {
    effect(() => {
      const code = this.code();
      const open = this.open();
      if (open && code) this.loadHistory(code);
    });
  }

  private loadHistory(code: string): void {
    this.loading.set(true);
    this.history.set([]);
    this.templateService.getHistory(code).subscribe({
      next: res => {
        this.history.set(res.sort((a, b) => b.version.localeCompare(a.version)));
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.alertService.show('Error al cargar el historial', 'error');
        this.loading.set(false);
      },
    });
  }

  onActivate(item: ContractTemplate): void {
    if (this.activatingId()) return;
    this.activatingId.set(item.id);
    this.templateService.activate(item.id).subscribe({
      next: () => {
        this.alertService.show('Versión activada correctamente', 'success');
        this.activatingId.set(null);
        this.loadHistory(this.code());
      },
      error: () => {
        this.alertService.show('Error al activar la versión', 'error');
        this.activatingId.set(null);
      },
    });
  }

  formatDate(dateStr: string): string {
    try {
      return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  }
}
