import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '@apolo-energies/ui';
import { DownloadIcon, filterIcon, UiIconSource } from '@apolo-energies/icons';
import { GasSipsPs } from '../../../../../core/models/gas-sips.model';

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
  templateUrl: './sips-gas-info-card.component.html',
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
