import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonComponent } from '@apolo-energies/ui';
import { ApoloIcons, chevronRightIcon, InfoIcon, XIcon, UiIconSource } from '@apolo-energies/icons';
import { environment } from '../../../../../environments/environment';

interface CrmVideo {
  title:       string;
  description: string;
  url:         string;
}

interface SupportTopic {
  title:     string;
  tag:       string;
  tagCls:    string;
  dotCls:    string;
  available: boolean;
  url?:      string;
  videos?:   CrmVideo[];
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
    title:     'Tarifas De Luz',
    tag:       'Guía de tarifas eléctricas',
    tagCls:    'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/20',
    dotCls:    'bg-indigo-400',
    available: true,
    url:       'https://www.youtube.com/embed/',
  },
  {
    title:     'Tarifas De Gas',
    tag:       'Guía de tarifas de gas',
    tagCls:    'bg-pink-500/15 text-pink-400 ring-1 ring-pink-500/20',
    dotCls:    'bg-pink-400',
    available: true,
    url:       'https://www.youtube.com/embed/',
  },
  {
    title:     'Comparador',
    tag:       'Cómo usar el comparador',
    tagCls:    'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/20',
    dotCls:    'bg-purple-400',
    available: true,
    url:       'https://www.youtube.com/embed/',
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

// TODO: reemplazar con los números reales (formato: código país + número, sin + ni espacios)
const WHATSAPP_NUMBERS: Record<string, string> = {
  renova:  'PENDIENTE_RENOVAE',
  coexpal: 'PENDIENTE_COEXPAL',
};

@Component({
  selector: 'app-support-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support-page.html',
  imports: [ApoloIcons, ButtonComponent],
})
export class SupportPageComponent {
  private sanitizer = inject(DomSanitizer);

  readonly topics     = TOPICS;
  readonly infoIcon:  UiIconSource = { type: 'apolo', icon: InfoIcon,        size: 12 };
  readonly arrowIcon: UiIconSource = { type: 'apolo', icon: chevronRightIcon, size: 14 };
  readonly closeIcon: UiIconSource = { type: 'apolo', icon: XIcon,            size: 14 };
  readonly chevronIcon: UiIconSource = { type: 'apolo', icon: chevronRightIcon, size: 18 };

  readonly isApolo     = environment.clientName === 'apolo';
  readonly whatsappUrl = `https://wa.me/${WHATSAPP_NUMBERS[environment.clientName] ?? ''}`;

  readonly selected          = signal<SupportTopic | null>(null);
  readonly currentVideoIndex = signal(0);

  readonly currentVideo = computed(() => {
    const topic = this.selected();
    if (!topic?.videos) return null;
    return topic.videos[this.currentVideoIndex()] ?? null;
  });

  readonly totalVideos   = computed(() => this.selected()?.videos?.length ?? 0);
  readonly videoIndices  = computed(() => Array.from({ length: this.totalVideos() }, (_, i) => i));
  readonly hasPrev     = computed(() => this.currentVideoIndex() > 0);
  readonly hasNext     = computed(() => this.currentVideoIndex() < this.totalVideos() - 1);

  safeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  open(topic: SupportTopic): void {
    this.selected.set(topic);
    this.currentVideoIndex.set(0);
    const main = document.querySelector('main');
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
  }

  close(): void {
    this.selected.set(null);
    this.currentVideoIndex.set(0);
  }

  prev(): void {
    if (this.hasPrev()) this.currentVideoIndex.update(i => i - 1);
  }

  next(): void {
    if (this.hasNext()) this.currentVideoIndex.update(i => i + 1);
  }

  goTo(index: number): void {
    this.currentVideoIndex.set(index);
  }
}
