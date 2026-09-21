import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, inject, signal, TemplateRef, ViewChild, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AlertService, ButtonComponent } from '@apolo-energies/ui';
import { DataTableComponent, TableColumn } from '@apolo-energies/table';
import { ApoloIcons, NoteIcon, StarIcon, UiIconSource } from '@apolo-energies/icons';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { ContractTemplateService } from '../../../../core/services/contract-template.service';
import { ContractTemplate } from '../../../../core/models/contract-template.model';
import { ContractTemplateFormComponent } from './contract-template-form/contract-template-form';
import { ContractTemplateHistoryComponent } from './contract-template-history/contract-template-history';
import { buildPrintDocumentHtml, typeLabel as resolveTypeLabel } from './contract-templates-page.helpers';

@Component({
  selector: 'app-contract-templates-page',
  standalone: true,
  imports: [
    DataTableComponent, ButtonComponent,
    ApoloIcons, TableSkeletonComponent,
    ContractTemplateFormComponent, ContractTemplateHistoryComponent,
  ],
  templateUrl: './contract-templates-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractTemplatesPageComponent implements AfterViewInit {
  private templateService = inject(ContractTemplateService);
  private alertService    = inject(AlertService);
  private globalLoading   = inject(GlobalLoadingService);
  private platformId      = inject(PLATFORM_ID);
  private cdr             = inject(ChangeDetectorRef);

  readonly loading          = signal(false);
  readonly data             = signal<ContractTemplate[]>([]);
  readonly formOpen         = signal(false);
  readonly historyOpen      = signal(false);
  readonly selectedCode     = signal<string>('');
  readonly selectedTemplate = signal<ContractTemplate | null>(null);
  readonly togglingId       = signal<string | null>(null);

  readonly noteIcon: UiIconSource = { type: 'apolo', icon: NoteIcon, size: 15 };
  readonly starIcon: UiIconSource = { type: 'apolo', icon: StarIcon, size: 16 };

  @ViewChild('typeTpl')    typeTpl!:    TemplateRef<{ $implicit: ContractTemplate }>;
  @ViewChild('activeTpl')  activeTpl!:  TemplateRef<{ $implicit: ContractTemplate }>;
  @ViewChild('actionsTpl') actionsTpl!: TemplateRef<{ $implicit: ContractTemplate }>;

  columns: TableColumn<ContractTemplate>[] = [
    { key: 'code',     label: 'Código' },
    { key: 'name',     label: 'Nombre' },
    { key: 'type',     label: 'Tipo',    align: 'center' },
    { key: 'version',  label: 'Versión', align: 'center' },
    { key: 'isActive', label: 'Activo',  align: 'center' },
    { key: 'actions',  label: 'Acciones', align: 'center' },
  ];

  constructor() {
    if (isPlatformBrowser(this.platformId)) this.load();
  }

  ngAfterViewInit(): void {
    const typeTplCol    = this.columns.find(c => c.key === 'type');
    const activeTplCol  = this.columns.find(c => c.key === 'isActive');
    const actionsTplCol = this.columns.find(c => c.key === 'actions');
    if (typeTplCol)    typeTplCol.cellTemplate    = this.typeTpl;
    if (activeTplCol)  activeTplCol.cellTemplate  = this.activeTpl;
    if (actionsTplCol) actionsTplCol.cellTemplate = this.actionsTpl;
    this.cdr.markForCheck();
  }

  private load(): void {
    this.loading.set(true);
    this.globalLoading.start();
    this.templateService.getAll().subscribe({
      next: res => {
        this.data.set(res);
        this.loading.set(false);
        this.globalLoading.stop();
      },
      error: () => {
        this.alertService.show('Error al cargar las plantillas', 'error');
        this.loading.set(false);
        this.globalLoading.stop();
      },
    });
  }

  onNewTemplate(): void {
    this.formOpen.set(true);
  }

  onEdit(row: ContractTemplate): void {
    this.selectedTemplate.set(row);
    this.formOpen.set(true);
  }

  onViewPdf(template: ContractTemplate): void {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(buildPrintDocumentHtml(template));
    win.document.close();
  }

  onFormSaved(): void {
    this.formOpen.set(false);
    this.selectedTemplate.set(null);
    this.load();
  }

  onFormCancelled(): void {
    this.formOpen.set(false);
    this.selectedTemplate.set(null);
  }

  onHistory(row: ContractTemplate): void {
    this.selectedCode.set(row.code);
    this.historyOpen.set(true);
  }

  onHistoryClosed(): void {
    this.historyOpen.set(false);
    this.selectedCode.set('');
    this.load();
  }

  onToggleActive(row: ContractTemplate): void {
    if (this.togglingId() === row.id) return;
    this.togglingId.set(row.id);

    const request$ = row.isActive
      ? this.templateService.deactivate(row.id)
      : this.templateService.activate(row.id);

    request$.subscribe({
      next: () => {
        const msg = row.isActive ? 'Plantilla desactivada' : 'Plantilla activada';
        this.alertService.show(msg, 'success');
        this.togglingId.set(null);
        this.load();
      },
      error: () => {
        this.alertService.show('Error al cambiar el estado', 'error');
        this.togglingId.set(null);
      },
    });
  }

  typeLabel(type: string): string {
    return resolveTypeLabel(type);
  }
}
