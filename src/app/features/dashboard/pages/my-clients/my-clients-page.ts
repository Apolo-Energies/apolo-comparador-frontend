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
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent } from '@apolo-energies/ui';
import { AssignedClientsService } from '../../../../services/assigned-clients.service';
import { AssignedClient } from '../../../../entities/assigned-client.model';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { ClientDetailModalComponent, ClientDetailMode } from './client-detail-modal/client-detail-modal';

@Component({
  selector: 'app-my-clients-page',
  standalone: true,
  imports: [
    DataTableComponent, PaginatorComponent,
    ButtonComponent, TableSkeletonComponent,
    ClientDetailModalComponent,
  ],
  templateUrl: './my-clients-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyClientsPageComponent implements AfterViewInit {
  @ViewChild('clienteTpl')         private clienteTpl!:         TemplateRef<{ $implicit: AssignedClient }>;
  @ViewChild('contratosBadgeTpl')  private contratosBadgeTpl!:  TemplateRef<{ $implicit: AssignedClient }>;
  @ViewChild('serviciosBadgeTpl')  private serviciosBadgeTpl!:  TemplateRef<{ $implicit: AssignedClient }>;

  private readonly clientsService = inject(AssignedClientsService);
  private readonly globalLoading  = inject(GlobalLoadingService);
  private readonly platformId     = inject(PLATFORM_ID);
  private readonly cdr            = inject(ChangeDetectorRef);

  readonly currentPage = signal(1);
  readonly pageSize    = signal(20);
  readonly loading     = signal(false);
  readonly error       = signal(false);
  readonly data        = signal<AssignedClient[]>([]);
  readonly total       = signal(0);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly detailModalOpen   = signal(false);
  readonly detailModalClient = signal<AssignedClient | null>(null);
  readonly detailModalMode   = signal<ClientDetailMode>('contratos');

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
    }).subscribe({
      next: res => {
        this.data.set(res?.data ?? []);
        this.total.set(res?.total ?? 0);
        this.loading.set(false);
        this.globalLoading.stop();
      },
      error: () => {
        this.data.set([]);
        this.total.set(0);
        this.error.set(true);
        this.loading.set(false);
        this.globalLoading.stop();
      },
    });
  }
}
