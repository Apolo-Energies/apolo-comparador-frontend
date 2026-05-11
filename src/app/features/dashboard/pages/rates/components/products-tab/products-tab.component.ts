import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, computed, effect, inject, input, signal,
  TemplateRef, ViewChild,
} from '@angular/core';
import { Tariff } from '../../../../../../entities/provider.model';
import { RatesService } from '../../../../../../services/rates.service';
import {
  AlertComponent, AlertService,
  ButtonComponent, DialogComponent,
  InputFieldComponent, SelectFieldComponent, SelectOption,
} from '@apolo-energies/ui';
import { DataTableComponent, TableColumn } from '@apolo-energies/table';
import { LucideAngularModule, Percent, PackageOpen } from 'lucide-angular';

interface ProductRow {
  id:                   number;
  name:                 string;
  tariffId:             number;
  tariffCode:           string;
  isAvailable:          boolean;
  commissionPercentage: number | null;
  periods:              { period: string; value: number }[];
}

@Component({
  selector: 'app-products-tab',
  standalone: true,
  imports: [
    LucideAngularModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    InputFieldComponent,
    SelectFieldComponent,
    DataTableComponent,
  ],
  templateUrl: './products-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsTabComponent implements AfterViewInit {
  private readonly ratesService = inject(RatesService);
  private readonly alertService = inject(AlertService);
  private readonly cdr          = inject(ChangeDetectorRef);

  readonly PercentIcon     = Percent;
  readonly PackageOpenIcon = PackageOpen;

  readonly tariffs = input.required<Tariff[]>();

  @ViewChild('commTpl')         commTpl!:         TemplateRef<{ $implicit: ProductRow }>;
  @ViewChild('availabilityTpl') availabilityTpl!: TemplateRef<{ $implicit: ProductRow }>;
  @ViewChild('actionsTpl')      actionsTpl!:      TemplateRef<{ $implicit: ProductRow }>;

  columns: TableColumn<ProductRow>[] = [
    { key: 'tariffCode',           label: 'Tarifa' },
    { key: 'name',                 label: 'Nombre' },
    { key: 'commissionPercentage', label: 'Comisión',   align: 'center' },
    { key: 'isAvailable',          label: 'Disponible', align: 'center' },
    { key: 'actions',              label: '',           align: 'center' },
  ];

  ngAfterViewInit() {
    const col = (key: string) => this.columns.find(c => c.key === key);
    const commCol    = col('commissionPercentage');
    const availCol   = col('isAvailable');
    const actionsCol = col('actions');
    if (commCol)    commCol.cellTemplate    = this.commTpl;
    if (availCol)   availCol.cellTemplate   = this.availabilityTpl;
    if (actionsCol) actionsCol.cellTemplate = this.actionsTpl;
    this.cdr.markForCheck();
  }

  // ── Data ───────────────────────────────────────────────────────
  readonly rows           = signal<ProductRow[]>([]);
  readonly savingIds      = signal<Set<number>>(new Set());
  readonly filterTariffId = signal<number | null>(null);

  readonly tariffOptions = computed<SelectOption[]>(() =>
    this.tariffs().map(t => ({ value: String(t.id), label: t.code }))
  );

  readonly filteredRows = computed(() => {
    const id = this.filterTariffId();
    return id ? this.rows().filter(r => r.tariffId === id) : this.rows();
  });

  constructor() {
    effect(() => {
      this.rows.set(
        this.tariffs().flatMap(t =>
          t.products.map(p => ({
            id:                   p.id,
            name:                 p.name,
            tariffId:             p.tariffId,
            tariffCode:           t.code,
            isAvailable:          p.isAvailable ?? true,
            commissionPercentage: p.commissionPercentage ?? null,
            periods:              p.periods?.map(pp => ({ period: pp.period, value: pp.value })) ?? [],
          }))
        )
      );
    });
  }

  // ── Create ─────────────────────────────────────────────────────
  readonly createDialog   = signal(false);
  readonly createTariffId = signal('');
  readonly createName     = signal('');
  readonly createComm     = signal('');
  readonly creating       = signal(false);

  readonly createPeriods = signal<string[]>(['', '', '', '', '', '']);

  readonly createPeriodCount = computed(() => {
    const tariffId = this.createTariffId();
    if (!tariffId) return 6;
    const tariff = this.tariffs().find(t => t.id === Number(tariffId));
    return tariff?.code.startsWith('2.') ? 3 : 6;
  });

  readonly periodIndexes = computed(() =>
    Array.from({ length: this.createPeriodCount() }, (_, i) => i)
  );

  onCreateTariffChange(val: string) {
    this.createTariffId.set(val);
    this.createPeriods.set(['', '', '', '', '', '']);
  }

  updateCreatePeriod(index: number, value: string) {
    const periods = [...this.createPeriods()];
    periods[index] = value;
    this.createPeriods.set(periods);
  }

  openCreate() {
    const active = this.filterTariffId();
    this.createTariffId.set(active ? String(active) : '');
    this.createName.set('');
    this.createComm.set('');
    this.createPeriods.set(['', '', '', '', '', '']);
    this.createDialog.set(true);
  }

  submitCreate() {
    const name     = this.createName().trim();
    const tariffId = Number(this.createTariffId());
    if (!name || !tariffId || this.creating()) return;

    const count   = this.createPeriodCount();
    const periods = this.createPeriods().slice(0, count).map((v, i) => ({
      period: `P${i + 1}`,
      value:  parseFloat(v),
    }));

    if (periods.some(p => isNaN(p.value) || p.value < 0)) {
      this.alertService.show('Todos los períodos deben tener un valor numérico válido', 'error');
      return;
    }

    const commDraft  = this.createComm().trim();
    const commission = commDraft === '' ? null : parseFloat(commDraft);
    if (commDraft !== '' && (isNaN(commission!) || commission! < 0 || commission! > 100)) {
      this.alertService.show('El porcentaje debe estar entre 0 y 100', 'error');
      return;
    }

    this.creating.set(true);
    this.ratesService.createProduct({ name, tariffId, periods }).subscribe({
      next: product => {
        const newRow: ProductRow = {
          id:                   product.id,
          name:                 product.name,
          tariffId:             product.tariffId,
          tariffCode:           this.tariffs().find(t => t.id === product.tariffId)?.code ?? '',
          isAvailable:          product.isAvailable ?? true,
          commissionPercentage: product.commissionPercentage ?? null,
          periods,
        };
        if (commission !== null) {
          this.ratesService.patchCommission(newRow.id, commission).subscribe({
            next: () => { newRow.commissionPercentage = commission; this.cdr.markForCheck(); },
          });
        }
        this.rows.update(rs => [...rs, newRow]);
        this.createDialog.set(false);
        this.creating.set(false);
        this.alertService.show('Producto creado correctamente', 'success');
      },
      error: () => {
        this.creating.set(false);
        this.alertService.show('Error al crear el producto', 'error');
      },
    });
  }

  // ── Edit ───────────────────────────────────────────────────────
  readonly editDialog = signal(false);
  readonly editRow    = signal<ProductRow | null>(null);
  readonly editName   = signal('');
  readonly editComm   = signal('');
  readonly editPeriods = signal<string[]>(['', '', '', '', '', '']);

  readonly editPeriodCount = computed(() => {
    const row = this.editRow();
    if (!row) return 6;
    const tariff = this.tariffs().find(t => t.id === row.tariffId);
    return tariff?.code.startsWith('2.') ? 3 : 6;
  });

  readonly editPeriodIndexes = computed(() =>
    Array.from({ length: this.editPeriodCount() }, (_, i) => i)
  );

  updateEditPeriod(index: number, value: string) {
    const periods = [...this.editPeriods()];
    periods[index] = value;
    this.editPeriods.set(periods);
  }

  openEdit(row: ProductRow) {
    this.editRow.set(row);
    this.editName.set(row.name);
    this.editComm.set(row.commissionPercentage !== null ? String(row.commissionPercentage) : '');
    const slots: string[] = ['', '', '', '', '', ''];
    row.periods.forEach(p => {
      const idx = parseInt(p.period.substring(1)) - 1;
      if (idx >= 0 && idx < 6) slots[idx] = String(p.value);
    });
    this.editPeriods.set(slots);
    this.editDialog.set(true);
  }

  submitEdit(row: ProductRow) {
    const name = this.editName().trim();
    if (!name || this.savingIds().has(row.id)) return;

    const count   = this.editPeriodCount();
    const periods = this.editPeriods().slice(0, count).map((v, i) => ({
      period: `P${i + 1}`,
      value:  parseFloat(v),
    }));

    if (periods.some(p => isNaN(p.value) || p.value < 0)) {
      this.alertService.show('Todos los períodos deben tener un valor numérico válido', 'error');
      return;
    }

    const commDraft  = this.editComm().trim();
    const commission = commDraft === '' ? null : parseFloat(commDraft);
    if (commDraft !== '' && (isNaN(commission!) || commission! < 0 || commission! > 100)) {
      this.alertService.show('El porcentaje debe estar entre 0 y 100', 'error');
      return;
    }

    this.savingIds.update(s => new Set(s).add(row.id));
    const removeSaving = () => this.savingIds.update(s => { const n = new Set(s); n.delete(row.id); return n; });

    const commRequest$ = commission !== row.commissionPercentage
      ? this.ratesService.patchCommission(row.id, commission)
      : null;

    const finish = () => {
      this.rows.update(rs => rs.map(r =>
        r.id === row.id ? { ...r, name, commissionPercentage: commission, periods } : r
      ));
      this.editDialog.set(false);
      removeSaving();
      this.alertService.show('Producto actualizado', 'success');
    };

    this.ratesService.updateProduct(row.id, { name, periods }).subscribe({
      next: () => {
        if (commRequest$) {
          commRequest$.subscribe({
            next:  finish,
            error: () => { removeSaving(); this.alertService.show('Error al guardar la comisión', 'error'); },
          });
        } else {
          finish();
        }
      },
      error: () => { removeSaving(); this.alertService.show('Error al guardar el producto', 'error'); },
    });
  }

  // ── Delete ─────────────────────────────────────────────────────
  readonly deleteDialog = signal(false);
  readonly deleteRow    = signal<ProductRow | null>(null);

  requestDelete(row: ProductRow) {
    this.deleteRow.set(row);
    this.deleteDialog.set(true);
  }

  deleteProduct(row: ProductRow) {
    if (this.savingIds().has(row.id)) return;
    this.savingIds.update(s => new Set(s).add(row.id));
    this.ratesService.deleteProduct(row.id).subscribe({
      next: () => {
        this.rows.update(rs => rs.filter(r => r.id !== row.id));
        this.deleteDialog.set(false);
        this.savingIds.update(s => { const n = new Set(s); n.delete(row.id); return n; });
        this.alertService.show('Producto eliminado', 'success');
      },
      error: () => {
        this.savingIds.update(s => { const n = new Set(s); n.delete(row.id); return n; });
        this.alertService.show('Error al eliminar el producto', 'error');
      },
    });
  }

  // ── Toggle availability ────────────────────────────────────────
  readonly confirmDialog    = signal(false);
  readonly pendingToggleRow = signal<ProductRow | null>(null);

  requestToggle(row: ProductRow) {
    this.pendingToggleRow.set(row);
    this.confirmDialog.set(true);
  }

  confirmToggle(row: ProductRow) {
    if (this.savingIds().has(row.id)) return;
    const isAvailable = !row.isAvailable;
    this.savingIds.update(s => new Set(s).add(row.id));
    this.ratesService.patchAvailability(row.id, isAvailable).subscribe({
      next: () => {
        this.rows.update(rs => rs.map(r => r.id === row.id ? { ...r, isAvailable } : r));
        this.confirmDialog.set(false);
        this.savingIds.update(s => { const n = new Set(s); n.delete(row.id); return n; });
        this.alertService.show(isAvailable ? 'Producto activado' : 'Producto desactivado', 'success');
      },
      error: () => {
        this.savingIds.update(s => { const n = new Set(s); n.delete(row.id); return n; });
        this.alertService.show('Error al cambiar la disponibilidad', 'error');
      },
    });
  }
}
