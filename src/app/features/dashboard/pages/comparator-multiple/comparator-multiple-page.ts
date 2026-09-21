import {
  ChangeDetectionStrategy, Component, computed, inject, signal, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '@apolo-energies/auth';
import {
  AlertService, ButtonComponent, ComboboxComponent, ComboboxOption,
  DialogComponent, SelectFieldComponent, SelectOption, SliderComponent,
} from '@apolo-energies/ui';
import { ApoloIcons, FileDownIcon, FileSpreadsheetIcon, LightningIcon, UiIconSource } from '@apolo-energies/icons';
import { getUserRoles } from '../../../../core/helpers/auth.utils';
import { ComparatorService } from '../../../../core/services/comparator.service';
import { CommissionService } from '../../../../core/services/commission.service';
import { UserService } from '../../../../core/services/user.service';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';
import { LoadingOverlayComponent } from '../../../../shared/components/loading-overlay/loading-overlay.component';
import { ComparatorProductsByTariff, ComparadorUser } from '../comparator/comparator-ui.model';
import { PERIOD_NUMBERS } from '../../../../shared/constants/period';
import { environment } from '../../../../../environments/environment';
import { MultiItem, getCups, truncateValue, getPrecioEnergia, getPrecioPotencia } from './comparator-multiple.helpers';
import { UploadController } from './comparator-multiple-upload.controller';
import { ResultsController } from './comparator-multiple-results.controller';

const MAX_FILES = 10;

@Component({
  selector: 'app-comparator-multiple',
  standalone: true,
  imports: [
    ButtonComponent, ComboboxComponent, DialogComponent, SelectFieldComponent,
    SliderComponent, BrandLoaderComponent, LoadingOverlayComponent, ApoloIcons,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comparator-multiple-page.html',
})
export class ComparatorMultiple {
  private auth              = inject(AuthService);
  private comparatorService = inject(ComparatorService);
  private commissionService = inject(CommissionService);
  private userService       = inject(UserService);
  private alertService      = inject(AlertService);
  private sanitizer         = inject(DomSanitizer);
  private platformId        = inject(PLATFORM_ID);

  readonly MAX_FILES = MAX_FILES;
  readonly PERIODOS  = PERIOD_NUMBERS;
  readonly isApolo   = environment.clientName === 'apolo';

  readonly lightningIcon: UiIconSource = { type: 'apolo', icon: LightningIcon,      size: 36 };
  readonly excelIcon:     UiIconSource = { type: 'apolo', icon: FileSpreadsheetIcon, size: 16 };
  readonly pdfIcon:       UiIconSource = { type: 'apolo', icon: FileDownIcon,        size: 16 };

  readonly currentUser = this.auth.currentUser;
  readonly isMaster    = computed(() => getUserRoles(this.currentUser()).includes('Master'));
  readonly isReferrer  = computed(() => {
    const roles = getUserRoles(this.currentUser());
    return roles.includes('Referenciador') && !roles.includes('Colaborador') && !roles.includes('Colaborador - Referenciador');
  });

  // ── controllers: carga (dropzone/preview) y resultados (procesar/detalle) ──
  private readonly upload = new UploadController(this.alertService, this.sanitizer, MAX_FILES);
  private readonly results = new ResultsController(
    this.comparatorService, this.commissionService, this.alertService,
    {
      selectedUser:     () => this.selectedUser(),
      isReferrer:       () => this.isReferrer(),
      productsByTariff: () => this.productsByTariff(),
    },
  );

  // Signals expuestos por referencia directa (mismo objeto) para no tocar el .html existente.
  readonly phase          = this.results.phase;
  readonly viewMode       = this.results.viewMode;
  readonly processing     = this.results.processing;
  readonly items          = this.results.items;
  readonly periodosOpen   = this.results.periodosOpen;

  readonly globalFeeEnergia  = this.results.globalFeeEnergia;
  readonly globalFeePotencia = this.results.globalFeePotencia;
  readonly globalPrecioMedio = this.results.globalPrecioMedio;
  readonly globalProducto    = this.results.globalProducto;

  readonly pendingFiles = this.upload.pendingFiles;
  readonly previewIndex = this.upload.previewIndex;
  readonly isDragging   = this.upload.isDragging;

  readonly users          = signal<ComparadorUser[]>([]);
  readonly usersLoading   = signal(false);
  readonly selectedUserId = signal<string>('');

  // ── computed ───────────────────────────────────────────────────────────────

  readonly previewFile  = this.upload.previewFile;
  readonly filledSlots  = this.upload.filledSlots;
  readonly emptySlots   = this.upload.emptySlots;
  readonly detailItem   = this.results.detailItem;
  readonly readyCount   = this.results.readyCount;
  readonly totalAhorro  = this.results.totalAhorro;
  readonly totalComision= this.results.totalComision;

  readonly selectedUser = computed(() =>
    this.users().find(u => u.id === this.selectedUserId()) ?? null
  );
  readonly usersAsOptions = computed<ComboboxOption[]>(() =>
    this.users().map(u => ({ id: u.id, name: u.name }))
  );
  readonly productsByTariff = computed<ComparatorProductsByTariff>(() =>
    Object.fromEntries(
      this.comparatorService.tariffs().map(t => [
        t.code,
        t.products
          .filter(p => p.isAvailable)
          .sort((a, b) => { if (a.type === b.type) return 0; return a.type === 'Indexed' ? -1 : 1; })
          .map(p => p.name),
      ])
    )
  );
  readonly tarifaOptions = computed<SelectOption[]>(() =>
    Object.keys(this.productsByTariff()).map(t => ({ value: t, label: t }))
  );

  readonly globalProductoOptions = computed<SelectOption[]>(() => {
    const seen = new Set<string>();
    const opts: SelectOption[] = [];
    this.comparatorService.tariffs().forEach(t =>
      t.products.filter(p => p.isAvailable)
        .sort((a, b) => a.type === b.type ? 0 : a.type === 'Indexed' ? -1 : 1)
        .forEach(p => { if (!seen.has(p.name)) { seen.add(p.name); opts.push({ value: p.name, label: p.name }); } })
    );
    return opts;
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.comparatorService.loadTariffs();
      const userId = this.auth.currentUser()?.id;
      if (userId) this.commissionService.loadForUser(String(userId));
      if (this.isMaster()) this.loadUsers();
    }
  }

  // ── upload ─────────────────────────────────────────────────────────────────

  onDragOver(event: DragEvent): void { this.upload.onDragOver(event); }
  onDrop(event: DragEvent): void { this.upload.onDrop(event); }
  onFilesSelected(event: Event): void { this.upload.onFilesSelected(event); }
  removePending(file: File): void { this.upload.removePending(file); }
  isImage(file: File): boolean { return this.upload.isImage(file); }
  getPreviewUrl(file: File): SafeResourceUrl { return this.upload.getPreviewUrl(file); }
  formatFileSize(file: File): string { return this.upload.formatFileSize(file); }

  onProcesar(): void {
    const files = this.pendingFiles();
    if (!files.length) return;
    const userId = this.selectedUserId() || String(this.auth.currentUser()?.id ?? '') || undefined;
    this.results.process(files, userId, () => this.upload.reset());
  }

  backToUpload(): void {
    this.upload.releaseAll();
    this.upload.reset();
    this.results.reset();
  }

  // ── global controls ────────────────────────────────────────────────────────

  onGlobalFeeEnergiaChange(v: number): void  { this.results.onGlobalFeeEnergiaChange(v); }
  onGlobalFeePotenciaChange(v: number): void { this.results.onGlobalFeePotenciaChange(v); }
  onGlobalPrecioMedioChange(v: string): void { this.results.onGlobalPrecioMedioChange(v); }
  onGlobalProductoChange(value: string): void { this.results.onGlobalProductoChange(value); }

  // ── detail view ────────────────────────────────────────────────────────────

  openDetail(id: string): void { this.results.openDetail(id); }
  backToGrid(): void { this.results.backToGrid(); }
  onDetailTariffChange(item: MultiItem, value: string): void   { this.results.onDetailTariffChange(item, value); }
  onDetailProductoChange(item: MultiItem, value: string): void { this.results.onDetailProductoChange(item, value); }
  onDownload(type: 'pdf' | 'excel'): void { this.results.onDownload(type, this.isMaster(), this.selectedUserId()); }

  retryItem(item: MultiItem): void {
    const userId = this.selectedUserId() || String(this.auth.currentUser()?.id ?? '') || undefined;
    this.results.retryItem(item, userId);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  productoOptions(tariff: string): SelectOption[] { return this.results.productoOptions(tariff); }
  getCups(ocr: MultiItem['ocrResult']): string { return getCups(ocr); }
  truncate(v: number): number { return truncateValue(v); }

  getPrecioEnergia(periodos: { periodo: number | string; precioEnergiaOferta?: number }[], p: number): string {
    return getPrecioEnergia(periodos, p);
  }

  getPrecioPotencia(periodos: { periodo: number | string; precioPotenciaOferta?: number }[], p: number): string {
    return getPrecioPotencia(periodos, p);
  }

  // ── private ────────────────────────────────────────────────────────────────

  private loadUsers(): void {
    this.usersLoading.set(true);
    this.userService.getByFilters({ pageSize: 200 }).subscribe({
      next: res => {
        this.users.set(res.items.map(u => ({
          id:            u.id,
          name:          u.fullName,
          commissionPct: u.commissions?.find((c: any) => c.isActive)?.commissionType?.percentage ?? null,
        })));
        this.usersLoading.set(false);
      },
      error: () => this.usersLoading.set(false),
    });
  }
}
