import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-table-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table-skeleton.component.html',
})
export class TableSkeletonComponent {
  readonly cols = input<number>(4);
  readonly rows = input<number>(8);

  readonly headerWidths = ['60%', '80%', '50%', '70%', '40%', '65%', '55%', '75%', '45%', '60%', '30%'];
  readonly cellWidths   = ['75%', '55%', '85%', '45%', '65%', '35%', '70%', '50%', '80%', '40%', '60%'];

  colRange(): number[] { return Array.from({ length: this.cols() }); }
  rowRange(): number[] { return Array.from({ length: this.rows() }); }
}
