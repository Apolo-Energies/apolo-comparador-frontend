import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { PaginatorComponent } from '@apolo-energies/table';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { SearchIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { AuthService } from '@apolo-energies/auth';
import { ContractService } from '../../../../services/contract.service';
import { ContratoClienteRow } from '../../../../entities/contrato.model';
import { ContratoIncidencia, ContratoCheckItem } from '../../../../entities/contrato-incidencia.model';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { RefreshTokenService } from '../../../../services/refresh-token.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { ContractDetailDrawerComponent } from './components/contract-detail-drawer/contract-detail-drawer';
import { calcDias, estadoCls, estadoLabel, fmtDate, fmtKwh } from './contracts-utils';
import { getUserRoles } from '../../../../utils/auth.utils';

@Component({
  selector: 'app-contracts-page',
  standalone: true,
  imports: [
    PaginatorComponent,
    InputFieldComponent, ButtonComponent,
    TableSkeletonComponent,
    ContractDetailDrawerComponent,
    Dialog, FormsModule, ReactiveFormsModule,
  ],
  templateUrl: './contracts-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractsPageComponent {
  private readonly contractService = inject(ContractService);
  private readonly globalLoading   = inject(GlobalLoadingService);
  private readonly platformId      = inject(PLATFORM_ID);
  private readonly auth            = inject(AuthService);
  private readonly refreshToken    = inject(RefreshTokenService);

  readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon, size: 16 };
  readonly xIcon:      UiIconSource = { type: 'apolo', icon: XIcon,      size: 16 };

  readonly isMaster = computed(() => getUserRoles(this.auth.currentUser()).includes('Master'));
  readonly delegationId = signal<number | null>(null);
  /** Master ve todos los contratos; el resto necesita una delegación asignada (claim del JWT). */
  readonly hasDelegation = computed(() => this.isMaster() || this.delegationId() !== null);

  readonly filter      = signal('');
  readonly currentPage = signal(1);
  readonly pageSize    = signal(10);
  readonly loading     = signal(false);
  readonly data        = signal<ContratoClienteRow[]>([]);
  readonly hasMore     = signal(false);
  readonly selectedClient = signal<ContratoClienteRow | null>(null);

  /** Solo una fila expandida a la vez. */
  readonly expandedId = signal<number | null>(null);

  /** Filtros de incidencia. Server-side — dispara reload al cambiar. */
  readonly filterEstado   = signal<string>('');
  readonly filterFaltante = signal<string>('');

  get hasFilters(): boolean { return !!(this.filterEstado() || this.filterFaltante()); }

  onEstadoChange(v: string): void {
    this.filterEstado.set(v);
    this.currentPage.set(1);
    this.load();
  }

  onFaltanteChange(v: string): void {
    this.filterFaltante.set(v);
    this.currentPage.set(1);
    this.load();
  }

  clearFilters(): void {
    this.filterEstado.set('');
    this.filterFaltante.set('');
    this.currentPage.set(1);
    this.load();
  }

  /** Incidencias servidas por Control (checklist per-contrato). */
  private readonly _incidencias = signal<ContratoIncidencia[]>([]);

  /** Index Map<NIF, ContratoIncidencia[]> para lookup O(1) al expandir. */
  readonly incidenciasByNif = computed(() => {
    const map = new Map<string, ContratoIncidencia[]>();
    for (const inc of this._incidencias()) {
      if (!inc.clienteNif) continue;
      const arr = map.get(inc.clienteNif) ?? [];
      arr.push(inc);
      map.set(inc.clienteNif, arr);
    }
    return map;
  });

  readonly totalPages = computed(() =>
    this.hasMore() ? this.currentPage() + 1 : this.currentPage()
  );
  readonly totalCount = computed(() =>
    this.hasMore()
      ? this.currentPage() * this.pageSize() + 1
      : (this.currentPage() - 1) * this.pageSize() + this.data().length
  );

  readonly estadoCls   = estadoCls;
  readonly estadoLabel = estadoLabel;
  readonly fmtDate     = fmtDate;
  readonly calcDias    = calcDias;
  readonly fmtKwh      = fmtKwh;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.delegationId.set(this.refreshToken.getDelegationIdFromToken());
      if (this.hasDelegation()) this.load();
    }
  }

  openDetail(c: ContratoClienteRow): void {
    this.selectedClient.set(c);
  }

  closeDetail(): void {
    this.selectedClient.set(null);
  }

  toggleExpand(id: number): void {
    this.expandedId.update(curr => curr === id ? null : id);
  }

  /** Si el cliente tiene N contratos pendientes, muestra el primero. */
  getChecklist(row: ContratoClienteRow): ContratoCheckItem[] {
    return this.incidenciasByNif().get(row.NIF)?.[0]?.checklist ?? [];
  }

  groupItems(items: ContratoCheckItem[], group: string): ContratoCheckItem[] {
    return items.filter(i => i.group === group);
  }

  /** Devuelve la incidencia del cliente (necesaria para conocer UUID de contrato/cliente al escribir). */
  firstIncidencia(row: ContratoClienteRow): ContratoIncidencia | null {
    return this.incidenciasByNif().get(row.NIF)?.[0] ?? null;
  }

  // ── Diálogos (paridad con Incidencias de Control) ──────────────────────

  readonly saving    = signal(false);
  readonly formError = signal<string | null>(null);

  // Editar cliente
  readonly editOpen  = signal(false);
  readonly editItem  = signal<ContratoCheckItem | null>(null);
  readonly editInc   = signal<ContratoIncidencia | null>(null);
  readonly editValue = new FormControl<string>('', { nonNullable: true });

  openEdit(inc: ContratoIncidencia, item: ContratoCheckItem): void {
    this.editInc.set(inc);
    this.editItem.set(item);
    this.editValue.setValue(item.currentValue ?? '');
    this.formError.set(null);
    this.editOpen.set(true);
  }

  closeEdit(): void {
    this.editOpen.set(false);
    this.editInc.set(null);
    this.editItem.set(null);
  }

  get canSaveEdit(): boolean {
    return this.editValue.value.trim().length > 0;
  }

  saveEdit(): void {
    const inc = this.editInc();
    const item = this.editItem();
    if (!inc || !item || !item.field) return;
    this.saving.set(true);
    this.formError.set(null);
    const newValue = this.editValue.value;
    this.contractService.patchCliente(inc.clienteId, { [item.field]: newValue }).subscribe({
      next: () => {
        this.applyChecklistUpdate(inc.id, item.key, {
          completed: newValue.trim().length > 0,
          currentValue: newValue,
        });
        this.saving.set(false);
        this.closeEdit();
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('Error al guardar. Inténtalo de nuevo.');
      },
    });
  }

  // Adjuntar documento: click botón → file picker nativo → upload directo.
  onAdjuntar(inc: ContratoIncidencia, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.saving.set(true);
    this.contractService.uploadAnexo(inc.id, file).subscribe({
      next: () => {
        this.applyChecklistUpdate(inc.id, 'documentacion', {
          completed: true,
          currentValue: 'Archivo(s) adjuntado(s)',
        });
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
        alert('No se pudo subir el archivo. Verifica que pese menos de 50 MB.');
      },
    });
  }

  // Marcar firmado (sin dialog, con optimistic update)
  toggleFirma(inc: ContratoIncidencia): void {
    this.saving.set(true);
    this.contractService.toggleValidado(inc.id).subscribe({
      next: () => {
        this._incidencias.update(rows => rows.map(r => {
          if (r.id !== inc.id) return r;
          const newChecklist = r.checklist.map(i =>
            i.key === 'firmaSms'
              ? { ...i, completed: !i.completed, currentValue: !i.completed ? 'Firmado' : null }
              : i,
          );
          const completedItems = newChecklist.filter(i => !i.optional && i.completed).length;
          return { ...r, checklist: newChecklist, completedItems };
        }));
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  /** Actualiza in-place el checklist de una incidencia — evita refetch tras cada write. */
  private applyChecklistUpdate(incId: string, itemKey: string, patch: Partial<ContratoCheckItem>): void {
    this._incidencias.update(rows => rows.map(r => {
      if (r.id !== incId) return r;
      const newChecklist = r.checklist.map(i => i.key === itemKey ? { ...i, ...patch } : i);
      const completedItems = newChecklist.filter(i => !i.optional && i.completed).length;
      return { ...r, checklist: newChecklist, completedItems };
    }));
  }

  /** Cliente aparece en la lista de incidencias servida por Control. */
  hasIncidencia(row: ContratoClienteRow): boolean {
    return (this.incidenciasByNif().get(row.NIF)?.length ?? 0) > 0;
  }

  /** Devuelve true si TODOS los servicios del cliente comparten un mismo estado. */
  singleEstado(row: ContratoClienteRow): string | null {
    const keys = Object.keys(row.EstadoBreakdown ?? {});
    return keys.length === 1 ? keys[0] : null;
  }

  estadoEntries(row: ContratoClienteRow): { estado: string; count: number }[] {
    const bd = row.EstadoBreakdown ?? {};
    return Object.entries(bd)
      .map(([estado, count]) => ({ estado, count }))
      .sort((a, b) => b.count - a.count);
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.load();
  }

  onClear(): void {
    this.filter.set('');
    this.currentPage.set(1);
    this.load();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.load();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.globalLoading.start();
    this.contractService.getContratos({
      filter:   this.filter() || undefined,
      offset:   (this.currentPage() - 1) * this.pageSize(),
      limit:    this.pageSize(),
      estado:   this.filterEstado() || undefined,
      faltante: this.filterFaltante() || undefined,
    }).subscribe({
      next: res => {
        this.data.set(res?.data ?? []);
        this.hasMore.set(res?.hasMore ?? false);
        this.loading.set(false);
        this.globalLoading.stop();
      },
      error: () => {
        this.loading.set(false);
        this.globalLoading.stop();
      },
    });

    // Incidencias en paralelo (no bloquea la tabla).
    this.contractService.getIncidencias().subscribe({
      next: rows => this._incidencias.set(rows ?? []),
      error: () => this._incidencias.set([]),
    });
  }
}
