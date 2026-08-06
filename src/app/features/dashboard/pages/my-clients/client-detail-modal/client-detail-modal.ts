import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { AssignedClient, AssignedClientSuministro } from '../../../../../entities/assigned-client.model';
import { ContractService } from '../../../../../services/contract.service';
import { estadoCls, estadoLabel, fmtDate, calcDias } from '../../contracts/contracts-page';

export type ClientDetailMode = 'contratos' | 'servicios';

/** Modal de solo lectura: contratos o servicios activos de un cliente de "Mis clientes". */
@Component({
  selector: 'app-client-detail-modal',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, DecimalPipe],
  templateUrl: './client-detail-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDetailModalComponent {
  readonly open   = input<boolean>(false);
  readonly client = input<AssignedClient | null>(null);
  readonly mode   = input<ClientDetailMode>('contratos');

  readonly closed = output<void>();

  private readonly contractService = inject(ContractService);

  readonly downloadingId = signal<number | null>(null);

  readonly estadoCls   = estadoCls;
  readonly estadoLabel = estadoLabel;
  readonly fmtDate     = fmtDate;
  readonly calcDias    = calcDias;

  /** Los suministros se relacionan con los servicios activos por CUPS (no con los contratos). */
  findSuministro(cups: string | null): AssignedClientSuministro | undefined {
    if (!cups) return undefined;
    return this.client()?.suministros?.find(s => s.CUPS === cups);
  }

  downloadArchivo(idArchivo: number): void {
    if (this.downloadingId() === idArchivo) return;
    this.downloadingId.set(idArchivo);
    this.contractService.getContratoArchivo(idArchivo).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contrato-${idArchivo}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingId.set(null);
      },
      error: () => this.downloadingId.set(null),
    });
  }

  onClose(): void {
    this.closed.emit();
  }
}
