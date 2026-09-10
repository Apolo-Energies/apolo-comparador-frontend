import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent } from '@apolo-energies/ui';
import { FileSpreadsheetIcon, UiIconSource } from '@apolo-energies/icons';
import { AuthService } from '@apolo-energies/auth';
import { AssignedClientsService } from '../../../../services/assigned-clients.service';
import { DelegationsService } from '../../../../services/delegations.service';
import { ContractService } from '../../../../services/contract.service';
import { AssignedClient } from '../../../../entities/assigned-client.model';
import { ContratoIncidencia, ContratoCheckItem } from '../../../../entities/contrato-incidencia.model';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { ClientDetailModalComponent, ClientDetailMode } from './client-detail-modal/client-detail-modal';
import { getUserRoles } from '../../../../utils/auth.utils';

@Component({
  selector: 'app-my-clients-page',
  standalone: true,
  imports: [
    DataTableComponent, PaginatorComponent,
    ButtonComponent, TableSkeletonComponent,
    ClientDetailModalComponent,
    Dialog, FormsModule, ReactiveFormsModule,
  ],
  templateUrl: './my-clients-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyClientsPageComponent implements AfterViewInit {
  @ViewChild('clienteTpl')        private clienteTpl!:        TemplateRef<{ $implicit: AssignedClient }>;
  @ViewChild('contratosBadgeTpl') private contratosBadgeTpl!: TemplateRef<{ $implicit: AssignedClient }>;
  @ViewChild('serviciosBadgeTpl') private serviciosBadgeTpl!: TemplateRef<{ $implicit: AssignedClient }>;

  private readonly clientsService     = inject(AssignedClientsService);
  private readonly delegationsService = inject(DelegationsService);
  private readonly contractService    = inject(ContractService);
  private readonly globalLoading      = inject(GlobalLoadingService);
  private readonly platformId         = inject(PLATFORM_ID);
  private readonly auth               = inject(AuthService);
  private readonly cdr                = inject(ChangeDetectorRef);

  readonly isMaster = computed(() => getUserRoles(this.auth.currentUser()).includes('Master'));

  readonly currentPage = signal(1);
  readonly pageSize    = signal(20);
  readonly loading     = signal(false);
  readonly error       = signal(false);
  readonly data        = signal<AssignedClient[]>([]);
  readonly total       = signal(0);

  readonly totalContracts = signal<number | null>(null);
  readonly totalServices  = signal<number | null>(null);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly exportingExcel       = signal(false);
  readonly exportingDelegations = signal(false);
  readonly excelIcon: UiIconSource = { type: 'apolo', icon: FileSpreadsheetIcon, size: 14 };

  readonly detailModalOpen   = signal(false);
  readonly detailModalClient = signal<AssignedClient | null>(null);
  readonly detailModalMode   = signal<ClientDetailMode>('contratos');

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

  /** Incidencias servidas por Control, indexadas por NIF. */
  private readonly _incidencias = signal<ContratoIncidencia[]>([]);
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

  readonly columns = signal<TableColumn<AssignedClient>[]>([
    { key: 'nombreCliente',          label: 'Cliente' },
    { key: 'nombreComercialCliente', label: 'Comercial' },
    { key: 'direccion',              label: 'Dirección', textColor: 'text-muted-foreground', format: row => row.direccion || '—' },
    { key: 'cp',                     label: 'CP',         align: 'center', format: row => row.cp || '—' },
    { key: 'provincia',              label: 'Provincia',  format: row => row.provincia || '—' },
    { key: 'poblacion',              label: 'Población',  format: row => row.poblacion || '—' },
    { key: 'totalContratos',         label: 'Contratos',  align: 'center' },
    { key: 'servicios',              label: 'Servicios',  align: 'center' },
  ]);

  constructor() {
    if (isPlatformBrowser(this.platformId)) this.load();
  }

  ngAfterViewInit(): void {
    this.columns.update(cols => cols.map(col => {
      if (col.key === 'nombreCliente')  return { ...col, cellTemplate: this.clienteTpl };
      if (col.key === 'totalContratos') return { ...col, cellTemplate: this.contratosBadgeTpl };
      if (col.key === 'servicios')      return { ...col, cellTemplate: this.serviciosBadgeTpl };
      return col;
    }));
    this.cdr.markForCheck();
  }

  openContratos(row: AssignedClient): void {
    this.detailModalClient.set(row);
    this.detailModalMode.set('contratos');
    this.detailModalOpen.set(true);
  }

  openServicios(row: AssignedClient): void {
    this.detailModalClient.set(row);
    this.detailModalMode.set('servicios');
    this.detailModalOpen.set(true);
  }

  onDetailModalClosed(): void {
    this.detailModalOpen.set(false);
  }

  /** Solo items entity='cliente' (docs/firma viven en Contratos > Luz). */
  hasIncidencia(row: AssignedClient): boolean {
    const inc = this.incidenciasByNif().get(row.nif)?.[0];
    if (!inc) return false;
    return inc.checklist.some(i => i.entity === 'cliente' && !i.completed && !i.optional);
  }

  firstIncidencia(row: AssignedClient): ContratoIncidencia | null {
    return this.incidenciasByNif().get(row.nif)?.[0] ?? null;
  }

  /** Solo items entity='cliente'. */
  getClienteChecklist(row: AssignedClient): ContratoCheckItem[] {
    const items = this.incidenciasByNif().get(row.nif)?.[0]?.checklist ?? [];
    return items.filter(i => i.entity === 'cliente');
  }

  readonly rowIsExpandable = (row: AssignedClient) => this.hasIncidencia(row);
  readonly rowExpandBadge  = (_row: AssignedClient) => null;

  // ── Diálogos y acciones de escritura (paridad con Contratos → Luz) ─────

  readonly saving    = signal(false);
  readonly formError = signal<string | null>(null);

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

  private applyChecklistUpdate(incId: string, itemKey: string, patch: Partial<ContratoCheckItem>): void {
    this._incidencias.update(rows => rows.map(r => {
      if (r.id !== incId) return r;
      const newChecklist = r.checklist.map(i => i.key === itemKey ? { ...i, ...patch } : i);
      const completedItems = newChecklist.filter(i => !i.optional && i.completed).length;
      return { ...r, checklist: newChecklist, completedItems };
    }));
  }

  // ── Export excels (intactos) ────────────────────────────────────────────

  exportExcel(): void {
    if (this.exportingExcel()) return;
    this.exportingExcel.set(true);
    this.clientsService.exportExcel().subscribe({
      next: response => {
        this.exportingExcel.set(false);
        this.downloadBlobResponse(response, 'mis-clientes.xlsx');
      },
      error: () => this.exportingExcel.set(false),
    });
  }

  exportDelegationsExcel(): void {
    if (this.exportingDelegations()) return;
    this.exportingDelegations.set(true);
    this.delegationsService.exportExcel().subscribe({
      next: response => {
        this.exportingDelegations.set(false);
        this.downloadBlobResponse(response, 'delegaciones.xlsx');
      },
      error: () => this.exportingDelegations.set(false),
    });
  }

  private downloadBlobResponse(response: HttpResponse<Blob>, fallbackFilename: string): void {
    const blob = response.body;
    if (!blob) return;

    let filename = fallbackFilename;
    const cd = response.headers.get('content-disposition');
    if (cd) {
      const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(cd);
      if (match?.[1]) filename = match[1].replace(/['"]/g, '');
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    this.error.set(false);
    this.globalLoading.start();
    this.clientsService.list({
      page:     this.currentPage(),
      pageSize: this.pageSize(),
      estado:   this.filterEstado() || undefined,
      faltante: this.filterFaltante() || undefined,
    }).subscribe({
      next: res => {
        this.data.set(res?.data ?? []);
        this.total.set(res?.total ?? 0);
        this.totalContracts.set(res?.totalContracts ?? null);
        this.totalServices.set(res?.totalServices ?? null);
        this.loading.set(false);
        this.globalLoading.stop();
      },
      error: () => {
        this.data.set([]);
        this.total.set(0);
        this.totalContracts.set(null);
        this.totalServices.set(null);
        this.error.set(true);
        this.loading.set(false);
        this.globalLoading.stop();
      },
    });

    // Incidencias en paralelo (mismo patrón que Contratos → Luz).
    this.contractService.getIncidencias().subscribe({
      next: rows => this._incidencias.set(rows ?? []),
      error: () => this._incidencias.set([]),
    });
  }
}
