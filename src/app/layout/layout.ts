import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ApoloSidebar, SidebarSection } from '@apolo-energies/sidebar';
import { ApoloHeader, HeaderWelcomeContent, HeaderActionLink, UserMenuItem } from '@apolo-energies/header';
import { AuthService } from '@apolo-energies/auth';
import { chevronDownIcon, chevronRightIcon, CircleIcon, CompassIcon, InfoIcon, LogoutIcon, StarIcon, UiIconSource, UserIcon } from '@apolo-energies/icons';
import { getUserRoles } from '../core/helpers/auth.utils';
import { environment } from '../../environments/environment';
import { RefreshTokenService } from '../core/services/refresh-token.service';
import { OpportunityCountsStore } from '../core/services/opportunity-counts.store';
import { GlobalLoadingService } from '../core/services/global-loading.service';
import { BrandModulesService } from '../core/services/brand-modules.service';
import { BrandLoaderComponent } from '../shared/components/brand-loader/brand-loader.component';
import { CollaboratorScopeSelectorComponent } from '../shared/components/collaborator-scope-selector/collaborator-scope-selector';
import { buildSidebarSections, hasAccess } from './layout.helpers';
import { OpportunitiesBadgeController } from './opportunities-badge.controller';
import { BrandThemeController } from './brand-theme.controller';
import { OnboardingTourService } from '../shared/components/onboarding-tour/onboarding-tour.service';
import { OnboardingTourController } from './onboarding-tour.controller';
import { TOUR_MENU_ITEM_ID } from './onboarding-tour-steps';

/** SVG vacío (transparente) — placeholder de logoSrc mientras se resuelve la marca del colaborador. */
const TRANSPARENT_LOGO_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, ApoloSidebar, ApoloHeader, BrandLoaderComponent, CollaboratorScopeSelectorComponent],
  templateUrl: './layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Layout {
  private auth = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private refreshTokenService = inject(RefreshTokenService);
  private countsStore = inject(OpportunityCountsStore);
  private brandModules = inject(BrandModulesService);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);
  private tour = inject(OnboardingTourService);
  readonly globalLoading = inject(GlobalLoadingService);

  readonly isApolo = environment.features.userDetail;

  readonly currentUrl = toSignal(
    this.router.events.pipe(map(() => this.router.url)),
    { initialValue: this.router.url }
  );

  readonly mobileOpen    = signal(false);
  readonly loggingOut    = signal(false);

  // Pending opportunities por tipo (Luz/Gas) + marcador DOM del badge en el
  // sidebar. Estado y llamadas al servicio viven en el controller (R1); no se
  // exponen signals porque el template no los usa directamente (solo afectan
  // custom properties CSS via el effect() de abajo).
  private readonly oppBadge = new OpportunitiesBadgeController({
    countsStore: this.countsStore,
    auth: this.auth,
    router: this.router,
    destroyRef: this.destroyRef,
  });

  // Si el colaborador pertenece a una marca blanca, reemplaza el logo del
  // header/sidebar y el favicon de la pestaña por los de esa marca.
  private readonly brandTheme = new BrandThemeController({
    brandModules: this.brandModules,
  });

  private readonly tourController = new OnboardingTourController({
    tour: this.tour,
    refreshTokenService: this.refreshTokenService,
    quickAction: () => this.quickAction(),
  });

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.brandTheme.load();
    if (environment.features.opportunities) {
      this.oppBadge.refresh();
      afterNextRender(() => this.oppBadge.setupDomMarker());
    }
    effect(() => {
      const luz = this.oppBadge.luzCount();
      const gas = this.oppBadge.gasCount();
      this.setCssCount('--opp-count-luz', luz);
      this.setCssCount('--opp-count-gas', gas);
      this.setCssCount('--opp-count',     luz + gas);
    });
    afterNextRender(() => this.tourController.maybeAutoStart());
  }

  onMenuItemSelected(item: UserMenuItem): void {
    this.tourController.onMenuItemSelected(item);
  }

  private setCssCount(name: string, value: number): void {
    if (value > 0) document.documentElement.style.setProperty(name, `"${value}"`);
    else document.documentElement.style.removeProperty(name);
  }

  // Mientras se resuelve si el colaborador tiene marca blanca asignada, se
  // muestra un SVG vacío en vez del logo del tenant — evita el flash del
  // logo de Apolo para colaboradores de marca blanca.
  readonly logoSrc = computed(() => {
    if (this.brandTheme.loading()) return TRANSPARENT_LOGO_PLACEHOLDER;
    return this.brandTheme.logoUrl() ?? environment.logoUrl;
  });

  readonly userMenuIcon = {
    type: 'apolo' as const,
    icon: UserIcon,
    className: 'text-muted-foreground',
    size: 20,
  };

  readonly childIcon: UiIconSource = {
    type: 'apolo',
    icon: CircleIcon,
    size: 20,
  };

  readonly expandIcon: UiIconSource = {
    type: 'apolo',
    icon: chevronRightIcon,
    size: 16,
  };

  readonly collapseIcon: UiIconSource = {
    type: 'apolo',
    icon: chevronDownIcon,
    size: 16,
  };

  readonly sections = computed<SidebarSection[]>(() => buildSidebarSections({
    roles: getUserRoles(this.auth.currentUser()),
    isApolo: this.isApolo,
    userId: this.refreshTokenService.getUserIdFromToken(),
    isSubUser: !!this.refreshTokenService.getParentUserIdFromToken(),
    // Lee el signal de módulos de la marca: el menú se recalcula cuando termina de cargar.
    brandAllows: code => this.brandModules.brandAllows(code),
  }));

  readonly welcome: HeaderWelcomeContent = {
    title: 'Bienvenido al portal de colaboradores de Apolo Energies.',
    subtitle: 'Tu panel de control para gestionar clientes, analizar consumos y acceder a insights clave del mercado energético.',
    icon: {
      type: 'apolo',
      icon: InfoIcon,
      size: 20,
      className: 'text-primary-button',
      strokeWidth: 0.2,
    },
  };

  // Lleva al selector de tipo (Luz/Gas) — ver fast-discharge/pages/select-type.
  readonly quickAction = computed<HeaderActionLink | null>(() =>
    this.brandModules.isEnabled('quickAction') ? {
      label: 'Alta Rápida',
      type: 'internal',
      url: '/dashboard/fast-discharge/select-type',
      icon: { type: 'apolo', icon: StarIcon, className: 'text-current', size: 14, strokeWidth: 0.2 },
    } : null
  );

  readonly menuItems = computed<UserMenuItem[]>(() => {
    const items: UserMenuItem[] = [];

    const userId       = this.refreshTokenService.getUserIdFromToken();
    const isSubUser    = !!this.refreshTokenService.getParentUserIdFromToken();

    if (this.brandModules.isEnabled('userDetail') && userId && !isSubUser) {
      items.push({
        id: 'profile',
        label: 'Mi Perfil',
        icon: { type: 'apolo', icon: UserIcon, size: 20 },
        type: 'internal',
        url: `/dashboard/settings/users/${userId}`,
      });
    }

    items.push({
      id: TOUR_MENU_ITEM_ID,
      label: 'Ver tour guiado',
      icon: { type: 'apolo', icon: CompassIcon, size: 20 },
      type: 'action',
    });

    items.push({
      id: 'logout',
      label: 'Cerrar sesión',
      icon: { type: 'apolo', icon: LogoutIcon, className: 'text-red-600', size: 20 },
      type: 'action',
      danger: true,
    });

    return items;
  });

  readonly logoutSidebarIcon: UiIconSource = {
    type: 'apolo',
    icon: LogoutIcon,
    className: 'text-red-500',
    size: 22,
  };

  readonly accessFn = (access?: string[]): boolean =>
    hasAccess(access, getUserRoles(this.auth.currentUser()));

  onLogout() {
    this.loggingOut.set(true);

    const userId       = this.refreshTokenService.getUserIdFromToken();
    const refreshToken = this.refreshTokenService.getRefreshToken();

    const finish = () => {
      this.refreshTokenService.clear();
      this.auth.signOut();
    };

    if (userId && refreshToken) {
      this.http
        .post(`${environment.apiUrl}/auth/logout`, { userId, refreshToken })
        .subscribe({ next: finish, error: finish });
    } else {
      finish();
    }
  }
}
