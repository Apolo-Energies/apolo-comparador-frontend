import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Provider } from '../../../../../../core/models/provider.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-provider-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './provider-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderTabComponent {
  readonly provider = input.required<Provider>();
}
