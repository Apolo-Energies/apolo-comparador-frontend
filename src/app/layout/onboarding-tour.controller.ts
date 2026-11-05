import { HeaderActionLink, UserMenuItem } from '@apolo-energies/header';
import { OnboardingTourService } from '../shared/components/onboarding-tour/onboarding-tour.service';
import { RefreshTokenService } from '../core/services/refresh-token.service';
import { buildOnboardingTourSteps, tourSeenKey, TOUR_MENU_ITEM_ID } from './onboarding-tour-steps';

export interface OnboardingTourControllerDeps {
  tour: OnboardingTourService;
  refreshTokenService: RefreshTokenService;
  quickAction: () => HeaderActionLink | null;
}

const AUTO_START_DELAY_MS = 800;

/** Dispara el tour guiado: automático la primera vez, manual desde el menú de usuario. */
export class OnboardingTourController {
  constructor(private readonly deps: OnboardingTourControllerDeps) {}

  maybeAutoStart(): void {
    const userId = this.deps.refreshTokenService.getUserIdFromToken();
    if (!userId || localStorage.getItem(tourSeenKey(userId))) return;
    localStorage.setItem(tourSeenKey(userId), '1');
    setTimeout(() => this.start(), AUTO_START_DELAY_MS);
  }

  start(): void {
    this.deps.tour.start(buildOnboardingTourSteps({
      hasQuickAction: !!this.deps.quickAction(),
    }));
  }

  onMenuItemSelected(item: UserMenuItem): void {
    if (item.id === TOUR_MENU_ITEM_ID) this.start();
  }
}
