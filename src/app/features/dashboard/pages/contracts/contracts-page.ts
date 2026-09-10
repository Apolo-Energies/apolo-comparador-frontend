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
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { FileDownIcon, NoteIcon, SearchIcon, ShieldCheckIcon, SvgIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { AuthService } from '@apolo-energies/auth';
import { ContractService } from '../../../../services/contract.service';
import { ContratoClienteRow, ContratosCards } from '../../../../entities/contrato.model';
import { ContratoIncidencia, ContratoCheckItem } from '../../../../entities/contrato-incidencia.model';
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
    PaginatorComponent,
    InputFieldComponent, ButtonComponent,
    TableSkeletonComponent,
    ContractDetailDrawerComponent,
    Dialog, FormsModule, ReactiveFormsModule,
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
