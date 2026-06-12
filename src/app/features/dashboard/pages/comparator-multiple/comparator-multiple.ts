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
  template: `
    @if (isApolo) {
      <app-brand-loader [visible]="processing()" [fullscreen]="true" [showBar]="true"
        [showWordmark]="false" [showTitle]="true" title="Procesando facturas..."
        [showDescription]="false" [showMicrocopy]="false" [showBackdrop]="true"
        [showMicrocopyIcon]="false" [size]="100" />
    } @else {
      <app-loading-overlay [loading]="processing()" />
    }

    <div class="h-full flex flex-col">

      <!-- ── FASE UPLOAD ──────────────────────────────────────────────── -->
      @if (phase() === 'upload') {
        <input #fileInput type="file" multiple class="hidden" (change)="onFilesSelected($event)" />

        <div class="w-full h-full rounded-lg border border-border bg-card px-8 py-8 flex flex-col gap-6">

          <!-- Selector de usuario (solo Master) -->
          @if (isMaster()) {
            @if (usersLoading()) {
              <div class="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted/40 animate-pulse">
                <div class="h-4 w-4 rounded-full bg-muted-foreground/20 shrink-0"></div>
                <div class="h-3 w-40 rounded bg-muted-foreground/20"></div>
              </div>
            } @else {
              <ui-combobox placeholder="Seleccionar usuario" [options]="usersAsOptions()"
                [value]="selectedUserId()" (valueChange)="selectedUserId.set($event.toString())" />
            }
          }

          <!-- Área de previsualización / dropzone -->
          @if (previewFile(); as f) {
            <div class="relative flex-1 min-h-0 rounded-lg overflow-hidden border border-border bg-muted/20"
              (dragover)="onDragOver($event)" (dragleave)="isDragging.set(false)" (drop)="onDrop($event)">
              @if (isImage(f)) {
                <img [src]="getPreviewUrl(f)" [alt]="f.name" class="w-full h-full object-contain" />
              } @else {
                <iframe [src]="getPreviewUrl(f)" class="w-full h-full border-0"></iframe>
              }
              <div class="absolute bottom-0 left-0 right-0 px-3 py-2 bg-black/50 backdrop-blur-sm">
                <p class="text-xs text-white truncate">{{ f.name }}</p>
              </div>
            </div>
          } @else {
            <div class="flex-1 flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed
                         transition-colors cursor-pointer select-none text-center px-8 py-10 min-h-0"
              [class.border-primary]="isDragging()" [class.bg-primary/5]="isDragging()"
              [class.border-border]="!isDragging()"
              (click)="fileInput.click()" (dragover)="onDragOver($event)"
              (dragleave)="isDragging.set(false)" (drop)="onDrop($event)">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                class="text-muted-foreground pointer-events-none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div class="pointer-events-none">
                <p class="text-sm font-medium text-foreground">Arrastra las facturas aquí o haz click para seleccionar</p>
                <p class="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, PDF · hasta {{ MAX_FILES }} archivos</p>
              </div>
            </div>
          }

          <!-- Lista de archivos -->
          @if (pendingFiles().length > 0) {
            <div class="shrink-0 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Facturas</p>
                  <div class="flex items-center gap-0.5">
                    @for (n of filledSlots(); track $index) {
                      <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                    }
                    @for (n of emptySlots(); track $index) {
                      <span class="w-1.5 h-1.5 rounded-full bg-border"></span>
                    }
                  </div>
                  <span class="text-xs text-muted-foreground">{{ pendingFiles().length }}/{{ MAX_FILES }}</span>
                </div>
                @if (pendingFiles().length < MAX_FILES) {
                  <button type="button"
                    class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-70 transition-opacity"
                    (click)="fileInput.click()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Agregar más
                  </button>
                }
              </div>
              <p class="text-xs text-muted-foreground">Haz clic en una factura para previsualizarla</p>
              <div class="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
                @for (f of pendingFiles(); let i = $index; track f.name + f.size) {
                  <button type="button"
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-left group"
                    [class.border-primary]="i === previewIndex()" [class.bg-primary/5]="i === previewIndex()"
                    [class.border-border]="i !== previewIndex()" [class.bg-muted/40]="i !== previewIndex()"
                    [title]="f.name" (click)="previewIndex.set(i)">
                    <span class="shrink-0 w-5 h-5 rounded-full text-center text-xs font-semibold leading-5"
                      [class.bg-primary]="i === previewIndex()" [class.text-primary-foreground]="i === previewIndex()"
                      [class.bg-muted]="i !== previewIndex()" [class.text-muted-foreground]="i !== previewIndex()">
                      {{ i + 1 }}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                      class="shrink-0 text-muted-foreground">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-foreground truncate">{{ f.name }}</p>
                      <p class="text-xs text-muted-foreground">{{ formatFileSize(f) }}</p>
                    </div>
                    <button type="button"
                      class="shrink-0 p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                      (click)="$event.stopPropagation(); removePending(f)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </button>
                }
              </div>
            </div>
          }

          <div class="shrink-0 border-t border-border pt-4 flex justify-center">
            <ui-button label="Procesar" variant="default" size="md"
              [disabled]="pendingFiles().length === 0" (click)="onProcesar()" />
          </div>
        </div>
      }

      <!-- ── FASE RESULTADOS — modal grande ───────────────────────────── -->
      <ui-dialog
        [open]="phase() === 'results'"
        [closeable]="true"
        maxWidth="max-w-6xl"
        (openChange)="!$event && backToUpload()">

        <div class="flex flex-col" style="height: min(90vh, 860px)">

          <!-- Controles globales — solo visibles en el grid -->
          @if (viewMode() === 'grid') {
            <div class="shrink-0 border-b border-border bg-muted/20 px-5 pt-4 pb-3 pr-14 space-y-3">
              <!-- Fila 1: Producto + OMIE -->
              <div class="grid grid-cols-2 gap-3 items-end">
                <ui-select
                  label="Producto"
                  placeholder="Seleccionar producto"
                  [options]="globalProductoOptions()"
                  [value]="globalProducto()"
                  (valueChange)="onGlobalProductoChange($event)" />
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Precio medio OMIE (€/MWh)</label>
                  <input type="number" placeholder="0" min="0" max="60"
                    [value]="globalPrecioMedio() || ''"
                    (change)="onGlobalPrecioMedioChange($any($event.target).value)"
                    class="h-10 px-3 text-sm rounded-lg border border-border bg-card text-foreground
                           focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <!-- Fila 2: Fee E | Fee P lado a lado -->
              <div class="grid grid-cols-2 gap-4">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground whitespace-nowrap shrink-0">Fee Energía</span>
                  <div class="flex-1">
                    <ui-slider [value]="globalFeeEnergia()" [min]="0" [max]="30" [step]="1"
                      (valueChange)="onGlobalFeeEnergiaChange($event)" />
                  </div>
                  <span class="text-xs font-mono font-semibold text-primary w-6 text-right shrink-0">{{ globalFeeEnergia() }}</span>
                  <span class="text-xs text-muted-foreground shrink-0">€/MWh</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground whitespace-nowrap shrink-0">Fee Potencia</span>
                  <div class="flex-1">
                    <ui-slider [value]="globalFeePotencia()" [min]="0" [max]="5" [step]="1"
                      (valueChange)="onGlobalFeePotenciaChange($event)" />
                  </div>
                  <span class="text-xs font-mono font-semibold text-primary w-4 text-right shrink-0">{{ globalFeePotencia() }}</span>
                  <span class="text-xs text-muted-foreground shrink-0">€/kW/año</span>
                </div>
              </div>
            </div>
          }

          <!-- ─ Vista GRID ─────────────────────────────────────────────── -->
          @if (viewMode() === 'grid') {
            <div class="flex-1 min-h-0 overflow-y-auto p-5">

              <!-- Encabezado + resumen totales -->
              <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p class="text-base font-semibold text-foreground">
                  Todas las facturas
                  <span class="text-sm font-normal text-muted-foreground ml-1">({{ items().length }})</span>
                </p>
                @if (readyCount() > 0) {
                  <div class="flex items-center gap-3 text-xs flex-wrap">
                    <span class="text-muted-foreground">
                      Ahorro total:
                      <span class="font-semibold" [class.text-green-500]="totalAhorro() > 0" [class.text-red-500]="totalAhorro() <= 0">
                        {{ truncate(totalAhorro()) }}€/año
                      </span>
                    </span>
                    @if (!isReferrer()) {
                      <span class="text-muted-foreground">·</span>
                      <span class="text-muted-foreground">
                        Comisión total:
                        <span class="font-semibold text-foreground">{{ truncate(totalComision()) }}€</span>
                      </span>
                    }
                  </div>
                }
              </div>

              <!-- Grid de tarjetas — compactas, más columnas -->
              <div class="grid gap-2 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
                @for (item of items(); let i = $index; track item.id) {
                  <div class="rounded-xl border border-border bg-card flex flex-col gap-1.5 p-3 transition-colors"
                    [class.cursor-pointer]="item.status === 'ready'"
                    [class.hover:border-primary/60]="item.status === 'ready'"
                    [class.hover:bg-primary/5]="item.status === 'ready'"
                    (click)="item.status === 'ready' && openDetail(item.id)">

                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-muted-foreground">#{{ i + 1 }}</span>
                      <span class="w-1.5 h-1.5 rounded-full shrink-0"
                        [class.bg-green-500]="item.status === 'ready'"
                        [class.bg-red-500]="item.status === 'error'"></span>
                    </div>

                    @if (item.status === 'error') {
                      <p class="text-xs text-red-500">{{ item.error }}</p>
                      <button type="button"
                        class="text-xs text-primary hover:opacity-70 transition-opacity text-left"
                        (click)="$event.stopPropagation(); retryItem(item)">↺ Reintentar</button>
                    } @else if (item.result) {
                      @if (getCups(item.ocrResult)) {
                        <p class="text-xs font-mono text-muted-foreground truncate leading-tight" [title]="getCups(item.ocrResult)">
                          {{ getCups(item.ocrResult) }}
                        </p>
                      }
                      <p class="text-xs text-muted-foreground truncate leading-tight">{{ item.form.tariff }} · {{ item.form.producto }}</p>
                      <div class="py-1.5 text-center">
                        <p class="text-xl font-bold leading-none"
                          [class.text-green-500]="item.result.ahorroXAnio > 0"
                          [class.text-red-500]="item.result.ahorroXAnio <= 0">
                          {{ item.result.ahorroXAnio > 0 ? '+' : '' }}{{ truncate(item.result.ahorroXAnio) }}€
                        </p>
                        <p class="text-xs text-muted-foreground mt-0.5">ahorro/año</p>
                      </div>
                      @if (!isReferrer()) {
                        <div class="flex items-center justify-between text-xs border-t border-border pt-1.5">
                          <span class="text-muted-foreground">Com.</span>
                          <span class="font-semibold text-foreground">{{ truncate(item.result.comision) }}€</span>
                        </div>
                      }
                      <button type="button"
                        class="w-full text-xs text-center text-primary hover:opacity-70 transition-opacity">
                        Ver detalle →
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <!-- ─ Vista DETALLE ───────────────────────────────────────────── -->
          @if (viewMode() === 'detail') {
            @if (detailItem(); as item) {
              <div class="flex-1 min-h-0 flex flex-col overflow-hidden">

                <!-- Header — dos filas, pr-14 para la X del dialog -->
                <div class="shrink-0 border-b border-border bg-muted/10 px-5 pt-4 pb-3 pr-14">
                  <!-- Fila 1: botón volver + separador + nombre archivo -->
                  <div class="flex items-center gap-2 min-w-0">
                    <button type="button"
                      class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      (click)="backToGrid()">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                      Todas las facturas
                    </button>
                    <span class="text-muted-foreground/40 shrink-0">/</span>
                    <p class="text-sm font-semibold text-foreground truncate">{{ item.fileName }}</p>
                  </div>
                  <!-- Fila 2: tarifa + CUPS alineados a la izquierda debajo del nombre -->
                  <div class="flex items-center gap-2 mt-2">
                    <span class="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-md shrink-0">
                      {{ item.form.tariff }}
                    </span>
                    @if (getCups(item.ocrResult)) {
                      <span class="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        {{ getCups(item.ocrResult) }}
                      </span>
                    }
                  </div>
                </div>

                <!-- Contenido -->
                <div class="flex-1 min-h-0 overflow-y-auto">
                  <div class="space-y-6 p-6">

                    <!-- Producto + OMIE lado a lado -->
                    <div class="grid grid-cols-2 gap-3">
                      <ui-select label="Producto" [options]="productoOptions(item.form.tariff)"
                        [value]="item.form.producto" (valueChange)="onDetailProductoChange(item, $event)" />
                      <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Precio medio OMIE (€/MWh)</label>
                        <input type="number" placeholder="0" min="0" max="60"
                          [value]="globalPrecioMedio() || ''"
                          (change)="onGlobalPrecioMedioChange($any($event.target).value)"
                          class="h-10 px-3 text-sm rounded-lg border border-border bg-card text-foreground
                                 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                    </div>

                    <!-- Fee Energía y Fee Potencia — cards individuales -->
                    <div class="grid grid-cols-2 gap-3">
                      <div class="flex flex-col gap-2 p-4 rounded-lg bg-card border border-border">
                        <div class="flex justify-between items-center">
                          <span class="text-sm font-medium text-foreground">Fee Energía</span>
                          <div class="flex items-center gap-1">
                            <span class="text-lg font-bold text-primary">{{ globalFeeEnergia() }}</span>
                            <span class="text-xs text-muted-foreground">€/MWh</span>
                          </div>
                        </div>
                        <ui-slider [value]="globalFeeEnergia()" [min]="0" [max]="30" [step]="1"
                          (valueChange)="onGlobalFeeEnergiaChange($event)" />
                      </div>
                      <div class="flex flex-col gap-2 p-4 rounded-lg bg-card border border-border">
                        <div class="flex justify-between items-center">
                          <span class="text-sm font-medium text-foreground">Fee Potencia</span>
                          <div class="flex items-center gap-1">
                            <span class="text-lg font-bold text-primary">{{ globalFeePotencia() }}</span>
                            <span class="text-xs text-muted-foreground">€/kW/año</span>
                          </div>
                        </div>
                        <ui-slider [value]="globalFeePotencia()" [min]="0" [max]="5" [step]="1"
                          (valueChange)="onGlobalFeePotenciaChange($event)" />
                      </div>
                    </div>

                    <!-- KPI cards -->
                    <div class="grid gap-4" [class.grid-cols-2]="!isReferrer()" [class.grid-cols-1]="isReferrer()">
                      @if (!isReferrer()) {
                        <div class="p-4 rounded-lg bg-card border border-border">
                          <p class="text-sm font-medium text-foreground mb-1">Comisión comercial</p>
                          <p class="text-2xl font-bold text-foreground">{{ truncate(item.result!.comision) }}€</p>
                          <p class="text-sm text-green-400">+ 10% extra</p>
                        </div>
                      }
                      <div class="p-4 rounded-lg bg-card border border-border">
                        <p class="text-sm font-medium text-foreground mb-1">Ahorro cliente</p>
                        <p class="text-xl font-bold text-foreground">{{ truncate(item.result!.ahorroEstudio) }}€ al mes</p>
                        <p class="text-xl font-bold"
                          [class.text-green-400]="item.result!.ahorroXAnio > 0"
                          [class.text-red-400]="item.result!.ahorroXAnio <= 0">
                          {{ truncate(item.result!.ahorroXAnio) }}€ al año
                        </p>
                        <p class="text-sm"
                          [class.text-green-400]="item.result!.ahorro_porcent > 0"
                          [class.text-red-400]="item.result!.ahorro_porcent <= 0">
                          {{ item.result!.ahorro_porcent > 0 ? '+' : '' }}{{ item.result!.ahorro_porcent }}% de ahorro
                        </p>
                      </div>
                    </div>

                    <!-- Precios ofertados -->
                    <div class="bg-card border border-border rounded-xl p-3 transition-all duration-300">
                      <div class="flex items-center gap-3">
                        <lib-apolo-icons [icon]="lightningIcon" class="flex items-center shrink-0" />
                        <p class="flex-1 text-lg font-semibold text-foreground">Precios ofertados</p>
                        <button class="h-8 w-8 rounded-lg border border-border flex items-center justify-center
                                       text-muted-foreground hover:bg-accent transition-colors"
                          (click)="periodosOpen.update(v => !v)">
                          <span class="inline-block text-lg font-bold transition-transform duration-300"
                            [class.rotate-180]="!periodosOpen()">–</span>
                        </button>
                      </div>
                      <div class="overflow-hidden transition-all duration-300"
                        [class.max-h-0]="!periodosOpen()" [class.opacity-0]="!periodosOpen()"
                        [class.max-h-96]="periodosOpen()" [class.opacity-100]="periodosOpen()"
                        [class.mt-2]="periodosOpen()">
                        <div class="grid grid-cols-2 gap-10 text-sm text-foreground pl-16">
                          <div class="space-y-3">
                            @for (p of PERIODOS; track p) {
                              <p><span class="opacity-70">Energía P{{ p }}:</span>
                                <span class="text-blue-300 ml-1">{{ getPrecioEnergia(item.result!.periodos, p) }}</span></p>
                            }
                          </div>
                          <div class="space-y-3">
                            @for (p of PERIODOS; track p) {
                              <p><span class="opacity-70">Potencia P{{ p }}:</span>
                                <span class="text-blue-300 ml-1">{{ getPrecioPotencia(item.result!.periodos, p) }}</span></p>
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                <!-- Footer detalle -->
                <div class="shrink-0 border-t border-border px-5 py-4 flex items-center gap-2">
                  <ui-button label="← Todas las facturas" variant="outline" size="sm" (click)="backToGrid()" />
                  <div class="flex-1"></div>
                  <ui-button label="Excel" variant="secondary" size="sm"
                    [leadingIcon]="excelIcon" (click)="onDownload('excel')" />
                  <ui-button label="Descargar PDF" variant="default" size="sm"
                    [leadingIcon]="pdfIcon" (click)="onDownload('pdf')" />
                </div>

              </div>
            }
          }

          <!-- Footer grid -->
          @if (viewMode() === 'grid') {
            <div class="shrink-0 border-t border-border px-5 py-4 flex items-center">
              <ui-button label="← Nueva comparación" variant="outline" size="sm" (click)="backToUpload()" />
            </div>
          }

        </div>
      </ui-dialog>

    </div>
  `,
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
