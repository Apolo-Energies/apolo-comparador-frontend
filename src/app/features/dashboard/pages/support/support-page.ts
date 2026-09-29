import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { InputFieldComponent } from '@apolo-energies/ui';
import { ApoloIcons, chevronDownIcon, InfoIcon, SearchIcon, XIcon, UiIconSource } from '@apolo-energies/icons';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, LucideAngularModule, X } from 'lucide-angular';
import { environment } from '../../../../../environments/environment';
import { ProviderService } from '../../../../core/services/provider.service';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';
import { SupportTopic, SUPPORT_TOPICS, SUPPORT_FAQS, WHATSAPP_NUMBERS, TARIFF_PROVIDER_ID, youtubeThumbnail } from './support-page.helpers';
import { TariffPreviewController } from './tariff-preview.controller';

@Component({
  selector: 'app-support-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support-page.html',
  styleUrl: './support-page.scss',
  imports: [ApoloIcons, InputFieldComponent, BrandLoaderComponent, LucideAngularModule],
})
export class SupportPageComponent {
  private sanitizer       = inject(DomSanitizer);
  private providerService = inject(ProviderService);

  readonly topics     = SUPPORT_TOPICS;
  readonly faqs       = SUPPORT_FAQS;
  readonly infoIcon:   UiIconSource = { type: 'apolo', icon: InfoIcon,         size: 12 };
  readonly closeIcon:  UiIconSource = { type: 'apolo', icon: XIcon,            size: 14 };
  readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon,       size: 16 };
  readonly chevronIcon: UiIconSource = { type: 'apolo', icon: chevronDownIcon, size: 16 };
  readonly chevronLeftIcon  = ChevronLeft;
  readonly chevronRightIcon = ChevronRight;
  readonly reelPrevIcon     = ChevronUp;
  readonly reelNextIcon     = ChevronDown;
  readonly closeReelIcon    = X;

  @ViewChild('videoScroller') private videoScroller?: ElementRef<HTMLElement>;

  readonly searchQuery = signal('');
  readonly openFaqIndex = signal<number | null>(0);

  readonly filteredCardTopics = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.topics;
    return this.topics.filter(t => t.title.toLowerCase().includes(q) || t.tag.toLowerCase().includes(q));
  });

  readonly filteredFaqs = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.faqs;
    return this.faqs.filter(f => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
  });

  toggleFaq(index: number): void {
    this.openFaqIndex.update(current => current === index ? null : index);
  }

  isFaqOpen(index: number): boolean {
    return this.openFaqIndex() === index;
  }

  readonly isApolo     = environment.clientName === 'apolo';
  readonly whatsappUrl = `https://wa.me/${WHATSAPP_NUMBERS[environment.clientName] ?? ''}`;

  /** 'home' = Estado A (buscador + cards + FAQ); si no, key del topic abierto (Estado B). */
  readonly activeTab        = signal('home');
  readonly selected          = signal<SupportTopic | null>(null);
  readonly currentVideoIndex = signal(0);
  readonly expanded          = signal(false);
  readonly reelOpen          = signal(false);
  private touchStartY?: number;

  // "Tarifas De Luz" Excel/PDF preview flow (state + handlers live in the
  // controller; R1).
  private readonly tariffPreview = new TariffPreviewController({
    providerService: this.providerService,
    sanitizer:       this.sanitizer,
  });
  readonly previewLoading = this.tariffPreview.previewLoading;
  readonly previewError   = this.tariffPreview.previewError;
  readonly pdfUrl         = this.tariffPreview.pdfUrl;

  readonly totalVideos = computed(() => this.selected()?.videos?.length ?? 0);

  readonly currentVideo = computed(() => {
    const topic = this.selected();
    if (!topic?.videos) return null;
    return topic.videos[this.currentVideoIndex()] ?? null;
  });

  safeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  thumbnail(url: string): string {
    return youtubeThumbnail(url);
  }

  selectTopic(topic: SupportTopic): void {
    this.tariffPreview.revoke();
    this.tariffPreview.clearError();
    this.activeTab.set(topic.key);
    this.selected.set(topic);
    this.currentVideoIndex.set(0);
    this.expanded.set(false);
    if (topic.excelPreview) {
      this.tariffPreview.load(TARIFF_PROVIDER_ID);
    }
    const main = document.querySelector('main');
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goHome(): void {
    this.tariffPreview.revoke();
    this.activeTab.set('home');
    this.selected.set(null);
    this.currentVideoIndex.set(0);
    this.expanded.set(false);
    this.tariffPreview.clearError();
    this.tariffPreview.clearExcelBlob();
  }

  toggleExpand(): void {
    this.expanded.update(v => !v);
  }

  isActiveTab(key: string): boolean {
    return this.activeTab() === key;
  }

  scrollVideos(direction: number): void {
    this.videoScroller?.nativeElement.scrollBy({ left: direction * 320, behavior: 'smooth' });
  }

  openReel(index: number): void {
    this.currentVideoIndex.set(index);
    this.reelOpen.set(true);
  }

  closeReel(): void {
    this.reelOpen.set(false);
  }

  nextReel(): void {
    const total = this.totalVideos();
    if (total === 0) return;
    this.currentVideoIndex.update(i => (i + 1) % total);
  }

  prevReel(): void {
    const total = this.totalVideos();
    if (total === 0) return;
    this.currentVideoIndex.update(i => (i - 1 + total) % total);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.reelOpen()) this.closeReel();
  }

  onReelTouchStart(event: TouchEvent): void {
    this.touchStartY = event.touches[0]?.clientY;
  }

  onReelTouchEnd(event: TouchEvent): void {
    if (this.touchStartY === undefined) return;
    const deltaY = event.changedTouches[0]?.clientY - this.touchStartY;
    this.touchStartY = undefined;
    if (Math.abs(deltaY) < 50) return;
    if (deltaY < 0) this.nextReel(); else this.prevReel();
  }

  downloadExcel(): void {
    this.tariffPreview.downloadExcel();
  }
}
