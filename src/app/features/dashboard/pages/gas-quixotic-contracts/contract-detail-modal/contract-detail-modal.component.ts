import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Drawer } from 'primeng/drawer';
import { AlertService } from '@apolo-energies/ui';
import {
  ApoloIcons, DateIcon, EmailIcon, FileSpreadsheetIcon, HomeIcon,
  InfoIcon, NoteIcon, UiIconSource, UserSimpleIcon, XIcon,
} from '@apolo-energies/icons';
import { QuixoticContractService } from '../../../../../core/services/quixotic-contract.service';
import { QuixoticContractDetail, QuixoticInvoice } from '../../../../../core/models/quixotic-contract.model';
import { BrandLoaderComponent } from '../../../../../shared/components/brand-loader/brand-loader.component';
import { fmtDate } from '../../contracts/contracts-utils';

const STATUS_LABELS: Record<string, string> = {
  new:                'Nuevo',
  active:             'Activo',
  cancelled:          'Cancelado',
  activation_process: 'En activación',
  completed:          'Completado',
};

// Mismo lenguaje de color que el detalle de luz: verde = vigente, azul = en curso, rojo = baja.
const STATUS_CLASSES: Record<string, string> = {
  active:             'bg-emerald-500/10 text-emerald-300',
  completed:          'bg-emerald-500/10 text-emerald-300',
  new:                'bg-blue-500/10 text-blue-300',
  activation_process: 'bg-amber-500/10 text-amber-300',
  cancelled:          'bg-red-500/10 text-red-300',
};

@Component({
  selector: 'app-quixotic-contract-detail-modal',
  standalone: true,
  imports: [CommonModule, Drawer, ApoloIcons, BrandLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contract-detail-modal.component.html',
  // Reutilizamos el estilo del panel del drawer de contratos de luz (mismo diseño).
  styleUrls: ['../../contracts/components/contract-detail-drawer/contract-detail-drawer.scss'],
})
export class QuixoticContractDetailModalComponent {
  readonly open       = input(false);
  readonly contractId = input<string | null>(null);
  readonly closed     = output<void>();

  private readonly service = inject(QuixoticContractService);
  private readonly alert   = inject(AlertService);

  readonly detail         = signal<QuixoticContractDetail | null>(null);
  readonly loadingDetail  = signal(false);
  readonly detailError    = signal(false);

  readonly invoices        = signal<QuixoticInvoice[]>([]);
  readonly loadingInvoices = signal(false);
  readonly invoicesError   = signal(false);

  readonly downloadingInvoiceId = signal<string | null>(null);

  readonly fmtDate = fmtDate;

  readonly statusLabel = computed(() => {
    const s = this.detail()?.contractStatus;
    return s ? (STATUS_LABELS[s] ?? s) : '—';
  });

  readonly statusClass = computed(() => {
    const s = this.detail()?.contractStatus;
    return (s && STATUS_CLASSES[s]) || 'bg-zinc-700/50 text-zinc-300';
  });

  readonly iconClose: UiIconSource = { type: 'apolo', icon: XIcon,              size: 16 };
  readonly iconInfo:  UiIconSource = { type: 'apolo', icon: InfoIcon,           size: 14 };
  readonly iconUser:  UiIconSource = { type: 'apolo', icon: UserSimpleIcon,     size: 14 };
  readonly iconHome:  UiIconSource = { type: 'apolo', icon: HomeIcon,           size: 14 };
  readonly iconNote:  UiIconSource = { type: 'apolo', icon: NoteIcon,           size: 14 };
  readonly iconMail:  UiIconSource = { type: 'apolo', icon: EmailIcon,          size: 14 };
  readonly iconDate:  UiIconSource = { type: 'apolo', icon: DateIcon,           size: 14 };
  readonly iconBill:  UiIconSource = { type: 'apolo', icon: FileSpreadsheetIcon, size: 14 };

  constructor() {
    effect(() => {
      const id = this.contractId();
      if (this.open() && id) {
        this.loadDetail(id);
        this.loadInvoices(id);
      }
    });
  }

  private loadDetail(id: string): void {
    this.loadingDetail.set(true);
    this.detailError.set(false);
    this.detail.set(null);
    this.service.getContractDetail(id).subscribe({
      next: d => {
        this.detail.set(d);
        this.loadingDetail.set(false);
      },
      error: () => {
        this.detailError.set(true);
        this.loadingDetail.set(false);
      },
    });
  }

  private loadInvoices(id: string): void {
    this.loadingInvoices.set(true);
    this.invoicesError.set(false);
    this.invoices.set([]);
    this.service.getInvoices(id).subscribe({
      next: rows => {
        this.invoices.set(rows ?? []);
        this.loadingInvoices.set(false);
      },
      error: () => {
        this.invoicesError.set(true);
        this.loadingInvoices.set(false);
      },
    });
  }

  telefono(d: QuixoticContractDetail): string {
    return d.customerPhoneNumber || d.customerMobileNumber || '—';
  }

  downloadInvoice(invoice: QuixoticInvoice): void {
    if (this.downloadingInvoiceId()) return;
    if (!invoice.pdfDocumentId) {
      this.alert.show('Esta factura no tiene un documento PDF disponible', 'error');
      return;
    }
    this.downloadingInvoiceId.set(invoice.id);
    this.service.getInvoiceDocument(invoice.id).subscribe({
      next: doc => {
        this.downloadingInvoiceId.set(null);
        this.triggerDownload(doc.publicUrl, doc.fileName);
      },
      error: err => {
        this.downloadingInvoiceId.set(null);
        this.alert.show(err?.error?.error ?? 'No se pudo obtener el documento de la factura', 'error');
      },
    });
  }

  // La URL S3 viene firmada con Content-Disposition: attachment, así que el navegador la descarga
  // directamente — no hace falta blob ni fetch propio.
  private triggerDownload(url: string, fileName: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  onVisibleChange(isOpen: boolean): void {
    if (!isOpen) this.closed.emit();
  }

  closeDrawer(): void {
    this.closed.emit();
  }
}
