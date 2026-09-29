import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { QuixoticContractDocument } from '../../../../../core/models/quixotic-contract.model';

/**
 * La URL de S3 viene firmada con Content-Disposition: attachment (lo pone el backend),
 * así que el navegador siempre la descarga en vez de mostrarla — no hay forma de embeberla
 * en un iframe para previsualización. Este modal solo confirma que el documento está
 * disponible y ofrece descargarlo (la descarga automática ya se dispara al abrir el modal).
 */
@Component({
  selector: 'app-document-preview-modal',
  standalone: true,
  imports: [DialogComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-preview-modal.component.html',
})
export class DocumentPreviewModalComponent {
  readonly open     = input(false);
  readonly document = input<QuixoticContractDocument | null>(null);
  readonly closed   = output<void>();

  onOpenChange(isOpen: boolean): void {
    if (!isOpen) this.closed.emit();
  }
}
