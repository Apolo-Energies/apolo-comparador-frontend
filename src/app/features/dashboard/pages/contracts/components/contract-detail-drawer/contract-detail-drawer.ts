import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  effect, inject, input, output, signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Drawer } from 'primeng/drawer';
import { Dialog } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import {
  ApoloIcons, DateIcon, HomeIcon, InfoIcon, LightningIcon,
  NoteIcon, UiIconSource, UserSimpleIcon, XIcon,
} from '@apolo-energies/icons';
import { AuthService } from '@apolo-energies/auth';
import { ContratoClienteRow } from '../../../../../../core/models/contrato.model';
import { ServicioListItem } from '../../../../../../core/models/servicio.model';
import { ContractService } from '../../../../../../core/services/contract.service';
import { IncidenceService, Incidence, INCIDENCE_TYPES, INCIDENCE_TYPE_LABELS, INCIDENCE_STATUS_LABELS } from '../../../../../../core/services/incidence.service';
import { TRAMITACION_TIPO_LABELS, TramitacionService, TramitacionTipo } from '../../../../../../core/services/tramitacion.service';
import { BrandLoaderComponent } from '../../../../../../shared/components/brand-loader/brand-loader.component';
import { calcDias, dedupeServiciosByCups, estadoCls, estadoLabel, fmtDate, fmtKwh, isEstadoPendiente, isEstadoTerminado } from '../../contracts-utils';
import { getUserRoles } from '../../../../../../core/helpers/auth.utils';

@Component({
  selector: 'app-contract-detail-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, Drawer, Dialog, ApoloIcons, BrandLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contract-detail-drawer.html',
  styleUrl: './contract-detail-drawer.scss',
})
export class ContractDetailDrawerComponent {
  readonly client = input<ContratoClienteRow | null>(null);

  readonly closed = output<void>();

  private contractService  = inject(ContractService);
  private incidenceService = inject(IncidenceService);
  private tramitacion      = inject(TramitacionService);
  private auth             = inject(AuthService);
  private router           = inject(Router);
  private cdr              = inject(ChangeDetectorRef);
  private toast            = inject(MessageService);

  readonly visible  = signal(false);
  readonly services = signal<ServicioListItem[]>([]);
  readonly loading  = signal(false);

  // Por-servicio: cuál está expandido para facturas / incidencias y su cache.
  readonly expandedFacturas    = signal<number | null>(null);
  readonly expandedIncidencias = signal<number | null>(null);
  readonly facturasCache       = signal<Record<number, InvoiceRow[] | 'loading' | 'error'>>({});
  readonly incidenciasCache    = signal<Record<number, Incidence[] | 'loading' | 'error'>>({});

  // Formulario de nueva incidencia (solo abierto para 1 servicio a la vez).
  readonly incidenceFormFor = signal<number | null>(null);
  readonly newIncidenceType = signal<string>('ErrorFacturacion');
  readonly newIncidenceDescription = signal<string>('');
  readonly submittingIncidence = signal(false);

  // Solo editable en estado 'P' (pendiente de firma). Limitado a email de facturación e
  // IBAN — es lo único que patchCliente de EE deja tocar.
  readonly editingServicioId       = signal<number | null>(null);
  readonly editEmailFacturacion    = signal<string>('');
  readonly editIban                = signal<string>('');
  readonly submittingEdit          = signal(false);

  readonly closeIncidenceTarget     = signal<Incidence | null>(null);
  readonly closeIncidenceNote       = signal<string>('');
  readonly submittingCloseIncidence = signal(false);

  private showFeedback(kind: 'error' | 'info', title: string, message: string): void {
    this.toast.add({
      severity: kind === 'error' ? 'error' : 'info',
      summary:  title,
      detail:   message,
      life:     4500,
    });
  }

  // Contratos aún en tramitación (previo, para firma, para tramitar…).
  isEditableEstado(estado: string | null | undefined): boolean {
    return isEstadoPendiente(estado);
  }

  // Tarjetas de servicio plegables: con varios servicios solo el primero arranca abierto.
  readonly openServicios = signal<ReadonlySet<number>>(new Set());

  isServicioOpen(id: number): boolean {
    return this.openServicios().has(id);
  }

  toggleServicio(id: number): void {
    this.openServicios.update(set => toggleInSet(set, id));
  }

  // Solo contratos vigentes que vencen en los próximos 60 días.
  canRenovar(s: ServicioListItem): boolean {
    if (isEstadoTerminado(s.Estado)) return false;
    const dias = calcDias(s.FechaFin);
    return dias !== null && dias >= 0 && dias <= 60;
  }

  // En indexados EE informa el fee sobre el índice, no un precio final de energía.
  esIndexado(s: ServicioListItem): boolean {
    return (s.TipoPrecioOfertaCTF ?? '').toUpperCase() === 'I';
  }

  readonly incidenceTypes = INCIDENCE_TYPES;
  readonly incidenceTypeLabels = INCIDENCE_TYPE_LABELS;
  readonly incidenceStatusLabels = INCIDENCE_STATUS_LABELS;

  readonly isMaster = () => getUserRoles(this.auth.currentUser()).includes('Master');

  // Registrar qué falta en un contrato (Master): aparece en la pestaña "En tramitación".
  readonly faltaTipos: TramitacionTipo[] = ['activo', 'incidencia', 'rechazado'];
  readonly faltaTipoLabels = TRAMITACION_TIPO_LABELS;
  readonly faltaFor           = signal<number | null>(null);
  readonly faltaTipo          = signal<TramitacionTipo>('activo');
  readonly faltaMotivo        = signal('');
  readonly faltaDocumentacion = signal('');
  readonly savingFalta        = signal(false);

  toggleFalta(id: number): void {
    const opening = this.faltaFor() !== id;
    this.faltaFor.set(opening ? id : null);
    if (opening) {
      this.faltaTipo.set('activo');
      this.faltaMotivo.set('');
      this.faltaDocumentacion.set('');
    }
  }

  guardarFalta(s: ServicioListItem): void {
    const motivo = this.faltaMotivo().trim();
    const documentacion = this.faltaDocumentacion().trim();
    if (!motivo && !documentacion) {
      this.showFeedback('error', 'Falta información', 'Indica el motivo o el documento que falta.');
      return;
    }
    this.savingFalta.set(true);
    this.tramitacion.crear({
      idServicio: s.Id,
      tipo: this.faltaTipo(),
      motivo: motivo || undefined,
      documentacionNecesaria: documentacion || undefined,
    }).subscribe({
      next: () => {
        this.savingFalta.set(false);
        this.faltaFor.set(null);
        this.showFeedback('info', 'Registrado', 'El colaborador lo verá en la pestaña "En tramitación".');
      },
      error: () => {
        this.savingFalta.set(false);
        this.showFeedback('error', 'No se pudo registrar', 'Inténtalo de nuevo.');
      },
    });
  }

  readonly iconClose:  UiIconSource = { type: 'apolo', icon: XIcon,          size: 16 };
  readonly iconInfo:   UiIconSource = { type: 'apolo', icon: InfoIcon,       size: 14 };
  readonly iconDate:   UiIconSource = { type: 'apolo', icon: DateIcon,       size: 14 };
  readonly iconUser:   UiIconSource = { type: 'apolo', icon: UserSimpleIcon, size: 14 };
  readonly iconHome:   UiIconSource = { type: 'apolo', icon: HomeIcon,       size: 14 };
  readonly iconBolt:   UiIconSource = { type: 'apolo', icon: LightningIcon,  size: 14 };
  readonly iconNote:   UiIconSource = { type: 'apolo', icon: NoteIcon,       size: 14 };

  readonly estadoCls   = estadoCls;
  readonly estadoLabel = estadoLabel;
  readonly fmtDate     = fmtDate;
  readonly fmtKwh      = fmtKwh;
  readonly calcDias    = calcDias;

  constructor() {
    effect(() => {
      const c = this.client();
      if (c) {
        this.visible.set(true);
        // Si la fila trae 1 CUPS, filtramos para no mostrar los demás servicios del cliente.
        const singleCups = c.CUPS.length === 1 ? c.CUPS[0] : undefined;
        this.loadServices(c.IdCliente, singleCups);
      } else {
        this.visible.set(false);
        this.services.set([]);
      }
    });
  }

  private loadServices(idCliente: number, cups?: string) {
    if (!idCliente || idCliente <= 0) {
      this.services.set([]);
      return;
    }
    this.loading.set(true);
    this.contractService.getServiciosByCliente(idCliente, 100, cups).subscribe({
      next: rows => {
        const services = dedupeServiciosByCups(rows);
        this.services.set(services);
        this.openServicios.set(new Set(services.length > 0 ? [services[0].Id] : []));
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.services.set([]);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  onVisibleChange(open: boolean) {
    if (!open) this.closed.emit();
  }

  closeDrawer() {
    this.closed.emit();
  }

  /**
   * Periodos P1–P6 con precio o consumo informado (los que EE deja a 0 en todo se ocultan:
   * una 2.0TD solo usa P1–P3). La API de EE solo expone el precio final por periodo,
   * en c€/kWh (energía) y c€/kW·día (potencia); los consumos por periodo vienen en MWh.
   */
  periodos(s: ServicioListItem): { p: string; energia: number | null; potencia: number | null; consumo: number | null }[] {
    const energia  = [s.PrecioEnergiaP1, s.PrecioEnergiaP2, s.PrecioEnergiaP3, s.PrecioEnergiaP4, s.PrecioEnergiaP5, s.PrecioEnergiaP6];
    const potencia = [s.PrecioPotenciaP1, s.PrecioPotenciaP2, s.PrecioPotenciaP3, s.PrecioPotenciaP4, s.PrecioPotenciaP5, s.PrecioPotenciaP6];
    const consumo  = [s.ConsumoAnualP1, s.ConsumoAnualP2, s.ConsumoAnualP3, s.ConsumoAnualP4, s.ConsumoAnualP5, s.ConsumoAnualP6];
    return energia
      .map((_, i) => ({
        p:        `P${i + 1}`,
        energia:  energia[i]  ?? null,
        potencia: potencia[i] ?? null,
        consumo:  consumo[i] ? consumo[i] * 1000 : null, // MWh → kWh
      }))
      .filter(r => !!r.energia || !!r.potencia || !!r.consumo);
  }

  /** EE envía el tipo de precio como letra. */
  tipoPrecioLabel(code: string | null | undefined): string {
    const labels: Record<string, string> = { F: 'Fijo', I: 'Indexado', M: 'Mixto' };
    return code ? (labels[code.toUpperCase()] ?? code) : '—';
  }

  fmtPrecio(v: number | null): string {
    return v ? v.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 6 }) : '—';
  }

  localizacion(s: ServicioListItem): string {
    const parts = [s.PoblacionSuministro, s.ProvinciaSuministro].filter(Boolean);
    return parts.join(', ') || s.DireccionSuministro || '—';
  }

  /**
   * Consumo del servicio. Prioridad: consumo del contrato matcheado por CUPS
   * (autoritativo, alineado con `ConsumoTotal` del cliente) → campos del
   * servicio como fallback (que suelen tener valores muy pequeños o vacíos
   * porque EE los rellena inconsistentemente).
   */
  consumoServicio(s: ServicioListItem): number {
    const porCups = this.client()?.ConsumoPorCups ?? {};
    const fromContract = s.CUPS ? porCups[s.CUPS] : undefined;
    if (fromContract && fromContract > 0) return fromContract;
    // Los consumos del servicio de EE vienen en MWh → kWh.
    if (s.ConsumoAnualContrato)   return s.ConsumoAnualContrato * 1000;
    if (s.ConsumoAnualSuministro) return s.ConsumoAnualSuministro * 1000;
    const periodos = [
      s.ConsumoAnualP1, s.ConsumoAnualP2, s.ConsumoAnualP3,
      s.ConsumoAnualP4, s.ConsumoAnualP5, s.ConsumoAnualP6,
    ];
    return periodos.reduce((acc, v) => acc + (v ?? 0), 0) * 1000;
  }

  estadoEntries(bd: Record<string, number> | null | undefined): { estado: string; count: number }[] {
    return Object.entries(bd ?? {})
      .map(([estado, count]) => ({ estado, count }))
      .sort((a, b) => b.count - a.count);
  }

  trackByServicioId = (_: number, s: ServicioListItem) => s.Id;

  // ── Acciones sobre un servicio ──────────────────────────────────────────

  readonly downloadingFirmado = signal<number | null>(null);

  downloadContratoFirmado(s: ServicioListItem): void {
    this.downloadingFirmado.set(s.Id);
    this.contractService.downloadContratoFirmado(s.Id).subscribe({
      next: blob => {
        this.downloadingFirmado.set(null);
        this.saveBlob(blob, `contrato_firmado_${s.Id}.pdf`);
      },
      error: () => {
        this.downloadingFirmado.set(null);
        this.showFeedback('error', 'Descarga no disponible',
          'No se pudo descargar el contrato firmado desde Energy Expert.');
      },
    });
  }

  direccionFiscal(s: ServicioListItem): string {
    const linea2 = [s.CPCliente, s.PoblacionCliente].filter(Boolean).join(' ');
    return [s.DireccionCliente, linea2, s.ProvinciaCliente].filter(Boolean).join(', ') || '—';
  }

  fmtEuros(v: number | null | undefined): string {
    return v ? v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '—';
  }

  renovar(s: ServicioListItem): void {
    // Abre el comparador con CUPS + consumo + tarifa actual prellenados.
    // El comparador leerá estos query params en su ngOnInit para inicializar el flujo.
    this.router.navigate(['/dashboard/comparator'], {
      queryParams: {
        cups:    s.CUPS,
        consumo: this.consumoServicio(s),
        tarifa:  s.Tarifa,
        origin:  'renewal',
      },
    });
    this.closeDrawer();
  }

  toggleFacturas(s: ServicioListItem): void {
    const current = this.expandedFacturas();
    const opening = current !== s.Id;
    this.expandedFacturas.set(opening ? s.Id : null);
    if (opening) {
      this.expandedIncidencias.set(null);
      this.loadFacturas(s);
    }
  }

  private loadFacturas(s: ServicioListItem): void {
    const cache = this.facturasCache();
    if (cache[s.Id] && cache[s.Id] !== 'error') return;
    this.facturasCache.set({ ...cache, [s.Id]: 'loading' });
    this.contractService.getFacturasByContrato(s.CUPS).subscribe({
      next: raw => {
        const items = this.normalizeFacturas(raw);
        this.facturasCache.set({ ...this.facturasCache(), [s.Id]: items });
        this.cdr.markForCheck();
      },
      error: () => {
        this.facturasCache.set({ ...this.facturasCache(), [s.Id]: 'error' });
        this.cdr.markForCheck();
      },
    });
  }

  private normalizeFacturas(raw: unknown): InvoiceRow[] {
    // El backend devuelve JsonElement raw. Toleramos que sea array o {data:[]}.
    const arr = Array.isArray(raw)
      ? raw
      : (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown[] }).data))
        ? (raw as { data: unknown[] }).data
        : [];
    return arr.map((f: Record<string, unknown>) => ({
      id:            typeof f['Id']          === 'number' ? (f['Id']          as number) : 0,
      numero:        typeof f['NumeroFactura'] === 'string' ? (f['NumeroFactura'] as string) : null,
      fechaEmision:  typeof f['FechaEmision'] === 'string' ? (f['FechaEmision'] as string) : null,
      fechaInicio:   typeof f['FechaInicio']  === 'string' ? (f['FechaInicio']  as string) : null,
      fechaFin:      typeof f['FechaFin']     === 'string' ? (f['FechaFin']     as string) : null,
      importe:       typeof f['Importe']      === 'number' ? (f['Importe']      as number) : null,
      consumoKwh:    typeof f['ConsumoKwh']   === 'number' ? (f['ConsumoKwh']   as number) : null,
      idArchivo:     typeof f['IdArchivo']    === 'number' ? (f['IdArchivo']    as number) : null,
    }));
  }

  downloadFactura(idArchivo: number): void {
    this.contractService.getContratoArchivo(idArchivo).subscribe({
      next: blob => this.saveBlob(blob, `factura_${idArchivo}.pdf`),
      error: () => this.showFeedback('error', 'Descarga no disponible',
        'No se pudo descargar la factura.'),
    });
  }

  toggleIncidencias(idContrato: number): void {
    const current = this.expandedIncidencias();
    const opening = current !== idContrato;
    this.expandedIncidencias.set(opening ? idContrato : null);
    if (opening) {
      this.expandedFacturas.set(null);
      const s = this.services().find(x => x.Id === idContrato);
      this.loadIncidencias(idContrato, s?.CUPS ?? '');
    }
  }

  private loadIncidencias(idContrato: number, cups: string): void {
    const cache = this.incidenciasCache();
    if (Array.isArray(cache[idContrato])) return;
    if (!cups) {
      this.incidenciasCache.set({ ...cache, [idContrato]: [] });
      return;
    }
    this.incidenciasCache.set({ ...cache, [idContrato]: 'loading' });
    this.incidenceService.listByCups(cups).subscribe({
      next: items => {
        this.incidenciasCache.set({ ...this.incidenciasCache(), [idContrato]: items });
        this.cdr.markForCheck();
      },
      error: () => {
        this.incidenciasCache.set({ ...this.incidenciasCache(), [idContrato]: 'error' });
        this.cdr.markForCheck();
      },
    });
  }

  openIncidenceForm(idContrato: number): void {
    this.incidenceFormFor.set(idContrato);
    this.newIncidenceType.set('ErrorFacturacion');
    this.newIncidenceDescription.set('');
  }

  cancelIncidenceForm(): void {
    this.incidenceFormFor.set(null);
  }

  submitIncidence(idContrato: number): void {
    const description = this.newIncidenceDescription().trim();
    if (!description) {
      this.showFeedback('info', 'Faltan datos', 'Escribe un comentario para la incidencia.');
      return;
    }
    const s = this.services().find(x => x.Id === idContrato);
    const cups = s?.CUPS ?? '';
    const clienteNombre = this.client()?.NombreCliente ?? '';
    if (!cups || !clienteNombre) {
      this.showFeedback('error', 'Datos incompletos', 'Falta CUPS o nombre de cliente para crear la incidencia.');
      return;
    }
    this.submittingIncidence.set(true);
    this.incidenceService.create({
      cups,
      clienteNombre,
      clienteNif:  this.client()?.NIF ?? null,
      type:        this.newIncidenceType() as never,
      description,
    }).subscribe({
      next: created => {
        const cache = this.incidenciasCache();
        const existing = Array.isArray(cache[idContrato]) ? (cache[idContrato] as Incidence[]) : [];
        this.incidenciasCache.set({ ...cache, [idContrato]: [created, ...existing] });
        this.incidenceFormFor.set(null);
        this.submittingIncidence.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.submittingIncidence.set(false);
        this.showFeedback('error', 'Error', 'No se pudo crear la incidencia.');
      },
    });
  }

  closeIncidence(inc: Incidence): void {
    if (!this.isMaster()) return;
    this.closeIncidenceTarget.set(inc);
    this.closeIncidenceNote.set('');
  }

  cancelCloseIncidence(): void {
    if (this.submittingCloseIncidence()) return;
    this.closeIncidenceTarget.set(null);
    this.closeIncidenceNote.set('');
  }

  confirmCloseIncidence(): void {
    const inc = this.closeIncidenceTarget();
    if (!inc || this.submittingCloseIncidence()) return;
    const note = this.closeIncidenceNote().trim();
    this.submittingCloseIncidence.set(true);
    this.incidenceService.close(inc.id, note ? { resolutionNote: note } : {}).subscribe({
      next: updated => {
        // Buscamos la incidencia por id en todas las caches (contratoExtId ya no es key fiable).
        const cache = this.incidenciasCache();
        const nextCache: Record<number, Incidence[] | 'loading' | 'error'> = { ...cache };
        for (const key of Object.keys(nextCache)) {
          const id = Number(key);
          const list = nextCache[id];
          if (Array.isArray(list) && list.some(i => i.id === inc.id)) {
            nextCache[id] = list.map(i => i.id === updated.id ? updated : i);
          }
        }
        this.incidenciasCache.set(nextCache);
        this.submittingCloseIncidence.set(false);
        this.closeIncidenceTarget.set(null);
        this.closeIncidenceNote.set('');
        this.cdr.markForCheck();
      },
      error: () => {
        this.submittingCloseIncidence.set(false);
        this.showFeedback('error', 'Error', 'No se pudo cerrar la incidencia. Reintenta más tarde.');
      },
    });
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Edición del contrato antes de firma ─────────────────────────────────

  toggleEdit(s: ServicioListItem): void {
    const current = this.editingServicioId();
    if (current === s.Id) {
      this.editingServicioId.set(null);
      return;
    }
    this.editEmailFacturacion.set(s.EmailFacturacion ?? '');
    this.editIban.set(s.CodigoCuentaDomiciliacion ?? '');
    this.editingServicioId.set(s.Id);
  }

  cancelEdit(): void {
    this.editingServicioId.set(null);
    this.editEmailFacturacion.set('');
    this.editIban.set('');
  }

  submitEdit(s: ServicioListItem): void {
    const idCliente = s.IdCliente;
    if (!idCliente) {
      this.showFeedback('error', 'No se puede editar',
        'Falta el identificador del cliente. Vuelve a abrir el detalle e intenta de nuevo.');
      return;
    }
    const patch: Record<string, string | null> = {};
    const newEmail = this.editEmailFacturacion().trim();
    const newIban  = this.editIban().trim().replace(/\s+/g, '').toUpperCase();

    if (newEmail !== (s.EmailFacturacion ?? '').trim()) patch['EmailFacturacion'] = newEmail || null;
    if (newIban !== (s.CodigoCuentaDomiciliacion ?? '').trim().replace(/\s+/g, '').toUpperCase()) {
      patch['CodigoCuentaDomiciliacion'] = newIban || null;
    }

    if (Object.keys(patch).length === 0) {
      this.cancelEdit();
      return;
    }

    this.submittingEdit.set(true);
    this.contractService.patchCliente(String(idCliente), patch).subscribe({
      next: () => {
        this.services.update(list => list.map(x => x.Id === s.Id
          ? { ...x, EmailFacturacion: newEmail, CodigoCuentaDomiciliacion: newIban }
          : x));
        this.submittingEdit.set(false);
        this.editingServicioId.set(null);
        this.cdr.markForCheck();
      },
      error: () => {
        this.submittingEdit.set(false);
        this.showFeedback('error', 'No se pudo guardar',
          'No se pudieron guardar los cambios. Reintenta más tarde.');
      },
    });
  }
}

interface InvoiceRow {
  id:           number;
  numero:       string | null;
  fechaEmision: string | null;
  fechaInicio:  string | null;
  fechaFin:     string | null;
  importe:      number | null;
  consumoKwh:   number | null;
  idArchivo:    number | null;
}

function toggleInSet(set: ReadonlySet<number>, id: number): ReadonlySet<number> {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
}
