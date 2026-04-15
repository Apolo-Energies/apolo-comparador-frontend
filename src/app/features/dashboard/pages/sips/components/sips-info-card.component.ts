import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '@apolo-energies/ui';
import { DownloadIcon, XIcon, filterIcon, UiIconSource } from '@apolo-energies/icons';
import { SipsPs } from '../../../../../entities/sips.model';

const TARIFF_LABELS: Record<string, string> = {
  '001': '2.0A',    '003': '2.0DHA',  '004': '2.0DHS',
  '006': '2.1A',    '007': '2.1DHA',  '008': '2.1DHS',
  '011': '3.0A',    '012': '3.1A',    '013': '6.1A',
  '014': '6.1B',    '015': '6.2',     '016': '6.3',
  '017': '6.4',     '018': '6.5',     '019': '6.1',
  '020': '6.2',     '021': '6.3',     '022': '6.4',
  '023': '6.5',
};

function getTarifaLabel(code?: string): string {
  if (!code) return '-';
  return TARIFF_LABELS[code] ?? code;
}

function wToKw(w?: number): string {
  if (!w) return '0';
  return (w / 1000).toFixed(2);
}

@Component({
  selector: 'app-sips-info-card',
  standalone: true,
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 bg-card rounded-lg border border-border p-6 relative">

      <!-- X close button top-right -->
      <button
        class="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        (click)="onClear.emit()">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <!-- Header: CUPS + action buttons -->
      <div class="flex justify-between items-start pr-10">
        <p class="text-lg font-semibold">{{ psData().cups }}</p>
        <div class="flex gap-2">
          <ui-button
            label="Generar comparativa"
            variant="secondary"
            size="sm"
            [leadingIcon]="filterIconSrc"
            (click)="onComparativa.emit()"
          />
          <ui-button
            label="Exportar"
            variant="secondary"
            size="sm"
            [leadingIcon]="downloadIconSrc"
            (click)="onExport.emit()"
          />
        </div>
      </div>

      <!-- Data grid: 2 columns -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-y-2 mt-4 text-sm">
        <p>
          <span class="font-semibold">Provincia: </span>
          <span class="text-muted-foreground">{{ psData().codigoProvinciaPS }}</span>
        </p>
        <p>
          <span class="font-semibold">Distribuidora: </span>
          <span class="text-muted-foreground">{{ psData().nombreEmpresaDistribuidora }}</span>
        </p>
        <p>
          <span class="font-semibold">Localidad: </span>
          <span class="text-muted-foreground">{{ psData().municipioPS }}</span>
        </p>
        <p>
          <span class="font-semibold">Tarifa: </span>
          <span class="text-muted-foreground">{{ tarifa() }}</span>
        </p>
        <p>
          <span class="font-semibold">Código Postal: </span>
          <span class="text-muted-foreground">{{ psData().codigoPostalPS }}</span>
        </p>
        <p>
          <span class="font-semibold">POT Max: </span>
          <span class="text-muted-foreground">{{ potMax() }} kW</span>
        </p>
      </div>
    </div>
  `,
})
export class SipsInfoCardComponent {
  readonly psData        = input.required<SipsPs>();
  readonly onExport      = output<void>();
  readonly onComparativa = output<void>();
  readonly onClear       = output<void>();

  readonly downloadIconSrc: UiIconSource = { type: 'apolo', icon: DownloadIcon, size: 14 };
  readonly filterIconSrc:   UiIconSource = { type: 'apolo', icon: filterIcon,   size: 14 };

  readonly tarifa = computed(() => getTarifaLabel(this.psData().codigoTarifaATREnVigor));
  readonly potMax = computed(() => wToKw(this.psData().potenciaMaximaBIEW));
}
