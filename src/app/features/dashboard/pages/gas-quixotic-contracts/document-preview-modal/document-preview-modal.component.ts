import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { QuixoticContractDocument } from '../../../../../entities/quixotic-contract.model';

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
  template: `
  <ui-dialog
    [open]="open()"
    [closeable]="true"
    maxWidth="max-w-sm"
    (openChange)="onOpenChange($event)"
  >
    <div class="pl-5 pr-12 pt-5 pb-5 space-y-4">

      <div class="flex items-center gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-button/15 text-primary-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-foreground truncate">{{ document()?.fileName || 'Documento del contrato' }}</h2>
          <p class="text-xs text-muted-foreground">Documento disponible para descargar</p>
        </div>
      </div>

      @if (document()?.publicUrl) {
        <a
          [href]="document()!.publicUrl"
          target="_blank"
          rel="noopener noreferrer"
          [download]="document()!.fileName"
          class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary-button px-4 py-2.5 text-sm font-semibold text-gray-950 hover:bg-[#0e8ec0] transition-colors cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Descargar documento
        </a>
        <p class="text-xs text-muted-foreground text-center">
          Si la descarga no empezó sola, usá este botón.
        </p>
      }

      <div class="pt-2 border-t border-border flex justify-center">
        <ui-button label="Cerrar" variant="outline" size="sm" (click)="closed.emit()" />
      </div>

    </div>
  </ui-dialog>
`})
export class DocumentPreviewModalComponent {
  readonly open     = input(false);
  readonly document = input<QuixoticContractDocument | null>(null);
  readonly closed   = output<void>();

  onOpenChange(isOpen: boolean): void {
    if (!isOpen) this.closed.emit();
  }
}
