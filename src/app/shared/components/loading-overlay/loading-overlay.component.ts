import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BrandLoaderComponent } from '../brand-loader/brand-loader.component';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [BrandLoaderComponent],
  templateUrl: './loading-overlay.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlayComponent {
  readonly loading = input(false);
}
