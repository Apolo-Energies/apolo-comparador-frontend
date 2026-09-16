import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  effect, inject, input, output, signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Drawer } from 'primeng/drawer';
import {
  ApoloIcons, DateIcon, HomeIcon, InfoIcon, LightningIcon,
  NoteIcon, UiIconSource, UserSimpleIcon, XIcon,
} from '@apolo-energies/icons';
import { AuthService } from '@apolo-energies/auth';
import { ContratoClienteRow } from '../../../../../../entities/contrato.model';
import { ServicioListItem } from '../../../../../../entities/servicio.model';
import { ContractService } from '../../../../../../services/contract.service';
import { IncidenceService, Incidence, INCIDENCE_TYPES, INCIDENCE_TYPE_LABELS } from '../../../../../../services/incidence.service';
import { BrandLoaderComponent } from '../../../../../../shared/components/brand-loader/brand-loader.component';
import { calcDias, dedupeServiciosByCups, estadoCls, estadoLabel, fmtDate, fmtKwh } from '../../contracts-utils';
import { getUserRoles } from '../../../../../../utils/auth.utils';

@Component({
  selector: 'app-contract-detail-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, Drawer, ApoloIcons, BrandLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contract-detail-drawer.html',
  styleUrl: './contract-detail-drawer.scss',
})
export class ContractDetailDrawerComponent {
  readonly client = input<ContratoClienteRow | null>(null);

  readonly closed = output<void>();

  private contractService  = inject(ContractService);
  private incidenceService = inject(IncidenceService);
  private auth             = inject(AuthService);
  private router           = inject(Router);
  private cdr              = inject(ChangeDetectorRef);

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
  readonly newIncidenceType = signal<string>('Facturacion');
  readonly newIncidenceTitle = signal<string>('');
  readonly newIncidenceDescription = signal<string>('');
  readonly submittingIncidence = signal(false);

  // Edición de datos del contrato antes de firma (visible solo en servicios con estado 'P').
  // Como los endpoints EE que tenemos solo tocan datos del cliente (patchCliente), editamos
  // los campos más críticos que suelen corregirse antes de firma: email de facturación y IBAN.
  // Otros campos (potencias, precios, dirección suministro) requerirían nuevos endpoints EE
  // que quedan fuera de alcance por ahora.
  readonly editingServicioId       = signal<number | null>(null);
  readonly editEmailFacturacion    = signal<string>('');
  readonly editIban                = signal<string>('');
  readonly submittingEdit          = signal(false);

  isEditableEstado(estado: string | null | undefined): boolean {
    // Estado del contrato que permite editar antes de firma:
    //   P = Pendiente / esperando firma
    return (estado ?? '').toUpperCase() === 'P';
  }

  readonly incidenceTypes = INCIDENCE_TYPES;
  readonly incidenceTypeLabels = INCIDENCE_TYPE_LABELS;

  readonly isMaster = () => getUserRoles(this.auth.currentUser()).includes('Master');

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
        this.loadServices(c.IdCliente);
      } else {
        this.visible.set(false);
        this.services.set([]);
      }
    });
  }

  private loadServices(idCliente: number) {
    if (!idCliente || idCliente <= 0) {
      this.services.set([]);
      return;
    }
    this.loading.set(true);
    this.contractService.getServiciosByCliente(idCliente, 100).subscribe({
      next: rows => {
        // Dedup por CUPS con la misma winner-logic que el backend usa en /contratos,
        // así el drawer muestra 1 card por CUPS y coincide con NumServicios del header.
        this.services.set(dedupeServiciosByCups(rows));
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
    if (s.ConsumoAnualContrato)   return s.ConsumoAnualContrato;
    if (s.ConsumoAnualSuministro) return s.ConsumoAnualSuministro;
    const periodos = [
      s.ConsumoAnualP1, s.ConsumoAnualP2, s.ConsumoAnualP3,
      s.ConsumoAnualP4, s.ConsumoAnualP5, s.ConsumoAnualP6,
    ];
    return periodos.reduce((acc, v) => acc + (v ?? 0), 0);
  }

  estadoEntries(bd: Record<string, number> | null | undefined): { estado: string; count: number }[] {
    return Object.entries(bd ?? {})
      .map(([estado, count]) => ({ estado, count }))
      .sort((a, b) => b.count - a.count);
  }

  trackByServicioId = (_: number, s: ServicioListItem) => s.Id;

  // ── Acciones sobre un servicio ──────────────────────────────────────────

  downloadContrato(s: ServicioListItem): void {
    this.contractService.downloadContratoPdf(s.Id).subscribe({
      next: blob => this.saveBlob(blob, `contrato_${s.Id}.pdf`),
      error: () => alert('No se pudo descargar el contrato. Puede que aún no tenga PDF disponible.'),
    });
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

  toggleFacturas(idContrato: number): void {
    const current = this.expandedFacturas();
    this.expandedFacturas.set(current === idContrato ? null : idContrato);
    if (current !== idContrato) this.loadFacturas(idContrato);
  }

  private loadFacturas(idContrato: number): void {
    const cache = this.facturasCache();
    if (cache[idContrato] && cache[idContrato] !== 'error') return;
    this.facturasCache.set({ ...cache, [idContrato]: 'loading' });
    this.contractService.getFacturasByContrato(idContrato).subscribe({
      next: raw => {
        const items = this.normalizeFacturas(raw);
        this.facturasCache.set({ ...this.facturasCache(), [idContrato]: items });
        this.cdr.markForCheck();
      },
      error: () => {
        this.facturasCache.set({ ...this.facturasCache(), [idContrato]: 'error' });
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
      error: () => alert('No se pudo descargar la factura.'),
    });
  }

  toggleIncidencias(idContrato: number): void {
    const current = this.expandedIncidencias();
    this.expandedIncidencias.set(current === idContrato ? null : idContrato);
    if (current !== idContrato) this.loadIncidencias(idContrato);
  }

  private loadIncidencias(idContrato: number): void {
    const cache = this.incidenciasCache();
    if (Array.isArray(cache[idContrato])) return;
    this.incidenciasCache.set({ ...cache, [idContrato]: 'loading' });
    this.incidenceService.listByContrato(idContrato).subscribe({
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
    this.newIncidenceType.set('Facturacion');
    this.newIncidenceTitle.set('');
    this.newIncidenceDescription.set('');
  }

  cancelIncidenceForm(): void {
    this.incidenceFormFor.set(null);
  }

  submitIncidence(idContrato: number): void {
    const title       = this.newIncidenceTitle().trim();
    const description = this.newIncidenceDescription().trim();
    if (!title || !description) {
      alert('Rellena el título y la descripción.');
      return;
    }
    this.submittingIncidence.set(true);
    this.incidenceService.create({
      contratoExtId: idContrato,
      type:          this.newIncidenceType() as never,
      title,
      description,
    }).subscribe({
      next: created => {
        // refrescar lista añadiendo la nueva al principio
        const cache = this.incidenciasCache();
        const existing = Array.isArray(cache[idContrato]) ? (cache[idContrato] as Incidence[]) : [];
        this.incidenciasCache.set({ ...cache, [idContrato]: [created, ...existing] });
        this.incidenceFormFor.set(null);
        this.submittingIncidence.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        alert('No se pudo crear la incidencia.');
        this.submittingIncidence.set(false);
      },
    });
  }

  closeIncidence(inc: Incidence): void {
    if (!this.isMaster()) return;
    const note = prompt('Nota de resolución (opcional):') ?? undefined;
    this.incidenceService.close(inc.id, note ? { resolutionNote: note } : {}).subscribe({
      next: updated => {
        const cache = this.incidenciasCache();
        const list  = Array.isArray(cache[inc.contratoExtId]) ? (cache[inc.contratoExtId] as Incidence[]) : [];
        this.incidenciasCache.set({
          ...cache,
          [inc.contratoExtId]: list.map(i => i.id === updated.id ? updated : i),
        });
        this.cdr.markForCheck();
      },
      error: () => alert('No se pudo cerrar la incidencia.'),
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
      alert('No se puede editar: falta el identificador del cliente.');
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
        // Actualizar en memoria el servicio para reflejar el cambio sin recargar.
        this.services.update(list => list.map(x => x.Id === s.Id
          ? { ...x, EmailFacturacion: newEmail, CodigoCuentaDomiciliacion: newIban }
          : x));
        this.submittingEdit.set(false);
        this.editingServicioId.set(null);
        this.cdr.markForCheck();
      },
      error: () => {
        alert('No se pudieron guardar los cambios. Reintenta más tarde.');
        this.submittingEdit.set(false);
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
