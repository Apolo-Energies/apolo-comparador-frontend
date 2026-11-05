import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '@apolo-energies/ui';
import { TourStep } from './onboarding-tour.model';

@Component({
  selector: 'app-onboarding-tour-step',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding-tour-step.component.html',
})
export class OnboardingTourStepComponent {
  readonly step  = input.required<TourStep>();
  readonly index = input.required<number>();
  readonly total = input.required<number>();

  readonly nextClick = output<void>();
  readonly prevClick = output<void>();
  readonly skipClick = output<void>();

  get isFirst(): boolean { return this.index() === 0; }
  get isLast(): boolean { return this.index() === this.total() - 1; }
  get progressPct(): number { return ((this.index() + 1) / this.total()) * 100; }
}
