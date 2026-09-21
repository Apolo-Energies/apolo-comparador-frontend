import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, computed, effect, inject, input, signal,
  TemplateRef, ViewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Tariff } from '../../../../../../core/models/provider.model';
import { RatesService } from '../../../../../../core/services/rates.service';
import {
  AlertComponent, AlertService,
  ButtonComponent, DialogComponent,
  InputFieldComponent, SelectFieldComponent, SelectOption,
} from '@apolo-energies/ui';
import { DataTableComponent, TableColumn } from '@apolo-energies/table';
import { LucideAngularModule, Percent, PackageOpen, Zap, Bolt, Copy, Check } from 'lucide-angular';
import { ProductRow, TYPE_OPTIONS } from './products-tab.helpers';
import { CreateProductController } from './create-product.controller';
import { EditProductController } from './edit-product.controller';
import { ProductStatusController } from './product-status.controller';
import { ProductViewController } from './product-view.controller';

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
    DecimalPipe,
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
  readonly CopyIcon        = Copy;
  readonly CheckIcon       = Check;

  readonly tariffs = input.required<Tariff[]>();

  @ViewChild('commTpl')         commTpl!:         TemplateRef<{ $implicit: ProductRow }>;
  @ViewChild('availabilityTpl') availabilityTpl!: TemplateRef<{ $implicit: ProductRow }>;
  @ViewChild('actionsTpl')      actionsTpl!:      TemplateRef<{ $implicit: ProductRow }>;

  readonly columns   = signal<TableColumn<ProductRow>[]>([
    { key: 'tariffCode',           label: 'Tarifa' },
    { key: 'name',                 label: 'Nombre' },
    { key: 'commissionPercentage', label: 'Comisión',   align: 'center' },
    { key: 'isAvailable',          label: 'Disponible', align: 'center' },
    { key: 'actions',              label: '',           align: 'center' },
  ]);
  readonly viewReady = signal(false);

  ngAfterViewInit() {
    this.columns.set(this.columns().map(c => {
      if (c.key === 'commissionPercentage') return { ...c, cellTemplate: this.commTpl };
      if (c.key === 'isAvailable')          return { ...c, cellTemplate: this.availabilityTpl };
      if (c.key === 'actions')              return { ...c, cellTemplate: this.actionsTpl };
      return c;
    }));
    this.viewReady.set(true);
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

  readonly typeOptions: SelectOption[] = TYPE_OPTIONS;

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
          })),
        ),
      );
    });
  }

  // ── Create dialog (delegates to CreateProductController) ────────
  private readonly createCtrl = new CreateProductController({
    ratesService:      this.ratesService,
    alertService:      this.alertService,
    getTariffs:        () => this.tariffs(),
    getFilterTariffId: () => this.filterTariffId(),
    appendRow:         row => this.rows.update(rs => [...rs, row]),
    markForCheck:      () => this.cdr.markForCheck(),
  });
  readonly createDialog        = this.createCtrl.createDialog;
  readonly createTariffId      = this.createCtrl.createTariffId;
  readonly createName          = this.createCtrl.createName;
  readonly createType          = this.createCtrl.createType;
  readonly createComm          = this.createCtrl.createComm;
  readonly creating            = this.createCtrl.creating;
  readonly createEnergyPeriods = this.createCtrl.createEnergyPeriods;
  readonly createPowerPeriods  = this.createCtrl.createPowerPeriods;
  readonly createEnergyBulk    = this.createCtrl.createEnergyBulk;
  readonly createPowerBulk     = this.createCtrl.createPowerBulk;
  readonly createPeriodCount   = this.createCtrl.createPeriodCount;
  readonly createPeriodIndexes = this.createCtrl.createPeriodIndexes;

  onCreateTariffChange(val: string): void { this.createCtrl.onCreateTariffChange(val); }
  updateCreateEnergyPeriod(index: number, value: string): void { this.createCtrl.updateCreateEnergyPeriod(index, value); }
  updateCreatePowerPeriod(index: number, value: string): void { this.createCtrl.updateCreatePowerPeriod(index, value); }
  applyCreateEnergyBulk(): void { this.createCtrl.applyCreateEnergyBulk(); }
  applyCreatePowerBulk(): void { this.createCtrl.applyCreatePowerBulk(); }
  loadCreatePowerFromBoe(): void { this.createCtrl.loadCreatePowerFromBoe(); }
  openCreate(): void { this.createCtrl.openCreate(); }
  submitCreate(): void { this.createCtrl.submitCreate(); }

  // ── Edit dialog (delegates to EditProductController) ────────────
  private readonly editCtrl = new EditProductController({
    ratesService: this.ratesService,
    alertService: this.alertService,
    getTariffs:   () => this.tariffs(),
    savingIds:    this.savingIds,
    updateRow:    (id, patch) => this.rows.update(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r)),
  });
  readonly editDialog        = this.editCtrl.editDialog;
  readonly editRow           = this.editCtrl.editRow;
  readonly editName          = this.editCtrl.editName;
  readonly editType          = this.editCtrl.editType;
  readonly editComm          = this.editCtrl.editComm;
  readonly editEnergyPeriods = this.editCtrl.editEnergyPeriods;
  readonly editPowerPeriods  = this.editCtrl.editPowerPeriods;
  readonly editEnergyBulk    = this.editCtrl.editEnergyBulk;
  readonly editPowerBulk     = this.editCtrl.editPowerBulk;
  readonly editPeriodCount   = this.editCtrl.editPeriodCount;
  readonly editPeriodIndexes = this.editCtrl.editPeriodIndexes;

  updateEditEnergyPeriod(index: number, value: string): void { this.editCtrl.updateEditEnergyPeriod(index, value); }
  updateEditPowerPeriod(index: number, value: string): void { this.editCtrl.updateEditPowerPeriod(index, value); }
  applyEditEnergyBulk(): void { this.editCtrl.applyEditEnergyBulk(); }
  applyEditPowerBulk(): void { this.editCtrl.applyEditPowerBulk(); }
  loadEditPowerFromBoe(): void { this.editCtrl.loadEditPowerFromBoe(); }
  openEdit(row: ProductRow): void { this.editCtrl.openEdit(row); }
  submitEdit(row: ProductRow): void { this.editCtrl.submitEdit(row); }

  // ── View dialog + copy-to-clipboard (delegates to ProductViewController) ─
  private readonly viewCtrl = new ProductViewController();
  readonly viewDialog   = this.viewCtrl.viewDialog;
  readonly viewRow      = this.viewCtrl.viewRow;
  readonly copiedPeriod = this.viewCtrl.copiedPeriod;

  openView(row: ProductRow): void { this.viewCtrl.openView(row); }
  copyPeriodValue(key: string, value: number): void { this.viewCtrl.copyPeriodValue(key, value); }

  // ── Delete + toggle-availability (delegates to ProductStatusController) ──
  private readonly statusCtrl = new ProductStatusController({
    ratesService:         this.ratesService,
    alertService:         this.alertService,
    savingIds:            this.savingIds,
    removeRow:            id => this.rows.update(rs => rs.filter(r => r.id !== id)),
    patchRowAvailability: (id, isAvailable) => this.rows.update(rs => rs.map(r => r.id === id ? { ...r, isAvailable } : r)),
  });
  readonly deleteDialog     = this.statusCtrl.deleteDialog;
  readonly deleteRow        = this.statusCtrl.deleteRow;
  readonly confirmDialog    = this.statusCtrl.confirmDialog;
  readonly pendingToggleRow = this.statusCtrl.pendingToggleRow;

  requestDelete(row: ProductRow): void { this.statusCtrl.requestDelete(row); }
  deleteProduct(row: ProductRow): void { this.statusCtrl.deleteProduct(row); }
  requestToggle(row: ProductRow): void { this.statusCtrl.requestToggle(row); }
  confirmToggle(row: ProductRow): void { this.statusCtrl.confirmToggle(row); }
}
