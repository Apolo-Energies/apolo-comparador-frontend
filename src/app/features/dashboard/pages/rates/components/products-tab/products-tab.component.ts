import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, computed, effect, inject, input, signal,
  TemplateRef, ViewChild,
} from '@angular/core';
import { Tariff, ProductType } from '../../../../../../entities/provider.model';
import { RatesService } from '../../../../../../services/rates.service';
import {
  AlertComponent, AlertService,
  ButtonComponent, DialogComponent,
  InputFieldComponent, SelectFieldComponent, SelectOption,
} from '@apolo-energies/ui';
import { DataTableComponent, TableColumn } from '@apolo-energies/table';
import { LucideAngularModule, Percent, PackageOpen, Zap, Bolt } from 'lucide-angular';

interface PeriodValue { period: string; value: number }

interface ProductRow {
  id:                   number;
  name:                 string;
  tariffId:             number;
  tariffCode:           string;
  type:                 ProductType;
  isAvailable:          boolean;
  commissionPercentage: number | null;
  energyPeriods:        PeriodValue[];
  powerPeriods:         PeriodValue[];
}

const TYPE_OPTIONS = [
  { value: 'Fixed',   label: 'Fixed (precio configurado tal cual)' },
  { value: 'Indexed', label: 'Indexed (precio + OMIE × factor)'    },
];

const EMPTY_SLOTS = (): string[] => ['', '', '', '', '', ''];

/** Convierte un número a string decimal sin notación científica (evita "6e-8"). */
function toDecimalString(num: number): string {
  if (!isFinite(num)) return '';
  if (num === 0) return '0';
  const str = String(num);
  if (!/e/i.test(str)) return str;
  return num.toFixed(20).replace(/\.?0+$/, '');
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
  readonly ZapIcon         = Zap;
  readonly BoltIcon        = Bolt;

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
            type:                 p.type ?? 'Fixed',
            isAvailable:          p.isAvailable ?? true,
            commissionPercentage: p.commissionPercentage ?? null,
            energyPeriods:        p.periods?.map(pp => ({ period: pp.period, value: pp.value })) ?? [],
            powerPeriods:         p.powerPeriods?.map(pp => ({ period: pp.period, value: pp.value })) ?? [],
          }))
        )
      );
    });
  }

  // ── Helpers ────────────────────────────────────────────────────
  private tariffById(id: number | null | undefined): Tariff | undefined {
    if (!id) return undefined;
    return this.tariffs().find(t => t.id === Number(id));
  }

  private expectedCount(tariff?: Tariff): number {
    if (!tariff) return 6;
    return tariff.code.startsWith('2.') ? 3 : 6;
  }

  private slotsFromPeriods(periods: PeriodValue[]): string[] {
    const slots = EMPTY_SLOTS();
    periods.forEach(p => {
      const idx = parseInt(p.period.substring(1), 10) - 1;
      if (idx >= 0 && idx < 6) slots[idx] = toDecimalString(p.value);
    });
    return slots;
  }

  private parsedSection(slots: string[], count: number): { ok: true; periods: PeriodValue[] } | { ok: false; reason: 'partial' | 'invalid' } {
    const trimmed = slots.slice(0, count).map(v => v.trim());
    const allEmpty = trimmed.every(v => v === '');
    if (allEmpty) return { ok: true, periods: [] };

    const anyEmpty = trimmed.some(v => v === '');
    if (anyEmpty) return { ok: false, reason: 'partial' };

    const periods: PeriodValue[] = [];
    for (let i = 0; i < trimmed.length; i++) {
      const num = parseFloat(trimmed[i]);
      if (isNaN(num) || num < 0) return { ok: false, reason: 'invalid' };
      periods.push({ period: `P${i + 1}`, value: num });
    }
    return { ok: true, periods };
  }

  /** Rellena vacíos con '0' antes de parsear (para que los huecos se persistan como 0). */
  private fillEmptyWithZero(slots: string[], count: number): string[] {
    return slots.slice(0, count).map(v => v.trim() === '' ? '0' : v);
  }

  // ── Create state ───────────────────────────────────────────────
  readonly createDialog        = signal(false);
  readonly createTariffId      = signal('');
  readonly createName          = signal('');
  readonly createType          = signal<ProductType>('Fixed');
  readonly createComm          = signal('');
  readonly creating            = signal(false);
  readonly createEnergyPeriods = signal<string[]>(EMPTY_SLOTS());
  readonly createPowerPeriods  = signal<string[]>(EMPTY_SLOTS());
  readonly createEnergyBulk    = signal('');
  readonly createPowerBulk     = signal('');

  readonly typeOptions: SelectOption[] = TYPE_OPTIONS;

  readonly createTariff      = computed(() => this.tariffById(Number(this.createTariffId())));
  readonly createPeriodCount = computed(() => this.expectedCount(this.createTariff()));
  readonly createPeriodIndexes = computed(() =>
    Array.from({ length: this.createPeriodCount() }, (_, i) => i)
  );

  onCreateTariffChange(val: string) {
    this.createTariffId.set(val);
    this.createEnergyPeriods.set(EMPTY_SLOTS());
    this.createPowerPeriods.set(EMPTY_SLOTS());
    this.createEnergyBulk.set('');
    this.createPowerBulk.set('');
  }

  updateCreateEnergyPeriod(index: number, value: string) {
    const periods = [...this.createEnergyPeriods()];
    periods[index] = value;
    this.createEnergyPeriods.set(periods);
  }

  updateCreatePowerPeriod(index: number, value: string) {
    const periods = [...this.createPowerPeriods()];
    periods[index] = value;
    this.createPowerPeriods.set(periods);
  }

  applyCreateEnergyBulk() {
    const val = this.createEnergyBulk().trim();
    if (val === '') return;
    const count = this.createPeriodCount();
    this.createEnergyPeriods.set(EMPTY_SLOTS().map((_, i) => i < count ? val : ''));
  }

  applyCreatePowerBulk() {
    const val = this.createPowerBulk().trim();
    if (val === '') return;
    const count = this.createPeriodCount();
    this.createPowerPeriods.set(EMPTY_SLOTS().map((_, i) => i < count ? val : ''));
  }

  loadCreatePowerFromBoe() {
    const tariff = this.createTariff();
    const boe = tariff?.boePowers?.[0];
    if (!boe?.periods?.length) {
      this.alertService.show('Esta tarifa no tiene potencia BOE configurada', 'error');
      return;
    }
    const slots = this.slotsFromPeriods(
      boe.periods.map(p => ({ period: p.period, value: p.value }))
    );
    this.createPowerPeriods.set(slots);
  }

  openCreate() {
    const active = this.filterTariffId();
    this.createTariffId.set(active ? String(active) : '');
    this.createName.set('');
    this.createType.set('Fixed');
    this.createComm.set('');
    this.createEnergyPeriods.set(EMPTY_SLOTS());
    this.createPowerPeriods.set(EMPTY_SLOTS());
    this.createEnergyBulk.set('');
    this.createPowerBulk.set('');
    this.createDialog.set(true);
  }

  submitCreate() {
    const name     = this.createName().trim();
    const tariffId = Number(this.createTariffId());
    if (!name || !tariffId || this.creating()) return;

    const count = this.createPeriodCount();

    const energy = this.parsedSection(this.createEnergyPeriods(), count);
    if (!energy.ok) {
      this.alertService.show(
        energy.reason === 'partial'
          ? `Completa los ${count} períodos de energía`
          : 'Los valores de energía deben ser números válidos (≥ 0)',
        'error'
      );
      return;
    }
    if (energy.periods.length === 0) {
      this.alertService.show('Debes indicar los precios de energía', 'error');
      return;
    }

    const power = this.parsedSection(this.fillEmptyWithZero(this.createPowerPeriods(), count), count);
    if (!power.ok) {
      this.alertService.show('Los valores de potencia deben ser números válidos (≥ 0)', 'error');
      return;
    }

    const commDraft  = this.createComm().trim();
    const commission = commDraft === '' ? null : parseFloat(commDraft);
    if (commDraft !== '' && (isNaN(commission!) || commission! < 0 || commission! > 100)) {
      this.alertService.show('El porcentaje debe estar entre 0 y 100', 'error');
      return;
    }

    const type = this.createType();

    this.creating.set(true);
    this.ratesService.createProduct({
      name,
      tariffId,
      type,
      energyPeriods: energy.periods,
      powerPeriods:  power.periods.length ? power.periods : undefined,
    }).subscribe({
      next: product => {
        const newRow: ProductRow = {
          id:                   product.id,
          name:                 product.name,
          tariffId:             product.tariffId,
          tariffCode:           this.tariffs().find(t => t.id === product.tariffId)?.code ?? '',
          type:                 product.type ?? type,
          isAvailable:          product.isAvailable ?? true,
          commissionPercentage: product.commissionPercentage ?? null,
          energyPeriods:        energy.periods,
          powerPeriods:         power.periods,
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

  // ── Edit state ─────────────────────────────────────────────────
  readonly editDialog        = signal(false);
  readonly editRow           = signal<ProductRow | null>(null);
  readonly editName          = signal('');
  readonly editType          = signal<ProductType>('Fixed');
  readonly editComm          = signal('');
  readonly editEnergyPeriods = signal<string[]>(EMPTY_SLOTS());
  readonly editPowerPeriods  = signal<string[]>(EMPTY_SLOTS());
  readonly editEnergyBulk    = signal('');
  readonly editPowerBulk     = signal('');

  readonly editTariff      = computed(() => this.tariffById(this.editRow()?.tariffId));
  readonly editPeriodCount = computed(() => this.expectedCount(this.editTariff()));
  readonly editPeriodIndexes = computed(() =>
    Array.from({ length: this.editPeriodCount() }, (_, i) => i)
  );

  updateEditEnergyPeriod(index: number, value: string) {
    const periods = [...this.editEnergyPeriods()];
    periods[index] = value;
    this.editEnergyPeriods.set(periods);
  }

  updateEditPowerPeriod(index: number, value: string) {
    const periods = [...this.editPowerPeriods()];
    periods[index] = value;
    this.editPowerPeriods.set(periods);
  }

  applyEditEnergyBulk() {
    const val = this.editEnergyBulk().trim();
    if (val === '') return;
    const count = this.editPeriodCount();
    this.editEnergyPeriods.set(EMPTY_SLOTS().map((_, i) => i < count ? val : ''));
  }

  applyEditPowerBulk() {
    const val = this.editPowerBulk().trim();
    if (val === '') return;
    const count = this.editPeriodCount();
    this.editPowerPeriods.set(EMPTY_SLOTS().map((_, i) => i < count ? val : ''));
  }

  loadEditPowerFromBoe() {
    const tariff = this.editTariff();
    const boe = tariff?.boePowers?.[0];
    if (!boe?.periods?.length) {
      this.alertService.show('Esta tarifa no tiene potencia BOE configurada', 'error');
      return;
    }
    const slots = this.slotsFromPeriods(
      boe.periods.map(p => ({ period: p.period, value: p.value }))
    );
    this.editPowerPeriods.set(slots);
  }

  openEdit(row: ProductRow) {
    this.editRow.set(row);
    this.editName.set(row.name);
    this.editType.set(row.type);
    this.editComm.set(row.commissionPercentage !== null ? String(row.commissionPercentage) : '');
    this.editEnergyPeriods.set(this.slotsFromPeriods(row.energyPeriods));
    this.editPowerPeriods.set(this.slotsFromPeriods(row.powerPeriods));
    this.editEnergyBulk.set('');
    this.editPowerBulk.set('');
    this.editDialog.set(true);
  }

  submitEdit(row: ProductRow) {
    const name = this.editName().trim();
    if (!name || this.savingIds().has(row.id)) return;

    const count = this.editPeriodCount();

    const energy = this.parsedSection(this.editEnergyPeriods(), count);
    if (!energy.ok) {
      this.alertService.show(
        energy.reason === 'partial'
          ? `Completa los ${count} períodos de energía`
          : 'Los valores de energía deben ser números válidos (≥ 0)',
        'error'
      );
      return;
    }
    if (energy.periods.length === 0) {
      this.alertService.show('Los precios de energía no pueden quedar vacíos', 'error');
      return;
    }

    const power = this.parsedSection(this.fillEmptyWithZero(this.editPowerPeriods(), count), count);
    if (!power.ok) {
      this.alertService.show('Los valores de potencia deben ser números válidos (≥ 0)', 'error');
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

    const type = this.editType();

    const finish = () => {
      this.rows.update(rs => rs.map(r =>
        r.id === row.id
          ? { ...r, name, type, commissionPercentage: commission, energyPeriods: energy.periods, powerPeriods: power.periods }
          : r
      ));
      this.editDialog.set(false);
      removeSaving();
      this.alertService.show('Producto actualizado', 'success');
    };

    this.ratesService.updateProduct(row.id, {
      name,
      type,
      energyPeriods: energy.periods,
      powerPeriods:  power.periods.length ? power.periods : undefined,
    }).subscribe({
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
