import { ComponentRef, Injectable, inject, signal } from '@angular/core';
import { ComponentPortal } from '@angular/cdk/portal';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { OnboardingTourStepComponent } from './onboarding-tour-step.component';
import { TourStep } from './onboarding-tour.model';

// Cortos a propósito: si el ítem no existe (rol sin acceso), esperar más no lo hace aparecer.
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

function findTarget(step: TourStep): HTMLElement | null {
  if (step.selector) return document.querySelector<HTMLElement>(step.selector);
  if (step.textMatch) {
    const candidates = document.querySelectorAll<HTMLElement>(step.textMatch.tag);
    for (const el of Array.from(candidates)) {
      if (el.textContent?.trim().includes(step.textMatch.text)) return el;
    }
  }
  return null;
}

// Fallbacks estándar de CDK: abajo → arriba → a la derecha → a la izquierda del elemento.
const CONNECTED_POSITIONS: ConnectedPosition[] = [
  { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top',    offsetY: 12 },
  { originX: 'center', originY: 'top',    overlayX: 'center', overlayY: 'bottom', offsetY: -12 },
  { originX: 'end',    originY: 'center', overlayX: 'start',  overlayY: 'center', offsetX: 12 },
  { originX: 'start',  originY: 'center', overlayX: 'end',    overlayY: 'center', offsetX: -12 },
];

/**
 * Motor genérico del tour guiado. Usa el backdrop y el posicionamiento
 * `flexibleConnectedTo` propios de CDK Overlay (probados, sin trucos a mano)
 * y resalta el elemento real subiéndolo de z-index con una clase CSS global.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingTourService {
  private readonly overlay = inject(Overlay);

  private overlayRef: OverlayRef | null = null;
  private componentRef: ComponentRef<OnboardingTourStepComponent> | null = null;
  private highlightedEl: HTMLElement | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private steps: TourStep[] = [];

  readonly active = signal(false);
  readonly stepIndex = signal(0);

  start(steps: TourStep[]): void {
    if (!steps.length) return;
    this.steps = steps;
    this.stepIndex.set(0);
    this.active.set(true);
    this.showStep();
  }

  next(): void {
    if (this.stepIndex() >= this.steps.length - 1) { this.finish(); return; }
    this.stepIndex.update(i => i + 1);
    this.showStep();
  }

  prev(): void {
    if (this.stepIndex() <= 0) return;
    this.stepIndex.update(i => i - 1);
    this.showStep();
  }

  finish(): void {
    this.active.set(false);
    this.clearRetry();
    this.clearHighlight();
    this.disposeOverlay();
  }

  private showStep(retries = 0): void {
    this.clearRetry();
    this.disposeOverlay();
    this.clearHighlight();

    const step = this.steps[this.stepIndex()];
    const el = findTarget(step);

    if (!el) {
      if (retries >= MAX_RETRIES) { this.next(); return; }
      this.retryTimer = setTimeout(() => this.showStep(retries + 1), RETRY_DELAY_MS);
      return;
    }

    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('onboarding-tour-highlight');
    this.highlightedEl = el;

    this.overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      positionStrategy: this.overlay.position()
        .flexibleConnectedTo(el)
        .withPositions(CONNECTED_POSITIONS)
        .withPush(true),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });

    this.componentRef = this.overlayRef.attach(new ComponentPortal(OnboardingTourStepComponent));
    this.componentRef.setInput('step', step);
    this.componentRef.setInput('index', this.stepIndex());
    this.componentRef.setInput('total', this.steps.length);

    const i = this.componentRef.instance;
    i.nextClick.subscribe(() => this.next());
    i.prevClick.subscribe(() => this.prev());
    i.skipClick.subscribe(() => this.finish());
  }

  private clearRetry(): void {
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
  }

  private clearHighlight(): void {
    this.highlightedEl?.classList.remove('onboarding-tour-highlight');
    this.highlightedEl = null;
  }

  private disposeOverlay(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.componentRef = null;
  }
}
