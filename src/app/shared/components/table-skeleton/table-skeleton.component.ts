import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-table-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="animate-pulse w-full" role="status" aria-label="Cargando…">
      <!-- Header row -->
      <div class="flex gap-4 px-4 py-3 border-b border-border bg-card/50">
        @for (col of colRange(); track $index) {
          <div class="h-3 rounded-full bg-muted flex-1" [style.max-width]="headerWidths[$index % headerWidths.length]"></div>
        }
      </div>
      <!-- Data rows -->
      @for (row of rowRange(); track $index) {
        <div
          class="flex gap-4 px-4 py-3.5 border-b border-border/60"
          [class.bg-card]="$index % 2 === 0"
          [class.bg-card/40]="$index % 2 !== 0"
        >
          @for (col of colRange(); track $index) {
            <div class="h-3 rounded-full bg-muted/70 flex-1" [style.max-width]="cellWidths[$index % cellWidths.length]"></div>
          }
        </div>
      }
    </div>
  `,
})
export class TableSkeletonComponent {
  readonly cols = input<number>(4);
  readonly rows = input<number>(8);

  readonly headerWidths = ['60%', '80%', '50%', '70%', '40%', '65%', '55%', '75%', '45%', '60%', '30%'];
  readonly cellWidths   = ['75%', '55%', '85%', '45%', '65%', '35%', '70%', '50%', '80%', '40%', '60%'];

  colRange(): number[] { return Array.from({ length: this.cols() }); }
  rowRange(): number[] { return Array.from({ length: this.rows() }); }
}
