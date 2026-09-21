import { signal } from '@angular/core';
import { ProductRow } from './products-tab.helpers';

/**
 * Owns the product detail ("view") dialog, including the copy-to-clipboard
 * affordance for individual period values (P1-P6). Extracted from
 * ProductsTabComponent to keep it under the file-size guideline (R1).
 *
 * No behavior change — this flow was recently added (DecimalPipe formatting
 * + copy-to-clipboard + `break-all text-center` in the template) to fix a
 * text-overflow bug in the detail modal and must keep working exactly as-is.
 */
export class ProductViewController {
  readonly viewDialog   = signal(false);
  readonly viewRow      = signal<ProductRow | null>(null);
  readonly copiedPeriod = signal<string | null>(null);

  openView(row: ProductRow): void {
    this.viewRow.set(row);
    this.viewDialog.set(true);
  }

  copyPeriodValue(key: string, value: number): void {
    navigator.clipboard.writeText(String(value)).then(() => {
      this.copiedPeriod.set(key);
      setTimeout(() => {
        if (this.copiedPeriod() === key) this.copiedPeriod.set(null);
      }, 2000);
    });
  }
}
