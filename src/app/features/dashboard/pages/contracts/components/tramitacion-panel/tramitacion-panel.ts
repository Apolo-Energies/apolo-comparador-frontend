import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Dialog } from 'primeng/dialog';
import {
  TRAMITACION_TIPO_LABELS, TramitacionCierre, TramitacionDocumento, TramitacionItem, TramitacionService, TramitacionTipo,
} from '../../../../../../core/services/tramitacion.service';
import { fmtDate } from '../../contracts-utils';

/**
 * Pestaña "En tramitación": qué le falta a cada contrato (rechazo, incidencia o documentación).
 * El colaborador sube el documento que falte; el Master además lo cierra.
 */
@Component({
  selector: 'app-tramitacion-panel',
  standalone: true,
  imports: [Dialog],
  templateUrl: './tramitacion-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TramitacionPanelComponent {
  readonly items    = input<TramitacionItem[]>([]);
  readonly loading  = input(false);
  readonly isMaster = input(false);
  /** Algo cambió (documento subido, registro cerrado): el padre recarga la lista. */
  readonly changed  = output<void>();

  private readonly tramitacion = inject(TramitacionService);
  private readonly toast       = inject(MessageService);

  readonly uploadingId = signal<string | null>(null);
  readonly closingId   = signal<string | null>(null);

  readonly fmtDate = fmtDate;

  tipoLabel(tipo: TramitacionTipo): string {
    return TRAMITACION_TIPO_LABELS[tipo] ?? tipo;
  }

  tipoCls(tipo: TramitacionTipo): string {
    switch (tipo) {
      case 'rechazado':  return 'bg-red-500/10 text-red-400';
      case 'incidencia': return 'bg-orange-500/10 text-orange-400';
      default:           return 'bg-amber-500/10 text-amber-300';
    }
  }

  /** Revisión pendiente de Operaciones tras subir el colaborador lo que faltaba. */
  isTramitadoDeNuevo(item: TramitacionItem): boolean {
    return item.resultado === 'tramitado_de_nuevo';
  }

  /** Primario mientras falta el documento; secundario ("Subir otro") cuando ya se respondió. */
  uploadCls(item: TramitacionItem): string {
    const base = this.isTramitadoDeNuevo(item)
      ? 'border border-border text-foreground hover:bg-accent'
      : 'bg-primary-button text-white hover:bg-primary-button/90';
    return this.uploadingId() === item.id ? `${base} opacity-60 pointer-events-none` : base;
  }

  onFileSelected(item: TramitacionItem, event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      this.notify('error', 'Archivo demasiado grande', 'El archivo supera los 20 MB.');
      return;
    }

    this.uploadingId.set(item.id);
    this.tramitacion.subirDocumento(item.id, file).subscribe({
      next: () => {
        this.uploadingId.set(null);
        this.notify('success', 'Documento enviado', 'Queda como "Tramitado de nuevo" hasta que Operaciones lo revise.');
        this.changed.emit();
      },
      error: err => {
        this.uploadingId.set(null);
        this.notify('error', 'No se pudo subir', err?.error?.error ?? 'Inténtalo de nuevo.');
      },
    });
  }

  openDocumento(item: TramitacionItem, doc: TramitacionDocumento): void {
    this.tramitacion.getDocumentoUrl(item.id, doc.id).subscribe({
      next: url => window.open(url, '_blank', 'noopener'),
      error: () => this.notify('error', 'No disponible', 'No se pudo abrir el documento.'),
    });
  }

  // Cerrar pide confirmación: el registro desaparece de la lista y no se puede reabrir desde aquí.
  readonly confirmTarget = signal<{ item: TramitacionItem; resultado: TramitacionCierre } | null>(null);

  pedirCierre(item: TramitacionItem, resultado: TramitacionCierre): void {
    this.confirmTarget.set({ item, resultado });
  }

  cancelarCierre(): void {
    if (!this.closingId()) this.confirmTarget.set(null);
  }

  confirmarCierre(): void {
    const target = this.confirmTarget();
    if (!target) return;
    const { item, resultado } = target;
    this.closingId.set(item.id);
    this.tramitacion.cerrar(item.id, resultado).subscribe({
      next: () => {
        this.closingId.set(null);
        this.confirmTarget.set(null);
        this.notify('success', resultado === 'ko' ? 'Cerrado como KO' : 'Cerrado como resuelta', item.clienteNombre ?? '');
        this.changed.emit();
      },
      error: () => {
        this.closingId.set(null);
        this.notify('error', 'No se pudo cerrar', 'Inténtalo de nuevo.');
      },
    });
  }

  private notify(severity: 'success' | 'error', summary: string, detail: string): void {
    this.toast.add({ severity, summary, detail, life: 4500 });
  }
}
