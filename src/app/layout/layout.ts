import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ApoloSidebar, SidebarSection } from '@apolo-energies/sidebar';
import { ApoloHeader, HeaderWelcomeContent, HeaderActionLink, UserMenuItem } from '@apolo-energies/header';
import { AuthService } from '@apolo-energies/auth';
import { chevronDownIcon, chevronRightIcon, CircleIcon, InfoIcon, LightningIcon, LogoutIcon, NoteIcon, StarIcon, UiIconSource, UserIcon } from '@apolo-energies/icons';
import { getUserRoles } from '../core/helpers/auth.utils';
import { environment } from '../../environments/environment';
import { RefreshTokenService } from '../core/services/refresh-token.service';
import { OpportunityService } from '../core/services/opportunity.service';
import { GlobalLoadingService } from '../core/services/global-loading.service';
import { BrandLoaderComponent } from '../shared/components/brand-loader/brand-loader.component';
import { buildSidebarSections, hasAccess } from './layout.helpers';
import { OpportunitiesBadgeController } from './opportunities-badge.controller';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, ApoloSidebar, ApoloHeader, BrandLoaderComponent],
  templateUrl: './layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Layout {
  private auth = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private refreshTokenService = inject(RefreshTokenService);
  private oppService = inject(OpportunityService);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);
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
    oppService: this.oppService,
    auth: this.auth,
    destroyRef: this.destroyRef,
  });

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
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
  }

  private setCssCount(name: string, value: number): void {
    if (value > 0) document.documentElement.style.setProperty(name, `"${value}"`);
    else document.documentElement.style.removeProperty(name);
  }

  readonly logoSrc = environment.logoUrl;

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

  readonly quickAction = signal<HeaderActionLink | null>(
    environment.features.quickAction ? {
      label: 'Alta Rápida',
      type: 'internal',
      url: '/dashboard/fast-discharge',
      icon: { type: 'apolo', icon: StarIcon, className: 'text-current', size: 14, strokeWidth: 0.2 },
    } : null
  );

  // Dropdown de "Alta Rápida": Luz sigue al flujo de siempre; Gas va al wizard
  // de alta rápida Quixotic (ver gas-quixotic-contracts/alta-rapida).
  readonly quickActionItems = signal<HeaderActionLink[] | null>(
    environment.features.quickAction ? [
      {
        label: 'Luz',
        type: 'internal',
        url: '/dashboard/fast-discharge/data',
        icon: { type: 'apolo', icon: LightningIcon, size: 16 },
      },
      {
        label: 'Gas',
        type: 'internal',
        url: '/dashboard/gas/quixotic-contracts/new',
        icon: { type: 'apolo', icon: NoteIcon, size: 16 },
      },
    ] : null
  );

  onQuickActionItemSelected(_item: HeaderActionLink): void {
    // Hook para analítica si se necesita más adelante.
  }

  readonly menuItems = computed<UserMenuItem[]>(() => {
    const items: UserMenuItem[] = [];

    const userId       = this.refreshTokenService.getUserIdFromToken();
    const isSubUser    = !!this.refreshTokenService.getParentUserIdFromToken();

    if (environment.features.userDetail && userId && !isSubUser) {
      items.push({
        id: 'profile',
        label: 'Mi Perfil',
        icon: { type: 'apolo', icon: UserIcon, size: 20 },
        type: 'internal',
        url: `/dashboard/settings/users/${userId}`,
      });
    }

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
