import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonComponent } from '@apolo-energies/ui';
import { ApoloIcons, chevronRightIcon, InfoIcon, XIcon, UiIconSource } from '@apolo-energies/icons';
import { environment } from '../../../../../environments/environment';
import { ProviderService } from '../../../../services/provider.service';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';

interface CrmVideo {
  title:       string;
  description: string;
  url:         string;
}

interface SupportTopic {
  title:         string;
  tag:           string;
  tagCls:        string;
  dotCls:        string;
  available:     boolean;
  videos?:       CrmVideo[];
  excelPreview?: true;
}

const CRM_VIDEOS: CrmVideo[] = [
  {
    title:       'Presentación e inicio',
    description: 'Introducción al CRM de Apolo Energies: primeros pasos y navegación general.',
    url:         'https://www.youtube.com/embed/Mh1siN7Im2E',
  },
  {
    title:       'Autofactura',
    description: 'Aprende a gestionar el módulo de autofactura dentro del CRM.',
    url:         'https://www.youtube.com/embed/Kut9_pvgjQA',
  },
  {
    title:       'Carga Rápida',
    description: 'Cómo utilizar la función de carga rápida para agilizar el alta de nuevos clientes.',
    url:         'https://www.youtube.com/embed/HrmmFwVe4zk',
  },
  {
    title:       'Contratos',
    description: 'Gestión y seguimiento de contratos desde el CRM.',
    url:         'https://www.youtube.com/embed/2JYBpzvodJ0',
  },
  {
    title:       'Delegación',
    description: 'Cómo funciona el módulo de delegación y asignación de clientes.',
    url:         'https://www.youtube.com/embed/jRrH7MmV6zY',
  },
  {
    title:       'Facturas',
    description: 'Consulta y gestión de facturas desde el panel del CRM.',
    url:         'https://www.youtube.com/embed/X_Czq_GzT-k',
  },
];

const TOPICS: SupportTopic[] = [
  {
    title:     'CRM',
    tag:       'Aprende a usar el CRM y todo su potencial',
    tagCls:    'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20',
    dotCls:    'bg-blue-400',
    available: true,
    videos:    CRM_VIDEOS,
  },
  {
    title:        'Tarifas De Luz',
    tag:          'Guía de tarifas eléctricas',
    tagCls:       'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/20',
    dotCls:       'bg-indigo-400',
    available:    true,
    excelPreview: true,
  },
  {
    title:     'Tarifas De Gas',
    tag:       'Guía de tarifas de gas',
    tagCls:    'bg-pink-500/15 text-pink-400 ring-1 ring-pink-500/20',
    dotCls:    'bg-pink-400',
    available: true,
    videos: [
      {
        title:       'Tarifas De Gas',
        description: 'Guía de tarifas de gas.',
        url:         'https://www.youtube.com/embed/',
      },
    ],
  },
  {
    title:     'Comparador',
    tag:       'Cómo usar el comparador',
    tagCls:    'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/20',
    dotCls:    'bg-purple-400',
    available: true,
    videos: [
      {
        title:       'Comparador',
        description: 'Cómo usar el comparador.',
        url:         'https://www.youtube.com/embed/',
      },
    ],
  },
  {
    title:     'Proceso de Firma',
    tag:       'Próximamente',
    tagCls:    'bg-muted text-muted-foreground ring-1 ring-border',
    dotCls:    'bg-muted-foreground',
    available: false,
  },
  {
    title:     'Postventa y Soporte',
    tag:       'Próximamente',
    tagCls:    'bg-muted text-muted-foreground ring-1 ring-border',
    dotCls:    'bg-muted-foreground',
    available: false,
  },
  {
    title:     'Comunidad Apolo',
    tag:       'Próximamente',
    tagCls:    'bg-muted text-muted-foreground ring-1 ring-border',
    dotCls:    'bg-muted-foreground',
    available: false,
  },
];

const WHATSAPP_NUMBERS: Record<string, string> = {
  renova:  'PENDIENTE_RENOVAE',
  coexpal: 'PENDIENTE_COEXPAL',
};

const TARIFF_PROVIDER_ID = 1;

@Component({
  selector: 'app-support-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support-page.html',
  imports: [ApoloIcons, ButtonComponent, BrandLoaderComponent],
})
export class SupportPageComponent {
  private sanitizer       = inject(DomSanitizer);
  private providerService = inject(ProviderService);

  readonly topics     = TOPICS;
  readonly infoIcon:  UiIconSource = { type: 'apolo', icon: InfoIcon,        size: 12 };
  readonly arrowIcon: UiIconSource = { type: 'apolo', icon: chevronRightIcon, size: 14 };
  readonly closeIcon: UiIconSource = { type: 'apolo', icon: XIcon,            size: 14 };

  readonly isApolo     = environment.clientName === 'apolo';
  readonly whatsappUrl = `https://wa.me/${WHATSAPP_NUMBERS[environment.clientName] ?? ''}`;

  readonly selected          = signal<SupportTopic | null>(null);
  readonly currentVideoIndex = signal(0);
  readonly expanded          = signal(false);

  readonly previewLoading = signal(false);
  readonly previewError   = signal<string | null>(null);
  readonly pdfUrl         = signal<SafeResourceUrl | null>(null);

  private excelBlob: Blob | null = null;
  private pdfObjectUrl: string | null = null;

  readonly currentVideo = computed(() => {
    const topic = this.selected();
    if (!topic?.videos) return null;
    return topic.videos[this.currentVideoIndex()] ?? null;
  });

  readonly totalVideos = computed(() => this.selected()?.videos?.length ?? 0);

  safeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  thumbnail(url: string): string {
    const id = url.split('/').pop()?.split('?')[0] ?? '';
    return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  }

  open(topic: SupportTopic): void {
    this.revokePdfUrl();
    this.previewError.set(null);
    this.selected.set(topic);
    this.currentVideoIndex.set(0);
    this.expanded.set(false);
    if (topic.excelPreview) {
      this.loadTariffPreview();
    }
    const main = document.querySelector('main');
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
  }

  close(): void {
    this.revokePdfUrl();
    this.selected.set(null);
    this.currentVideoIndex.set(0);
    this.expanded.set(false);
    this.previewError.set(null);
    this.excelBlob = null;
  }

  toggleExpand(): void {
    this.expanded.update(v => !v);
  }

  toggle(topic: SupportTopic): void {
    if (this.selected()?.title === topic.title) {
      this.close();
    } else {
      this.open(topic);
    }
  }

  isOpen(topic: SupportTopic): boolean {
    return this.selected()?.title === topic.title;
  }

  selectVideo(index: number): void {
    this.currentVideoIndex.set(index);
  }

  downloadExcel(): void {
    if (!this.excelBlob) return;
    const url = URL.createObjectURL(this.excelBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tarifarios-luz.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  private loadTariffPreview(): void {
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.excelBlob = null;

    // PDF for inline preview
    this.providerService.downloadTariffPdf(TARIFF_PROVIDER_ID).subscribe({
      next: pdfBlob => {
        const url = URL.createObjectURL(pdfBlob);
        this.pdfObjectUrl = url;
        this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
        this.previewLoading.set(false);
      },
      error: err => {
        console.error('Tariff PDF preview error:', err);
        this.previewError.set('No se pudo cargar la vista previa.');
        this.previewLoading.set(false);
      },
    });

    // Excel blob in parallel for the download button (doesn't gate the loader)
    this.providerService.downloadExcel(TARIFF_PROVIDER_ID).subscribe({
      next: blob => { this.excelBlob = blob; },
      error: err => { console.warn('Excel prefetch failed:', err); },
    });
  }

  private revokePdfUrl(): void {
    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
      this.pdfObjectUrl = null;
    }
    this.pdfUrl.set(null);
  }
}
