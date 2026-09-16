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
import { getUserRoles } from '../../../../utils/auth.utils';
import { BatchFileResult, ComparatorService } from '../../../../services/comparator.service';
import { CommissionService } from '../../../../services/commission.service';
import { UserService } from '../../../../services/user.service';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';
import { LoadingOverlayComponent } from '../../../../shared/components/loading-overlay/loading-overlay.component';
import {
  ComparadorFormValue, ComparadorResult, ComparatorProductsByTariff, OcrResult,
} from '../comparator/comparator.models';
import { PERIOD_NUMBERS } from '../../../../shared/constants/period';
import { ComparadorUser } from '../comparator/comparator.models';
import { environment } from '../../../../../environments/environment';

const MAX_FILES = 10;

interface MultiItem {
  id:        string;
  file:      File;
  fileName:  string;
  status:    'ready' | 'error';
  ocrResult: OcrResult | null;
  result:    ComparadorResult | null;
  form:      ComparadorFormValue;
  fileId:    string;
  error:     string | null;
}

@Component({
  selector: 'app-comparator-multiple',
  standalone: true,
  imports: [
    ButtonComponent, ComboboxComponent, DialogComponent, SelectFieldComponent,
    SliderComponent, BrandLoaderComponent, LoadingOverlayComponent, ApoloIcons,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comparator-multiple.html',
})
export class ComparatorMultiple {
  private auth              = inject(AuthService);
  private comparatorService = inject(ComparatorService);
  private commissionService = inject(CommissionService);
  private userService       = inject(UserService);
  private alertService      = inject(AlertService);
  private sanitizer         = inject(DomSanitizer);
  private platformId        = inject(PLATFORM_ID);

  private readonly objectUrls = new Map<File, string>();

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

  // ── state ──────────────────────────────────────────────────────────────────

  readonly phase          = signal<'upload' | 'results'>('upload');
  readonly viewMode       = signal<'grid' | 'detail'>('grid');
  readonly processing     = signal(false);
  readonly pendingFiles   = signal<File[]>([]);
  readonly items          = signal<MultiItem[]>([]);
  readonly detailItemId   = signal<string | null>(null);
  readonly previewIndex   = signal(0);
  readonly isDragging     = signal(false);
  readonly periodosOpen   = signal(true);
  readonly users          = signal<ComparadorUser[]>([]);
  readonly usersLoading   = signal(false);
  readonly selectedUserId = signal<string>('');

  // Global controls (aplican a todas las facturas)
  readonly globalFeeEnergia  = signal(0);
  readonly globalFeePotencia = signal(0);
  readonly globalPrecioMedio = signal(0);
  readonly globalProducto    = signal('');

  // ── computed ───────────────────────────────────────────────────────────────

  readonly previewFile  = computed(() => this.pendingFiles()[this.previewIndex()] ?? null);
  readonly filledSlots  = computed(() => Array.from({ length: this.pendingFiles().length }));
  readonly emptySlots   = computed(() => Array.from({ length: MAX_FILES - this.pendingFiles().length }));
  readonly detailItem   = computed(() => this.items().find(i => i.id === this.detailItemId()) ?? null);
  readonly readyCount   = computed(() => this.items().filter(i => i.status === 'ready').length);
  readonly totalAhorro  = computed(() => this.items().reduce((s, i) => s + (i.result?.ahorroXAnio  ?? 0), 0));
  readonly totalComision= computed(() => this.items().reduce((s, i) => s + (i.result?.comision     ?? 0), 0));

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

  onDragOver(event: DragEvent): void { event.preventDefault(); this.isDragging.set(true); }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  removePending(file: File): void {
    this.revokeUrl(file);
    const newList = this.pendingFiles().filter(f => f !== file);
    this.pendingFiles.set(newList);
    if (this.previewIndex() >= newList.length) this.previewIndex.set(Math.max(0, newList.length - 1));
  }

  onProcesar(): void {
    const files = this.pendingFiles();
    if (!files.length) return;
    const userId = this.selectedUserId() || String(this.auth.currentUser()?.id ?? '') || undefined;
    this.processing.set(true);
    this.items.set([]);

    this.comparatorService.batchProcess(files, userId).subscribe({
      next: (results: BatchFileResult[]) => {
        const newItems: MultiItem[] = files.map((file, idx) => {
          const res = results[idx];
          if (!res?.success || !res.data) {
            return {
              id: this.genId(), file, fileName: file.name, status: 'error' as const,
              ocrResult: null, result: null, form: this.emptyForm(),
              fileId: '', error: res?.error ?? 'Error al procesar',
            };
          }
          const { fileId, ocrData } = res.data;
          const tariff = this.detectTariff(ocrData);
          const form   = this.buildForm(ocrData, tariff);
          const result = this.comparatorService.calculate(form, ocrData);
          return {
            id: this.genId(), file, fileName: file.name, status: 'ready' as const,
            ocrResult: ocrData, result, form, fileId, error: null,
          };
        });
        this.items.set(newItems);
        this.phase.set('results');
        this.viewMode.set('grid');
        this.processing.set(false);
        this.pendingFiles.set([]);
      },
      error: () => {
        this.alertService.show('Error al procesar las facturas', 'error');
        this.processing.set(false);
      },
    });
  }

  backToUpload(): void {
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    this.objectUrls.clear();
    this.phase.set('upload');
    this.viewMode.set('grid');
    this.items.set([]);
    this.pendingFiles.set([]);
    this.previewIndex.set(0);
    this.globalFeeEnergia.set(0);
    this.globalFeePotencia.set(0);
    this.globalPrecioMedio.set(0);
  }

  // ── global controls ────────────────────────────────────────────────────────

  onGlobalFeeEnergiaChange(v: number): void   { this.globalFeeEnergia.set(v);               this.recalculateAll(); }
  onGlobalFeePotenciaChange(v: number): void  { this.globalFeePotencia.set(v);              this.recalculateAll(); }
  onGlobalPrecioMedioChange(v: string): void  { this.globalPrecioMedio.set(Math.min(60, Math.max(0, Number(v) || 0))); this.recalculateAll(); }

  onGlobalProductoChange(value: string): void {
    this.globalProducto.set(value);
    // Auto-set OMIE based on product type of the first ready item
    const firstReady = this.items().find(i => i.status === 'ready');
    if (firstReady) {
      const isIndexed = this.comparatorService.tariffs()
        .find(t => t.code === firstReady.form.tariff)
        ?.products.find(p => p.name === value)?.type === 'Indexed';
      if (!isIndexed) this.globalPrecioMedio.set(0);
      else if (this.globalPrecioMedio() < 20) this.globalPrecioMedio.set(20);
    }
    // Apply to each item — use the product if available for its tariff, otherwise keep current
    this.items.update(list => list.map(item => {
      if (item.status !== 'ready' || !item.ocrResult) return item;
      const available = this.productsByTariff()[item.form.tariff] ?? [];
      const producto = available.includes(value) ? value : item.form.producto;
      return this.computeItem(item, { ...item.form, producto });
    }));
  }

  // ── detail view ────────────────────────────────────────────────────────────

  openDetail(id: string): void {
    this.detailItemId.set(id);
    this.viewMode.set('detail');
  }

  backToGrid(): void {
    this.viewMode.set('grid');
    this.detailItemId.set(null);
  }

  onDetailTariffChange(item: MultiItem, value: string): void {
    const producto = this.productsByTariff()[value]?.[0] ?? '';
    this.applyItemChange(item, { ...item.form, tariff: value, producto });
  }

  onDetailProductoChange(item: MultiItem, value: string): void {
    const isIndexed = this.comparatorService.tariffs()
      .find(t => t.code === item.form.tariff)
      ?.products.find(p => p.name === value)
      ?.type === 'Indexed';
    if (!isIndexed) {
      this.globalPrecioMedio.set(0);
    } else if (this.globalPrecioMedio() < 20) {
      this.globalPrecioMedio.set(20);
    }
    this.applyItemChange(item, { ...item.form, producto: value });
    this.recalculateAll();
  }

  onDownload(type: 'pdf' | 'excel'): void {
    const item = this.detailItem();
    if (!item?.ocrResult || !item.result) return;
    const targetUserId = this.isMaster() ? (this.selectedUserId() || undefined) : undefined;
    this.comparatorService.download(type, item.form, item.result, item.ocrResult, item.fileId, targetUserId);
  }

  retryItem(item: MultiItem): void {
    const userId = this.selectedUserId() || String(this.auth.currentUser()?.id ?? '') || undefined;
    this.comparatorService.batchProcess([item.file], userId).subscribe({
      next: (results: BatchFileResult[]) => {
        const res = results[0];
        if (!res?.success || !res.data) return;
        const { fileId, ocrData } = res.data;
        const tariff = this.detectTariff(ocrData);
        const form   = this.buildForm(ocrData, tariff);
        const result = this.comparatorService.calculate(form, ocrData);
        this.items.update(list => list.map(i =>
          i.id === item.id
            ? { ...i, status: 'ready' as const, ocrResult: ocrData, result, form, fileId, error: null }
            : i
        ));
      },
      error: () => this.alertService.show('Error al reintentar', 'error'),
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  productoOptions(tariff: string): SelectOption[] {
    return (this.productsByTariff()[tariff] ?? []).map(p => ({ value: p, label: p }));
  }

  getCups(ocr: OcrResult | null): string {
    return ocr?.cliente?.cups ?? '';
  }

  isImage(file: File): boolean { return file.type.startsWith('image/'); }

  getPreviewUrl(file: File): SafeResourceUrl {
    if (!this.objectUrls.has(file)) this.objectUrls.set(file, URL.createObjectURL(file));
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrls.get(file)!);
  }

  formatFileSize(file: File): string {
    const kb = file.size / 1024;
    return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  }

  truncate(v: number): number { return Math.trunc(v); }

  getPrecioEnergia(periodos: { periodo: number | string; precioEnergiaOferta?: number }[], p: number): string {
    const found = periodos.find(x => Number(x.periodo) === p);
    return found ? (found.precioEnergiaOferta?.toFixed(6) ?? '0,000000') : '0,000000';
  }

  getPrecioPotencia(periodos: { periodo: number | string; precioPotenciaOferta?: number }[], p: number): string {
    const found = periodos.find(x => Number(x.periodo) === p);
    return found ? (found.precioPotenciaOferta?.toFixed(6) ?? '0,000000') : '0,000000';
  }

  // ── private ────────────────────────────────────────────────────────────────

  private addFiles(files: File[]): void {
    const remaining = MAX_FILES - this.pendingFiles().length;
    if (remaining <= 0) { this.alertService.show(`Límite de ${MAX_FILES} facturas alcanzado`, 'info'); return; }
    const toAdd = files.slice(0, remaining);
    if (files.length > remaining)
      this.alertService.show(`Solo se agregarán ${remaining} de las ${files.length} facturas (límite ${MAX_FILES})`, 'info');
    const wasEmpty = this.pendingFiles().length === 0;
    this.pendingFiles.update(list => [...list, ...toAdd]);
    if (wasEmpty) this.previewIndex.set(0);
  }

  private recalculateAll(): void {
    this.items.update(list => list.map(item => {
      if (item.status !== 'ready' || !item.ocrResult) return item;
      const form: ComparadorFormValue = {
        ...item.form,
        feeEnergia:  this.globalFeeEnergia(),
        feePotencia: this.globalFeePotencia(),
        precioMedio: this.globalPrecioMedio(),
      };
      return this.computeItem(item, form);
    }));
  }

  private applyItemChange(item: MultiItem, form: ComparadorFormValue): void {
    if (!item.ocrResult) return;
    const updated: ComparadorFormValue = {
      ...form,
      feeEnergia:  this.globalFeeEnergia(),
      feePotencia: this.globalFeePotencia(),
      precioMedio: this.globalPrecioMedio(),
    };
    const result = this.computeItem(item, updated);
    this.items.update(list => list.map(i => i.id === item.id ? result : i));
  }

  private computeItem(item: MultiItem, form: ComparadorFormValue): MultiItem {
    const pct          = (this.selectedUser()?.commissionPct ?? this.commissionService.commission()) || undefined;
    const base         = this.comparatorService.getComisionBase(form.producto, form.tariff, pct);
    const correctedForm = this.isReferrer() ? form : { ...form, comisionEnergia: base };
    const result       = this.comparatorService.calculate(correctedForm, item.ocrResult!);
    return { ...item, form: correctedForm, result };
  }

  private buildForm(ocr: OcrResult, tariff: string): ComparadorFormValue {
    const producto = this.productsByTariff()[tariff]?.[0] ?? '';
    const pct      = (this.selectedUser()?.commissionPct ?? this.commissionService.commission()) || undefined;
    const comision = this.comparatorService.getComisionBase(producto, tariff, pct);
    return {
      tariff, producto,
      precioMedio: this.globalPrecioMedio(),
      feeEnergia:  this.globalFeeEnergia(),
      feePotencia: this.globalFeePotencia(),
      comisionEnergia: comision,
    };
  }

  private emptyForm(): ComparadorFormValue {
    return { tariff: '', producto: '', precioMedio: 0, feeEnergia: 0, feePotencia: 0, comisionEnergia: 0 };
  }

  private detectTariff(ocr: OcrResult): string {
    const ocrTariff = ocr.contrato?.tarifa ?? '';
    const available = Object.keys(this.productsByTariff());
    return available.includes(ocrTariff) ? ocrTariff : (available[0] ?? '');
  }

  private revokeUrl(file: File): void {
    const url = this.objectUrls.get(file);
    if (url) { URL.revokeObjectURL(url); this.objectUrls.delete(file); }
  }

  private genId(): string { return Math.random().toString(36).slice(2, 10); }

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
