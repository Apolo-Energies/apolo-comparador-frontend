import { ChangeDetectionStrategy, Component, ElementRef, input, model, viewChildren } from '@angular/core';

export interface TabOption { value: string; label: string; }

/** Pestañas subrayadas con navegación por flechas (WAI-ARIA tabs). */
@Component({
  selector: 'app-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="mb-5 border-b border-border">
    <div class="-mb-px flex gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]" role="tablist" [attr.aria-label]="ariaLabel()">
      @for (t of tabs(); track t.value; let i = $index) {
        <button #tab type="button" role="tab"
          [attr.aria-selected]="value() === t.value" [tabindex]="value() === t.value ? 0 : -1"
          (click)="value.set(t.value)" (keydown)="onKey($event, i)"
          class="flex-none whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150"
          [class]="value() === t.value
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'">
          {{ t.label }}
        </button>
      }
    </div>
    </div>
  `,
})
export class TabsComponent {
  readonly tabs = input.required<TabOption[]>();
  readonly value = model.required<string>();
  readonly ariaLabel = input<string | null>(null);
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tab');

  protected onKey(e: KeyboardEvent, i: number): void {
    const n = this.tabs().length;
    const next = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : -1;
    if (next < 0) return;
    e.preventDefault();
    this.value.set(this.tabs()[next].value);
    this.buttons()[next]?.nativeElement.focus();
  }
}
