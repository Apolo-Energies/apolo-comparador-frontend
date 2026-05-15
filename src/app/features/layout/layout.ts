import { ChangeDetectionStrategy, Component, computed, effect, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ApoloSidebar, SidebarChildItem, SidebarSection } from '@apolo-energies/sidebar';
import { ApoloHeader, HeaderWelcomeContent, HeaderActionLink, UserMenuItem } from '@apolo-energies/header';
import { AuthService } from '@apolo-energies/auth';
import { ArrowDownBoxIcon, chevronDownIcon, chevronRightIcon, CircleIcon, CompassIcon, InfoIcon, LogoutIcon, PieIcon, SettingsIcon, StarIcon, SupportIcon, UiIconSource, UserIcon } from '@apolo-energies/icons';
import { getUserRoles } from '../../utils/auth.utils';
import { environment } from '../../../environments/environment';
import { RefreshTokenService } from '../../services/refresh-token.service';
import { OpportunityService } from '../../services/opportunity.service';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  'Colaborador': [
    'comparator:view',
    'sips:view',
    'settings:view',
    'settings.colaborador:view',
  ],
  'Referenciador': ['comparator:view', 'sips:view'],
  'Tester':        ['comparator:view', 'sips:view'],
};

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, ApoloSidebar, ApoloHeader],
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

  readonly currentUrl = toSignal(
    this.router.events.pipe(map(() => this.router.url)),
    { initialValue: this.router.url }
  );

  readonly mobileOpen = signal(false);

  /** Total opportunities — refreshed on init and on every route change. */
  readonly opportunitiesCount = signal<number>(0);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (environment.features.opportunities) {
      this.refreshOpportunitiesCount();
    }
    effect(() => {
      const count = this.opportunitiesCount();
      if (count > 0) {
        document.documentElement.style.setProperty('--opp-count', `"${count}"`);
      } else {
        document.documentElement.style.removeProperty('--opp-count');
      }
    });
  }

  private refreshOpportunitiesCount(): void {
    this.oppService.list({ pageSize: 1 }).subscribe({
      next: res => this.opportunitiesCount.set(res.totalCount),
      error: () => { },
    });
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
  readonly sections = computed<SidebarSection[]>(() => this.buildSections());

  private buildSections(): SidebarSection[] {
    const roles         = getUserRoles(this.auth.currentUser());
    const isColaborador = roles.includes('Colaborador') && !roles.includes('Master');
    const isApolo       = environment.features.userDetail;

    const ajustesChildren: SidebarChildItem[] = isColaborador && isApolo
      ? [
          { title: 'Comerciales', url: '/dashboard/settings/my-comercials',       access: ['settings.colaborador:view'] },
          { title: 'Commissions',    url: '/dashboard/settings/sub-user-commissions', access: ['settings.colaborador:view'] },
        ]
      : [
          { title: 'Usuarios', url: '/dashboard/settings/users',      access: ['settings.users:view'] },
          { title: 'Comisión', url: '/dashboard/settings/commission', access: ['settings.commission:view'] },
          { title: 'Tarifas', url: '/dashboard/tariffs', access: ['support:view'] },
        ];

    return [
      {
        section: 'GENERAL',
        items: [
          {
            title: 'Analítica',
            icon: { type: 'apolo', icon: PieIcon, size: 20 },
            access: ['analytics:view'],
            children: [
              { title: 'Historial',    url: '/dashboard/analytics/history',    access: ['analytics.history:view'] },
              { title: 'Estadísticas', url: '/dashboard/analytics/statistics', access: ['analytics.statistics:view'] },
            ],
          },
          ...(environment.features.opportunities ? [{
            title: 'Oportunidades',
            icon: { type: 'apolo' as const, icon: StarIcon, size: 20 },
            url: '/dashboard/analytics/opportunities',
            access: ['opportunities:view'],
          }] : []),
          {
            title: 'Comparador',
            icon: { type: 'apolo', icon: ArrowDownBoxIcon, size: 20 },
            url: '/dashboard/comparator',
            access: ['comparator:view'],
          },
          {
            title: 'Consultas SIPS',
            icon: { type: 'apolo', icon: CompassIcon, size: 20 },
            url: '/dashboard/sips',
            access: ['sips:view'],
          },
        ],
      },
      {
        section: 'SOPORTE',
        items: [
          {
            title: 'Ajustes',
            icon: { type: 'apolo', icon: SettingsIcon, size: 20 },
            access: ['settings:view'],
            children: ajustesChildren,
          },
          {
            title: 'Soporte',
            icon: { type: 'apolo', icon: SupportIcon, size: 20 },
            url: '/dashboard/support',
            access: ['support:view'],
          }
        ],
      },
    ];
  }

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

  readonly accessFn = (access?: string[]): boolean => {
    if (!access || access.length === 0) return true;
    const roles = getUserRoles(this.auth.currentUser());
    if (roles.includes('Master')) return true;
    const granted = roles.flatMap(r => ROLE_PERMISSIONS[r] ?? []);
    return access.some(key => granted.includes(key));
  };

  onLogout() {
    const userId = this.refreshTokenService.getUserIdFromToken();
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
