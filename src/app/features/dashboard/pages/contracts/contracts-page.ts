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
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { FileDownIcon, NoteIcon, SearchIcon, ShieldCheckIcon, SvgIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { AuthService } from '@apolo-energies/auth';
import { ContractService } from '../../../../services/contract.service';
import { ContratoClienteRow, ContratosCards } from '../../../../entities/contrato.model';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { RefreshTokenService } from '../../../../services/refresh-token.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { ContractDetailDrawerComponent } from './components/contract-detail-drawer/contract-detail-drawer';
import { calcDias, estadoCls, estadoLabel, fmtDate, fmtKwh } from './contracts-utils';
import { getUserRoles } from '../../../../utils/auth.utils';

interface ContratosCardTile {
  key:    keyof ContratosCards;
  label:  string;
  icon:   typeof ShieldCheckIcon;
  accent: string;
  /** Cada ícono de @apolo-energies/icons trae su propio viewBox/stroke-width
   *  hardcodeado, así que a igual [size] se ven de peso visual desparejo —
   *  se compensa afinando el size por ícono (ver también .contratos-tile-icon
   *  en styles.css, que fuerza un stroke-width uniforme). */
  size:   number;
  value:  number | null;
}

/**
 * Colores de estado tomados del skill de dataviz (paleta de status, variante dark —
 * la app no tiene tema claro): good/warning/serious/critical + un neutro para "Estudios"
 * (no forma parte del pipeline activos->bajas, y puede venir null).
 */
const CARD_ACCENTS: Record<keyof ContratosCards, string> = {
  activos:      '#0ca30c',
  paraFirma:    '#fab219',
  paraTramitar: '#ec835a',
  estudios:     '#a1a1aa',
  bajas:        '#d03b3b',
};

@Component({
  selector: 'app-contracts-page',
  standalone: true,
  imports: [
    DataTableComponent, PaginatorComponent,
    InputFieldComponent, ButtonComponent,
    TableSkeletonComponent,
    ContractDetailDrawerComponent,
    SvgIcon,
  ],
  templateUrl: './contracts-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host ::ng-deep lib-data-table th:first-child,
    :host ::ng-deep lib-data-table td:first-child {
      position: sticky;
      left: 0;
      z-index: 2;
      box-shadow: 4px 0 8px -4px rgba(0, 0, 0, 0.4);
    }
    :host ::ng-deep lib-data-table th:first-child {
      background: var(--color-card);
    }
    :host ::ng-deep lib-data-table td:first-child {
      background: var(--color-card);
    }
    :host ::ng-deep lib-data-table tr:hover td:first-child {
      background: var(--color-body);
    }
  `],
})
export class ContractsPageComponent implements AfterViewInit {
  @ViewChild('clienteTpl')      private clienteTpl!:      TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('serviciosTpl')    private serviciosTpl!:    TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('consumoTpl')      private consumoTpl!:      TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('estadoTpl')       private estadoTpl!:       TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('vencimientoTpl')  private vencimientoTpl!:  TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('movimientoTpl')   private movimientoTpl!:   TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('detalleTpl')      private detalleTpl!:      TemplateRef<{ $implicit: ContratoClienteRow }>;

  private readonly contractService = inject(ContractService);
  private readonly globalLoading   = inject(GlobalLoadingService);
  private readonly platformId      = inject(PLATFORM_ID);
  private readonly cdr             = inject(ChangeDetectorRef);
  private readonly auth            = inject(AuthService);
  private readonly refreshToken    = inject(RefreshTokenService);

  readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon, size: 16 };
  readonly xIcon:      UiIconSource = { type: 'apolo', icon: XIcon,      size: 16 };

  readonly isMaster = computed(() => getUserRoles(this.auth.currentUser()).includes('Master'));
  readonly delegationId = signal<number | null>(null);
  /** Master ve todos los contratos; el resto necesita una delegación asignada (claim del JWT). */
  readonly hasDelegation = computed(() => this.isMaster() || this.delegationId() !== null);

  readonly cardsLoading = signal(false);
  readonly cards        = signal<ContratosCards | null>(null);

  readonly cardTiles = computed<ContratosCardTile[]>(() => {
    const c = this.cards();
    return [
      { key: 'activos',      label: 'Activos',       icon: ShieldCheckIcon, accent: CARD_ACCENTS.activos,      size: 22, value: c?.activos      ?? null },
      { key: 'paraFirma',    label: 'Para firma',     icon: NoteIcon,        accent: CARD_ACCENTS.paraFirma,    size: 22, value: c?.paraFirma    ?? null },
      { key: 'paraTramitar', label: 'Para tramitar',  icon: FileDownIcon,    accent: CARD_ACCENTS.paraTramitar, size: 21, value: c?.paraTramitar ?? null },
      { key: 'estudios',     label: 'Estudios',       icon: SearchIcon,      accent: CARD_ACCENTS.estudios,     size: 24, value: c?.estudios     ?? null },
      { key: 'bajas',        label: 'Bajas',          icon: XIcon,           accent: CARD_ACCENTS.bajas,        size: 20, value: c?.bajas        ?? null },
    ];
  });

  readonly filter      = signal('');
  readonly currentPage = signal(1);
  readonly pageSize    = signal(10);
  readonly loading     = signal(false);
  readonly data        = signal<ContratoClienteRow[]>([]);
  readonly hasMore     = signal(false);
  readonly selectedClient = signal<ContratoClienteRow | null>(null);

  readonly totalPages = computed(() =>
    this.hasMore() ? this.currentPage() + 1 : this.currentPage()
  );
  readonly totalCount = computed(() =>
    this.hasMore()
      ? this.currentPage() * this.pageSize() + 1
      : (this.currentPage() - 1) * this.pageSize() + this.data().length
  );

  readonly columns = signal<TableColumn<ContratoClienteRow>[]>([
    { key: 'NombreCliente',      label: 'Cliente' },
    { key: 'NumServicios',       label: 'Servicios',   align: 'center' },
    { key: 'ConsumoTotal',       label: 'Consumo',     align: 'right' },
    { key: 'EstadoResumen',      label: 'Estado',      align: 'center' },
    { key: 'ProximoVencimiento', label: 'Próx. venc.', align: 'center' },
    { key: 'UltimoMovimiento',   label: 'Último mov.', align: 'center' },
    { key: '__detalle',          label: 'Detalle',     align: 'center' },
  ]);

  readonly estadoCls   = estadoCls;
  readonly estadoLabel = estadoLabel;
  readonly fmtDate     = fmtDate;
  readonly calcDias    = calcDias;
  readonly fmtKwh      = fmtKwh;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.delegationId.set(this.refreshToken.getDelegationIdFromToken());
      if (this.hasDelegation()) {
        this.load();
        this.loadCards();
      }
    }
  }

  loadCards(): void {
    this.cardsLoading.set(true);
    this.contractService.getContratosCards(this.delegationId()).subscribe({
      next: cards => {
        this.cards.set(cards);
        this.cardsLoading.set(false);
      },
      error: () => {
        this.cards.set(null);
        this.cardsLoading.set(false);
      },
    });
  }

  ngAfterViewInit(): void {
    this.columns.update(cols => cols.map(col => {
      if (col.key === 'NombreCliente')      return { ...col, cellTemplate: this.clienteTpl     };
      if (col.key === 'NumServicios')       return { ...col, cellTemplate: this.serviciosTpl   };
      if (col.key === 'ConsumoTotal')       return { ...col, cellTemplate: this.consumoTpl     };
      if (col.key === 'EstadoResumen')      return { ...col, cellTemplate: this.estadoTpl      };
      if (col.key === 'ProximoVencimiento') return { ...col, cellTemplate: this.vencimientoTpl };
      if (col.key === 'UltimoMovimiento')   return { ...col, cellTemplate: this.movimientoTpl  };
      if (col.key === '__detalle')          return { ...col, cellTemplate: this.detalleTpl     };
      return col;
    }));
    this.cdr.markForCheck();
  }

  openDetail(c: ContratoClienteRow): void {
    this.selectedClient.set(c);
  }

  closeDetail(): void {
    this.selectedClient.set(null);
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
      filter: this.filter() || undefined,
      offset: (this.currentPage() - 1) * this.pageSize(),
      limit:  this.pageSize(),
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
  }
}
