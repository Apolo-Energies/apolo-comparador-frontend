import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AlertComponent, AlertService, ButtonComponent, DialogComponent, InputFieldComponent } from '@apolo-energies/ui';
import { LandingService } from '../../../../services/landing.service';
import { LandingSummary } from '../../../../entities/landing.model';
import { LandingFormDialogComponent } from './landing-form-dialog';

@Component({
  selector: 'app-landings-page',
  standalone: true,
  imports: [AlertComponent, ButtonComponent, DialogComponent, InputFieldComponent, LandingFormDialogComponent],
  templateUrl: './landings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingsPageComponent {
  private readonly landingService = inject(LandingService);
  private readonly alert          = inject(AlertService);
  private readonly platformId     = inject(PLATFORM_ID);

  readonly search       = signal('');
  readonly onlyActive   = signal(false);
  readonly currentPage  = signal(1);
  readonly pageSize     = signal(20);
  readonly totalCount   = signal(0);
  readonly loading      = signal(false);
  readonly data         = signal<LandingSummary[]>([]);

  readonly totalPages   = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  readonly deleteOpen   = signal(false);
  readonly deleteTarget = signal<LandingSummary | null>(null);
  readonly deleting     = signal(false);

  readonly formOpen      = signal(false);
  readonly formLandingId = signal<string | null>(null);

  readonly copiedSlug = signal<string | null>(null);

  copyUrl(slug: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = `${window.location.origin}/${slug}`;
    navigator.clipboard?.writeText(url).then(() => {
      this.copiedSlug.set(slug);
      setTimeout(() => {
        if (this.copiedSlug() === slug) this.copiedSlug.set(null);
      }, 2000);
    }).catch(() => {
      this.alert.show('No se pudo copiar al portapapeles.', 'error', 3000);
    });
  }

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.landingService.list({
      page:     this.currentPage(),
      pageSize: this.pageSize(),
      search:   this.search().trim() || undefined,
      isActive: this.onlyActive() ? true : undefined,
    }).subscribe({
      next: res => {
        this.data.set(res.items);
        this.totalCount.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.alert.show('No se pudo cargar el listado de landings.', 'error', 4000);
      },
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.load();
  }

  toggleOnlyActive(): void {
    this.onlyActive.update(v => !v);
    this.currentPage.set(1);
    this.load();
  }

  openCreate(): void {
    this.formLandingId.set(null);
    this.formOpen.set(true);
  }

  openEdit(id: string): void {
    this.formLandingId.set(id);
    this.formOpen.set(true);
  }

  onFormOpenChange(open: boolean): void {
    this.formOpen.set(open);
    if (!open) this.formLandingId.set(null);
  }

  onFormSaved(): void {
    this.load();
  }

  openPublic(slug: string): void {
    if (isPlatformBrowser(this.platformId)) {
      window.open(`/${slug}`, '_blank');
    }
  }

  askDelete(row: LandingSummary): void {
    this.deleteTarget.set(row);
    this.deleteOpen.set(true);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleting.set(true);
    this.landingService.delete(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteOpen.set(false);
        this.deleteTarget.set(null);
        this.alert.show('Landing desactivada.', 'success', 3000);
        this.load();
      },
      error: () => {
        this.deleting.set(false);
        this.alert.show('No se pudo desactivar la landing.', 'error', 4000);
      },
    });
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.load();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.load();
    }
  }
}
