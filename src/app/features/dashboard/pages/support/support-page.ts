import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonComponent } from '@apolo-energies/ui';
import { ApoloIcons, chevronRightIcon, InfoIcon, XIcon, UiIconSource } from '@apolo-energies/icons';
import { environment } from '../../../../../environments/environment';
import { ProviderService } from '../../../../core/services/provider.service';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';
import { SupportTopic, SUPPORT_TOPICS, WHATSAPP_NUMBERS, TARIFF_PROVIDER_ID, youtubeThumbnail } from './support-page.helpers';
import { TariffPreviewController } from './tariff-preview.controller';

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

  readonly topics     = SUPPORT_TOPICS;
  readonly infoIcon:  UiIconSource = { type: 'apolo', icon: InfoIcon,        size: 12 };
  readonly arrowIcon: UiIconSource = { type: 'apolo', icon: chevronRightIcon, size: 14 };
  readonly closeIcon: UiIconSource = { type: 'apolo', icon: XIcon,            size: 14 };

  readonly isApolo     = environment.clientName === 'apolo';
  readonly whatsappUrl = `https://wa.me/${WHATSAPP_NUMBERS[environment.clientName] ?? ''}`;

  readonly selected          = signal<SupportTopic | null>(null);
  readonly currentVideoIndex = signal(0);
  readonly expanded          = signal(false);

  // "Tarifas De Luz" Excel/PDF preview flow (state + handlers live in the
  // controller; R1).
  private readonly tariffPreview = new TariffPreviewController({
    providerService: this.providerService,
    sanitizer:       this.sanitizer,
  });
  readonly previewLoading = this.tariffPreview.previewLoading;
  readonly previewError   = this.tariffPreview.previewError;
  readonly pdfUrl         = this.tariffPreview.pdfUrl;

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
    return youtubeThumbnail(url);
  }

  open(topic: SupportTopic): void {
    this.tariffPreview.revoke();
    this.tariffPreview.clearError();
    this.selected.set(topic);
    this.currentVideoIndex.set(0);
    this.expanded.set(false);
    if (topic.excelPreview) {
      this.tariffPreview.load(TARIFF_PROVIDER_ID);
    }
    const main = document.querySelector('main');
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
  }

  close(): void {
    this.tariffPreview.revoke();
    this.selected.set(null);
    this.currentVideoIndex.set(0);
    this.expanded.set(false);
    this.tariffPreview.clearError();
    this.tariffPreview.clearExcelBlob();
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
    this.tariffPreview.downloadExcel();
  }
}
