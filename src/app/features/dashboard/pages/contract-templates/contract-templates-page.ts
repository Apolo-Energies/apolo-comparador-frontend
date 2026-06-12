import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, inject, signal, TemplateRef, ViewChild, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AlertService, ButtonComponent } from '@apolo-energies/ui';
import { DataTableComponent, TableColumn } from '@apolo-energies/table';
import { ApoloIcons, NoteIcon, StarIcon, UiIconSource } from '@apolo-energies/icons';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { ContractTemplateService } from '../../../../services/contract-template.service';
import { ContractTemplate } from '../../../../entities/contract-template.model';
import { ContractTemplateFormComponent } from './contract-template-form/contract-template-form';
import { ContractTemplateHistoryComponent } from './contract-template-history/contract-template-history';

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
    win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${template.name} v${template.version}</title>
  <style>
    @page {
      size: A4;
      margin-top:    2.5cm;
      margin-bottom: 2.5cm;
      margin-left:   3cm;
      margin-right:  3cm;
    }

    *, *::before, *::after {
      box-sizing:  border-box;
      font-family: Arial, Helvetica, sans-serif;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size:   11pt;
      line-height: 1.65;
      color:       #111;
      text-align:  justify;
    }

    /* Todos los elementos de texto heredan Arial y justificado */
    h1, h2, h3, h4, h5, h6, p, li, td, th, span, div {
      font-family: Arial, Helvetica, sans-serif;
      text-align:  justify;
    }

    h1 { font-size: 13pt; font-weight: bold; margin: 1em 0 0.4em; page-break-after: avoid; }
    h2 { font-size: 12pt; font-weight: bold; margin: .8em 0 .35em; page-break-after: avoid; }
    h3, h4, h5, h6 { font-size: 11pt; font-weight: bold; margin: .6em 0 .3em; page-break-after: avoid; }
    p  { margin: .4em 0; orphans: 3; widows: 3; }
    ul { list-style-type: disc;    padding-left: 2em; margin: .5em 0; }
    ol { list-style-type: decimal; padding-left: 2em; margin: .5em 0; }
    li { display: list-item; margin: .25em 0; }
    strong { font-weight: bold; }
    em { font-style: italic; }
    u  { text-decoration: underline; }
    s  { text-decoration: line-through; }
    /* <hr> = salto de página explícito */
    hr {
      border:            none;
      height:            0;
      margin:            0;
      padding:           0;
      break-after:       page;
      page-break-after:  always;
    }

    /* Tablas (incluye bloque de firma de dos columnas) */
    table {
      width:           100%;
      border-collapse: collapse;
      table-layout:    fixed;
    }
    td, th {
      vertical-align:  top;
      text-align:      left;  /* sobrescribe el justify global */
    }

    /* ── Pantalla: apariencia de documento ──────────────────────────────── */
    @media screen {
      html { background: #e8e8e8; }
      body {
        max-width: 21cm;
        margin: 0 auto;
        padding: 2.5cm 3cm;
        padding-top: calc(2.5cm + 52px);
        background: white;
        box-shadow: 0 0 40px rgba(0,0,0,.15);
        min-height: 29.7cm;
      }
      .toolbar {
        position: fixed; top: 0; left: 0; right: 0;
        background: #1e2028; color: #e5e7eb;
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 24px; z-index: 10;
        font-family: system-ui, sans-serif; font-size: 13px;
        box-shadow: 0 2px 12px rgba(0,0,0,.35);
        text-align: left;
      }
      .toolbar * { font-family: system-ui, sans-serif; text-align: left; }
      .toolbar strong { font-size: 14px; }
      .toolbar small  { color: #9ca3af; font-size: 11px; display: block; margin-top: 1px; }
      .toolbar button {
        background: #3b82f6; color: #fff; border: none;
        padding: 8px 20px; border-radius: 6px;
        cursor: pointer; font-size: 13px; font-weight: 600;
      }
      .toolbar button:hover { background: #2563eb; }
    }

    /* ── Impresión / Guardar como PDF ───────────────────────────────────── */
    @media print {
      html, body {
        background: white;
      }
      body {
        max-width:  none;
        margin:     0;
        padding:    0;
        box-shadow: none;
        min-height: auto;
        /* Sin overflow oculto — el navegador necesita ver todo el contenido para paginar */
        overflow:   visible;
      }
      .toolbar { display: none; }

      /* Permitir saltos de página dentro de cualquier elemento de bloque */
      *, *::before, *::after {
        overflow:            visible !important;
        break-inside:        auto;
        page-break-inside:   auto;
      }

      /* Los títulos no se quedan solos al final de una página */
      h1, h2, h3, h4, h5, h6 {
        break-after:       avoid;
        page-break-after:  avoid;
      }

      /* Párrafos con control de líneas huérfanas/viudas */
      p {
        orphans: 3;
        widows:  3;
      }

      /* Tablas: permitir que se partan entre páginas */
      table  { break-inside: auto; page-break-inside: auto; }
      thead  { display: table-header-group; }
      tfoot  { display: table-footer-group; }
      tr, td, th { break-inside: auto; page-break-inside: auto; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span>
      <strong>${template.name}</strong>
      <small>${template.code} &nbsp;·&nbsp; v${template.version} &nbsp;·&nbsp; ${template.type === 'individual' ? 'Individual' : 'Empresa'}</small>
    </span>
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
  ${template.content}
</body>
</html>`);
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
    return type === 'individual' ? 'Individual' : 'Empresa';
  }
}
