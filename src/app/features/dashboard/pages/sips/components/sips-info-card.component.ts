import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '@apolo-energies/ui';
import { DownloadIcon, XIcon, filterIcon, UiIconSource } from '@apolo-energies/icons';
import { SipsPs } from '../../../../../core/models/sips.model';

function wToKw(w?: number): string {
  if (!w) return '0';
  return (w / 1000).toFixed(2);
}

@Component({
  selector: 'app-sips-info-card',
  standalone: true,
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sips-info-card.component.html',
})
export class SipsInfoCardComponent {
  readonly psData        = input.required<SipsPs>();
  readonly onExport      = output<void>();
  readonly onComparativa = output<void>();
  readonly onClear       = output<void>();

  readonly downloadIconSrc: UiIconSource = { type: 'apolo', icon: DownloadIcon, size: 14 };
  readonly filterIconSrc:   UiIconSource = { type: 'apolo', icon: filterIcon,   size: 14 };

  readonly tarifa = computed(() => this.psData().codigoTarifaATREnVigor ?? '-');
  readonly potMax = computed(() => wToKw(this.psData().potenciaMaximaBIEW));
}
