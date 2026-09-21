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
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent } from '@apolo-energies/ui';
import { FileSpreadsheetIcon, UiIconSource } from '@apolo-energies/icons';
import { AuthService } from '@apolo-energies/auth';
import { AssignedClientsService } from '../../../../core/services/assigned-clients.service';
import { DelegationsService } from '../../../../core/services/delegations.service';
import { ContractService } from '../../../../core/services/contract.service';
import { AssignedClient } from '../../../../core/models/assigned-client.model';
import { ContratoIncidencia, ContratoCheckItem } from '../../../../core/models/contrato-incidencia.model';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { ClientDetailModalComponent, ClientDetailMode } from './client-detail-modal/client-detail-modal';
import { getUserRoles } from '../../../../core/helpers/auth.utils';
import { applyMyClientsColumnTemplates, downloadBlobResponse } from './my-clients-page.helpers';
import { ClientIncidenciasController } from './client-incidencias.controller';
import { ClientListController } from './client-list.controller';

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

  // Checklist de incidencias (edición inline) — estado y llamadas al servicio
  // viven en el controller (R1). Signals se exponen por referencia directa
  // para que la plantilla no cambie.
  private readonly incidencias = new ClientIncidenciasController({
    contractService: this.contractService,
  });

  readonly saving    = this.incidencias.saving;
  readonly formError = this.incidencias.formError;
  readonly editOpen  = this.incidencias.editOpen;
  readonly editItem  = this.incidencias.editItem;
  readonly editValue = this.incidencias.editValue;

  get canSaveEdit(): boolean { return this.incidencias.canSaveEdit; }

  hasIncidencia(row: AssignedClient): boolean {
    return this.incidencias.hasIncidencia(row);
  }

  firstIncidencia(row: AssignedClient): ContratoIncidencia | null {
    return this.incidencias.firstIncidencia(row);
  }

  getClienteChecklist(row: AssignedClient): ContratoCheckItem[] {
    return this.incidencias.getClienteChecklist(row);
  }

  openEdit(inc: ContratoIncidencia, item: ContratoCheckItem): void {
    this.incidencias.openEdit(inc, item);
  }

  closeEdit(): void {
    this.incidencias.closeEdit();
  }

  saveEdit(): void {
    this.incidencias.saveEdit();
  }

  readonly rowIsExpandable = (row: AssignedClient) => this.hasIncidencia(row);
  readonly rowExpandBadge  = (_row: AssignedClient) => null;

  // Filtros, paginación y carga de la tabla — estado y llamada al servicio
  // viven en el controller (R1). Cada load() recarga incidencias en paralelo.
  private readonly list = new ClientListController({
    clientsService: this.clientsService,
    globalLoading:  this.globalLoading,
    onLoaded:       () => this.incidencias.load(),
  });

  readonly currentPage    = this.list.currentPage;
  readonly pageSize       = this.list.pageSize;
  readonly loading        = this.list.loading;
  readonly error          = this.list.error;
  readonly data           = this.list.data;
  readonly total          = this.list.total;
  readonly totalContracts = this.list.totalContracts;
  readonly totalServices  = this.list.totalServices;
  readonly totalPages     = this.list.totalPages;
  readonly filterEstado   = this.list.filterEstado;
  readonly filterFaltante = this.list.filterFaltante;

  get hasFilters(): boolean { return this.list.hasFilters; }

  onEstadoChange(v: string):      void { this.list.onEstadoChange(v); }
  onFaltanteChange(v: string):    void { this.list.onFaltanteChange(v); }
  clearFilters():                 void { this.list.clearFilters(); }
  onPageChange(page: number):     void { this.list.onPageChange(page); }
  onPageSizeChange(size: number): void { this.list.onPageSizeChange(size); }
  load():                         void { this.list.load(); }

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

  readonly detailModalOpen   = signal(false);
  readonly detailModalClient = signal<AssignedClient | null>(null);
  readonly detailModalMode   = signal<ClientDetailMode>('contratos');

  readonly exportingExcel       = signal(false);
  readonly exportingDelegations = signal(false);
  readonly excelIcon: UiIconSource = { type: 'apolo', icon: FileSpreadsheetIcon, size: 14 };

  constructor() {
    if (isPlatformBrowser(this.platformId)) this.load();
  }

  ngAfterViewInit(): void {
    this.columns.update(cols => applyMyClientsColumnTemplates(cols, {
      nombreCliente:  this.clienteTpl,
      totalContratos: this.contratosBadgeTpl,
      servicios:      this.serviciosBadgeTpl,
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

  // ── Export excels (intactos) ────────────────────────────────────────────

  exportExcel(): void {
    if (this.exportingExcel()) return;
    this.exportingExcel.set(true);
    this.clientsService.exportExcel().subscribe({
      next: response => {
        this.exportingExcel.set(false);
        downloadBlobResponse(response, 'mis-clientes.xlsx');
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
        downloadBlobResponse(response, 'delegaciones.xlsx');
      },
      error: () => this.exportingDelegations.set(false),
    });
  }
}
