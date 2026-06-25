import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '@apolo-energies/ui';
import { DownloadIcon, filterIcon, UiIconSource } from '@apolo-energies/icons';
import { GasSipsPs } from '../../../../../entities/gas-sips.model';

const TARIFF_LABELS: Record<string, string> = {
  R1: 'R1 — Doméstico bajo',
  R2: 'R2 — Residencial medio',
  R3: 'R3 — Residencial alto',
  R4: 'R4 — Comercial/industrial pequeño',
  R5: 'R5 — Industrial mediano',
  R6: 'R6 — Industrial grande',
  L0: 'L0 — Alta presión',
  L1: 'L1 — Alta presión / industrial',
  L2: 'L2 — Transporte',
  L3: 'L3 — Transporte',
};

@Component({
  selector: 'app-sips-gas-info-card',
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
          <span class="text-muted-foreground">{{ psData().provincia ?? '—' }}</span>
        </p>
        <p>
          <span class="font-semibold">Distribuidora: </span>
          <span class="text-muted-foreground">{{ psData().nombreDistribuidora ?? '—' }}</span>
        </p>
        <p>
          <span class="font-semibold">Localidad: </span>
          <span class="text-muted-foreground">{{ psData().municipio ?? '—' }}</span>
        </p>
        <p>
          <span class="font-semibold">Tarifa: </span>
          <span class="text-muted-foreground">{{ tarifa() }}</span>
        </p>
        <p>
          <span class="font-semibold">Código Postal: </span>
          <span class="text-muted-foreground">{{ psData().codigoPostal ?? '—' }}</span>
        </p>
        <p>
          <span class="font-semibold">Caudal Max: </span>
          <span class="text-muted-foreground">{{ caudalDisplay() }}</span>
        </p>
      </div>
    </div>
  `,
})
export class SipsGasInfoCardComponent {
  readonly psData        = input.required<GasSipsPs>();
  readonly onExport      = output<void>();
  readonly onComparativa = output<void>();
  readonly onClear       = output<void>();

  readonly downloadIconSrc: UiIconSource = { type: 'apolo', icon: DownloadIcon, size: 14 };
  readonly filterIconSrc:   UiIconSource = { type: 'apolo', icon: filterIcon,   size: 14 };

  readonly tarifa = computed(() => {
    const code = this.psData().codigoPeajeAtr;
    if (!code) return '—';
    return TARIFF_LABELS[code] ?? code;
  });

  /** Caudal viene en Wh/h. Convertimos a Nm3/h aproximado (factor 11.7 kWh/Nm3). */
  readonly caudalDisplay = computed(() => {
    const wh = this.psData().caudalContratadoNm3H;
    if (wh == null) return '—';
    if (wh === 0) return '0 Nm³/h (sin contrato)';
    const nm3h = wh / 1000 / 11.7;
    return `${nm3h.toFixed(2)} Nm³/h`;
  });
}
