import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Dialog } from 'primeng/dialog';
import {
  ESTADOS_TRAMITACION, TRAMITACION_TIPO_LABELS, TramitacionCierre, TramitacionDocumento, TramitacionItem,
  TramitacionService, TramitacionTipo,
} from '../../../../../../core/services/tramitacion.service';
import { estadoCls, estadoLabel, fmtDate } from '../../contracts-utils';

type FiltroEstado = 'todos' | 'por_revisar' | (typeof ESTADOS_TRAMITACION)[number];

const PAGE_SIZE = 50;

/**
 * Pestaña "En tramitación": contratos que Energy Expert tiene en previo, para estudio, para firma,
 * para tramitar, incidencia, válido o KO (de la BD, sync horario). El colaborador sube lo que falte;
 * Operaciones ve qué se ha subido ("Tramitado de nuevo") y lo cierra.
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

  readonly filtro   = signal<FiltroEstado>('todos');
  readonly busqueda = signal('');
  readonly visibles = signal(PAGE_SIZE);

  readonly uploadingId = signal<number | null>(null);
  readonly closingId   = signal<string | null>(null);

  readonly fmtDate     = fmtDate;
  readonly estadoCls   = estadoCls;
  readonly estadoLabel = estadoLabel;

  /** Chips de filtro: solo los estados que tienen contratos, con su contador. */
  readonly chips = computed(() => {
    const items = this.items();
    const porEstado = (e: string) => items.filter(i => i.estadoContrato === e).length;
    const porRevisar = items.filter(i => this.isTramitadoDeNuevo(i)).length;
    return [
      { key: 'todos' as FiltroEstado, label: 'Todos', count: items.length },
      ...(porRevisar ? [{ key: 'por_revisar' as FiltroEstado, label: 'Tramitado de nuevo', count: porRevisar }] : []),
      ...ESTADOS_TRAMITACION
        .map(e => ({ key: e as FiltroEstado, label: estadoLabel(e), count: porEstado(e) }))
        .filter(c => c.count > 0),
    ];
  });

  readonly filtrados = computed(() => {
    const filtro = this.filtro();
    const q = this.normalizar(this.busqueda());
    return this.items().filter(i => {
      if (filtro === 'por_revisar' && !this.isTramitadoDeNuevo(i)) return false;
      if (filtro !== 'todos' && filtro !== 'por_revisar' && i.estadoContrato !== filtro) return false;
      if (!q) return true;
      return [i.clienteNombre, i.clienteNif, i.cups, i.idServicio?.toString(), i.nombreDelegacion]
        .some(v => v && this.normalizar(v).includes(q));
    });
  });

  readonly pagina = computed(() => this.filtrados().slice(0, this.visibles()));

  setFiltro(f: FiltroEstado): void {
    this.filtro.set(f);
    this.visibles.set(PAGE_SIZE);
  }

  setBusqueda(q: string): void {
    this.busqueda.set(q);
    this.visibles.set(PAGE_SIZE);
  }

  mostrarMas(): void {
    this.visibles.update(v => v + PAGE_SIZE);
  }

  tipoLabel(tipo: TramitacionTipo): string {
    return TRAMITACION_TIPO_LABELS[tipo] ?? tipo;
  }

  /** El colaborador ya subió algo y falta que Operaciones lo revise. */
  isTramitadoDeNuevo(item: TramitacionItem): boolean {
    return item.registro?.resultado === 'tramitado_de_nuevo';
  }

  /** Primario mientras no se ha subido nada; secundario ("Subir otro") cuando ya se respondió. */
  uploadCls(item: TramitacionItem): string {
    const base = this.isTramitadoDeNuevo(item)
      ? 'border border-border text-foreground hover:bg-accent'
      : 'bg-primary-button text-white hover:bg-primary-button/90';
    return this.uploadingId() === item.idServicio ? `${base} opacity-60 pointer-events-none` : base;
  }

  onFileSelected(item: TramitacionItem, event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file || item.idServicio == null) return;
    if (file.size > 20 * 1024 * 1024) {
      this.notify('error', 'Archivo demasiado grande', 'El archivo supera los 20 MB.');
      return;
    }

    this.uploadingId.set(item.idServicio);
    this.tramitacion.subirDocumento(item.idServicio, file).subscribe({
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
    if (!item.registro) return;
    // La pestaña se abre en el clic (si se abre tras la respuesta, Safari y los bloqueadores la impiden).
    const win = window.open('', '_blank');
    this.tramitacion.getDocumentoUrl(item.registro.id, doc.id).subscribe({
      next: url => {
        if (win) win.location.href = url;
        else window.location.href = url;
      },
      error: () => {
        win?.close();
        this.notify('error', 'No disponible', 'No se pudo abrir el documento.');
      },
    });
  }

  // Cerrar pide confirmación: el registro deja de mostrarse como pendiente.
  readonly confirmTarget = signal<{ item: TramitacionItem; resultado: TramitacionCierre } | null>(null);

  pedirCierre(item: TramitacionItem, resultado: TramitacionCierre): void {
    this.confirmTarget.set({ item, resultado });
  }

  cancelarCierre(): void {
    if (!this.closingId()) this.confirmTarget.set(null);
  }

  confirmarCierre(): void {
    const target = this.confirmTarget();
    const registro = target?.item.registro;
    if (!target || !registro) return;
    this.closingId.set(registro.id);
    this.tramitacion.cerrar(registro.id, target.resultado).subscribe({
      next: () => {
        this.closingId.set(null);
        this.confirmTarget.set(null);
        this.notify('success', target.resultado === 'ko' ? 'Cerrado como KO' : 'Cerrado como resuelta',
          target.item.clienteNombre ?? '');
        this.changed.emit();
      },
      error: () => {
        this.closingId.set(null);
        this.notify('error', 'No se pudo cerrar', 'Inténtalo de nuevo.');
      },
    });
  }

  private normalizar(v: string): string {
    return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  private notify(severity: 'success' | 'error', summary: string, detail: string): void {
    this.toast.add({ severity, summary, detail, life: 4500 });
  }
}
