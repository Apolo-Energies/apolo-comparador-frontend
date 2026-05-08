import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonComponent } from '@apolo-energies/ui';
import { ApoloIcons, chevronRightIcon, InfoIcon, XIcon, UiIconSource } from '@apolo-energies/icons';

interface SupportTopic {
  title:     string;
  tag:       string;
  tagCls:    string;
  dotCls:    string;
  available: boolean;
  url?:      string;
}

const TOPICS: SupportTopic[] = [
  {
    title:     'CRM',
    tag:       'Aprende a usar el CRM y todo su potencial',
    tagCls:    'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20',
    dotCls:    'bg-blue-400',
    available: true,
    url:       'https://apoloenergies777.sharepoint.com/sites/Colaboradores/_layouts/15/embed.aspx?UniqueId=ce68d886-91e7-4b50-9e1e-246b318a39da&embed=%7B%22ust%22%3Atrue%2C%22hv%22%3A%22CopyEmbedCode%22%7D&referrer=StreamWebApp&referrerScenario=EmbedDialog.Create',
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

@Component({
  selector: 'app-support-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support-page.html',
  imports: [ApoloIcons, ButtonComponent],
})
export class SupportPageComponent {
  private sanitizer = inject(DomSanitizer);

  readonly topics      = TOPICS;
  readonly infoIcon:  UiIconSource = { type: 'apolo', icon: InfoIcon,        size: 12 };
  readonly arrowIcon: UiIconSource = { type: 'apolo', icon: chevronRightIcon, size: 14 };
  readonly closeIcon: UiIconSource = { type: 'apolo', icon: XIcon,            size: 14 };

readonly selected = signal<SupportTopic | null>(null);

  safeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  open(topic: SupportTopic): void {
    this.selected.set(topic);
    const main = document.querySelector('main');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  close(): void {
    this.selected.set(null);
  }
}
