import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, computed,
  effect, inject, input, output, signal,
} from '@angular/core';
import { Drawer } from 'primeng/drawer';
import { BrandLoaderComponent } from '../../../../../../shared/components/brand-loader/brand-loader.component';
import { MessageService } from 'primeng/api';
import {
  ApoloIcons, DateIcon, FileDownIcon, NoteIcon, SettingsIcon,
  UiIconSource, UserSimpleIcon, XIcon,
} from '@apolo-energies/icons';
import {
  ComparisonHistoryRow, OpportunityDetail, OpportunityStatus,
  OPPORTUNITY_ALLOWED_TRANSITIONS, OPPORTUNITY_STATUS_LABEL,
} from '../../../../../../entities/opportunity.model';
import { OpportunityService } from '../../../../../../services/opportunity.service';

@Component({
  selector: 'app-opportunity-detail-drawer',
  standalone: true,
  imports: [Drawer, ApoloIcons, BrandLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './opportunity-detail-drawer.html',
  styleUrl: './opportunity-detail-drawer.scss',
})
export class OpportunityDetailDrawerComponent {
  /** Selected opportunity id (null = drawer hidden). */
  readonly opportunityId = input<string | null>(null);

  /** Notify parent that the drawer should close. */
  readonly closed = output<void>();

  /** Notify parent that the underlying opportunity changed (for board refresh). */
  readonly opportunityUpdated = output<void>();

  private oppService = inject(OpportunityService);
  private cdr        = inject(ChangeDetectorRef);
  private toast      = inject(MessageService);

  readonly visible      = signal(false);
  readonly detail       = signal<OpportunityDetail | null>(null);
  readonly loading      = signal(false);
  readonly downloadingId = signal<string | null>(null);
  readonly statusMenuOpen = signal(false);
  readonly savingStatus   = signal(false);

  // ── icons ────────────────────────────────────────────────────────────────
  readonly iconClose: UiIconSource = { type: 'apolo', icon: XIcon,           size: 16 };
  readonly iconDate:  UiIconSource = { type: 'apolo', icon: DateIcon,        size: 14 };
  readonly iconUser:  UiIconSource = { type: 'apolo', icon: UserSimpleIcon,  size: 14 };
  readonly iconPdf:   UiIconSource = { type: 'apolo', icon: FileDownIcon,    size: 14 };
  readonly iconCfg:   UiIconSource = { type: 'apolo', icon: SettingsIcon,    size: 14 };
  readonly iconNote:  UiIconSource = { type: 'apolo', icon: NoteIcon,        size: 14 };

  constructor() {
    // Sync visibility with input id.
    effect(() => {
      const id = this.opportunityId();
      if (id) {
        this.visible.set(true);
        this.load(id);
      } else {
        this.visible.set(false);
        this.detail.set(null);
      }
    });
  }

  readonly summary = computed(() => this.detail()?.summary ?? null);
  readonly comparisons = computed(() => this.detail()?.comparisons ?? []);

  readonly statusLabel = computed(() => {
    const s = this.summary()?.status;
    return s ? OPPORTUNITY_STATUS_LABEL[s] : '';
  });

  readonly statusBadgeClass = computed(() => {
    const s = this.summary()?.status;
    if (s === undefined || s === null) return 'bg-zinc-700/40 text-zinc-300 ring-zinc-600/40';
    switch (s) {
      case OpportunityStatus.Pending:     return 'bg-blue-500/10    text-blue-400    ring-blue-500/20';
      case OpportunityStatus.Negotiation: return 'bg-amber-500/10   text-amber-400   ring-amber-500/20';
      case OpportunityStatus.Won:         return 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20';
      case OpportunityStatus.Lost:        return 'bg-rose-500/10    text-rose-400    ring-rose-500/20';
    }
  });

  readonly addressText = computed(() => {
    const c = this.summary()?.client;
    if (!c) return '—';
    const parts = [c.address, c.postalCode, c.province].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  });

  readonly availableTransitions = computed(() => {
    const s = this.summary()?.status;
    if (!s) return [];
    return (OPPORTUNITY_ALLOWED_TRANSITIONS[s] ?? []).map(target => ({
      target,
      label: OPPORTUNITY_STATUS_LABEL[target],
    }));
  });

  // ── lifecycle ────────────────────────────────────────────────────────────

  private load(id: string) {
    this.loading.set(true);
    this.oppService.getById(id, 1, 50).subscribe({
      next: data => {
        this.detail.set(data);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.loading.set(false); this.cdr.markForCheck(); },
    });
  }


  onVisibleChange(open: boolean) {
    if (!open) this.closed.emit();
  }

  closeDrawer() {
    this.closed.emit();
  }

  toggleStatusMenu() { this.statusMenuOpen.update(v => !v); }

  applyStatus(target: OpportunityStatus) {
    const id = this.opportunityId();
    if (!id) return;
    this.savingStatus.set(true);
    this.oppService.updateStatus(id, target).subscribe({
      next: updated => {
        const cur = this.detail();
        if (cur) this.detail.set({ ...cur, summary: updated });
        this.savingStatus.set(false);
        this.statusMenuOpen.set(false);
        this.opportunityUpdated.emit();
        this.toast.add({
          severity: 'success',
          summary:  'Estado actualizado',
          detail:   `La oportunidad ahora está en ${OPPORTUNITY_STATUS_LABEL[target]}.`,
          life:     3000,
        });
        this.cdr.markForCheck();
      },
      error: err => {
        this.savingStatus.set(false);
        this.toast.add({
          severity: 'error',
          summary:  'No se pudo cambiar el estado',
          detail:   err?.error?.message ?? 'Inténtalo de nuevo.',
          life:     4500,
        });
        this.cdr.markForCheck();
      },
    });
  }

  onDownloadPdf(row: ComparisonHistoryRow) {
    if (!row.hasPdfSnapshot) return;
    this.downloadingId.set(row.id);
    this.oppService.downloadComparisonPdf(row.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Comparacion_${row.id}.pdf`; a.click();
        URL.revokeObjectURL(url);
        this.downloadingId.set(null);
        this.cdr.markForCheck();
      },
      error: () => {
        this.downloadingId.set(null);
        this.toast.add({
          severity: 'error',
          summary:  'No se pudo descargar el PDF',
          detail:   'Inténtalo de nuevo o vuelve a generar la comparación.',
          life:     4500,
        });
        this.cdr.markForCheck();
      },
    });
  }


  formatDate(iso: string): string {
    return new Date(iso)
      .toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      .replace('.', '');
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  formatNumber(value: number | null | undefined, digits = 2): string {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: digits });
  }

  formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return `${value.toFixed(1)}%`;
  }

  trackById = (_: number, row: ComparisonHistoryRow) => row.id;
}
