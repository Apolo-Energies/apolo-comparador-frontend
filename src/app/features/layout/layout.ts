import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ApoloSidebar, SidebarChildItem, SidebarSection } from '@apolo-energies/sidebar';
import { ApoloHeader, HeaderWelcomeContent, HeaderActionLink, UserMenuItem } from '@apolo-energies/header';
import { AuthService } from '@apolo-energies/auth';
import { ArrowDownBoxIcon, chevronDownIcon, chevronRightIcon, CircleIcon, CompassIcon, HomeIcon,InfoIcon, LogoutIcon, NoteIcon, PieIcon, SettingsIcon, StarIcon, SupportIcon, UiIconSource, UserIcon } from '@apolo-energies/icons';
import { getUserRoles } from '../../utils/auth.utils';
import { environment } from '../../../environments/environment';
import { RefreshTokenService } from '../../services/refresh-token.service';
import { OpportunityService } from '../../services/opportunity.service';
import { OpportunityStatus } from '../../entities/opportunity.model';
import { EnergyType } from '../../entities/energy-type.enum';
import { GlobalLoadingService } from '../../services/global-loading.service';
import { BrandLoaderComponent } from '../../shared/components/brand-loader/brand-loader.component';

const COLABORADOR_PERMISSIONS = [
  'comparator:view',
  'sips:view',
  'markets:view',
  'settings:view',
  'settings.colaborador:view',
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  'Colaborador':                 COLABORADOR_PERMISSIONS,
  'Colaborador - Referenciador': COLABORADOR_PERMISSIONS,
  'Referenciador': ['comparator:view', 'sips:view', 'markets:view'],
  'Tester':        ['comparator:view', 'sips:view', 'markets:view'],
  'Comercial':     ['comparator:view'],
};

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

  /** Pending opportunities por tipo. El parent muestra la suma (Luz + Gas)
      via un data-attribute inyectado por JS (ver markOpportunitiesParent). */
  readonly opportunitiesCountLuz = signal<number>(0);
  readonly opportunitiesCountGas = signal<number>(0);

  /** Titulo del parent en el sidebar — usado para matchear el boton via querySelector. */
  private static readonly OPP_PARENT_TITLE = 'Oportunidades';

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (environment.features.opportunities) {
      this.refreshOpportunitiesCount();
      afterNextRender(() => this.setupOpportunitiesParentMarker());
    }
    effect(() => {
      const luz = this.opportunitiesCountLuz();
      const gas = this.opportunitiesCountGas();
      this.setCssCount('--opp-count-luz', luz);
      this.setCssCount('--opp-count-gas', gas);
      this.setCssCount('--opp-count',     luz + gas);
    });
  }

  /**
   * Marca el boton del parent "Oportunidades" con data-opp-parent="true" para que la
   * regla CSS del badge total lo pueda seleccionar. Necesario porque el sidebar lib no
   * envuelve al parent en un <a href>, asi que no hay forma de selectorlo solo con CSS.
   *
   * El sidebar puede no estar en el DOM al primer afterNextRender (auth resolving,
   * lazy render, etc), por eso reintentamos hasta encontrar la raiz y entonces montamos
   * el MutationObserver que re-aplica el marker cuando sections() re-renderea.
   */
  private setupOpportunitiesParentMarker(): void {
    this.markOpportunitiesParent();
    this.attachSidebarObserver(0);
  }

  private attachSidebarObserver(attempt: number): void {
    const sidebarRoot = document.querySelector('lib-apolo-sidebar');
    if (!sidebarRoot) {
      if (attempt < 60) { // ~1s a 60fps; si no esta para entonces, sidebar no se montara
        requestAnimationFrame(() => this.attachSidebarObserver(attempt + 1));
      }
      return;
    }
    this.markOpportunitiesParent();
    const observer = new MutationObserver(() => this.markOpportunitiesParent());
    observer.observe(sidebarRoot, { childList: true, subtree: true });
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private markOpportunitiesParent(): void {
    const items = document.querySelectorAll<HTMLElement>('lib-apolo-sidebar lib-sidebar-item');
    for (const item of Array.from(items)) {
      // Match por texto del title. Si renombramos el item en sidebar, actualizar OPP_PARENT_TITLE.
      const titleSpan = item.querySelector(':scope > button > div > span');
      if (titleSpan?.textContent?.trim() !== Layout.OPP_PARENT_TITLE) continue;
      const btn = item.querySelector('button');
      if (btn && !btn.hasAttribute('data-opp-parent')) {
        btn.setAttribute('data-opp-parent', 'true');
      }
    }
  }

  private setCssCount(name: string, value: number): void {
    if (value > 0) document.documentElement.style.setProperty(name, `"${value}"`);
    else document.documentElement.style.removeProperty(name);
  }

  private refreshOpportunitiesCount(): void {
    this.oppService.list({ pageSize: 1, status: OpportunityStatus.Pending, energyType: EnergyType.Electricity }).subscribe({
      next: res => this.opportunitiesCountLuz.set(res.totalCount),
      error: () => { },
    });
    this.oppService.list({ pageSize: 1, status: OpportunityStatus.Pending, energyType: EnergyType.Gas }).subscribe({
      next: res => this.opportunitiesCountGas.set(res.totalCount),
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
    const isColaborador = (roles.includes('Colaborador') || roles.includes('Colaborador - Referenciador')) && !roles.includes('Master');
    const isApolo       = environment.features.userDetail;
    const userId        = this.refreshTokenService.getUserIdFromToken();
    const isSubUser     = !!this.refreshTokenService.getParentUserIdFromToken();

    const ajustesChildren: SidebarChildItem[] = isColaborador && isApolo
      ? [
          { title: 'Comerciales', url: '/dashboard/settings/my-comercials',       access: ['settings.colaborador:view'] },
          { title: 'Comisiones',    url: '/dashboard/settings/sub-user-commissions', access: ['settings.colaborador:view'] },
        ]
      : [
          { title: 'Usuarios',   url: '/dashboard/settings/users',      access: ['settings.users:view'] },
          { title: 'Comisión',   url: '/dashboard/settings/commission', access: ['settings.commission:view'] },
          { title: 'Plantillas', url: '/dashboard/templates',           access: ['templates:view'] },
          { title: 'Tarifas',    url: '/dashboard/tariffs',             access: ['support:view'] },
        ];

    const sections: SidebarSection[] = [
      {
        section: 'GENERAL',
        items: [
          {
            title: 'Analítica',
            icon: { type: 'apolo', icon: PieIcon, size: 20 },
            access: ['analytics:view'],
            children: [
              { title: 'Historial · Luz',    url: '/dashboard/analytics/history',        access: ['analytics.history:view'] },
              { title: 'Historial · Gas',    url: '/dashboard/analytics/history/gas',    access: ['analytics.history:view'] },
              { title: 'Estadísticas · Luz', url: '/dashboard/analytics/statistics',     access: ['analytics.statistics:view'] },
              { title: 'Estadísticas · Gas', url: '/dashboard/analytics/statistics/gas', access: ['analytics.statistics:view'] },
              { title: 'Reportes · Luz',     url: '/dashboard/analytics/reports',        access: ['analytics.statistics:view'] },
              { title: 'Reportes · Gas',     url: '/dashboard/analytics/reports/gas',    access: ['analytics.statistics:view'] },
            ],
          },
          // TODO: habilitar Contratos cuando esté listo (solo Apolo)
          // ...(isApolo && environment.features.contracts ? [{
          //   title: 'Contratos',
          //   icon: { type: 'apolo' as const, icon: NoteIcon, size: 20 },
          //   access: ['analytics:view'],
          //   children: [
          //     { title: 'Contratos', url: '/dashboard/contratos/contratos', access: ['analytics.history:view'] },
          //     { title: 'Servicios', url: '/dashboard/contratos/servicios', access: ['analytics.history:view'] },
          //   ],
          // }] : []),
          ...(environment.features.opportunities ? [{
            title: 'Oportunidades',
            icon: { type: 'apolo' as const, icon: StarIcon, size: 20 },
            access: ['opportunities:view'],
            children: [
              { title: 'Luz', url: '/dashboard/analytics/opportunities/luz', access: ['opportunities:view'] },
              { title: 'Gas', url: '/dashboard/analytics/opportunities/gas', access: ['opportunities:view'] },
            ],
          }] : []),
          {
            title: 'Comparador',
            icon: { type: 'apolo', icon: ArrowDownBoxIcon, size: 20 },
            access: ['comparator:view'],
            children: [
              { title: 'Luz', url: '/dashboard/comparator',     access: ['comparator:view'] },
              { title: 'Gas', url: '/dashboard/comparator/gas', access: ['comparator:view'] },
            ],
          },
          {
            title: 'Consultas SIPS',
            icon: { type: 'apolo', icon: CompassIcon, size: 20 },
            access: ['sips:view'],
            children: [
              { title: 'Luz', url: '/dashboard/sips',     access: ['sips:view'] },
              { title: 'Gas', url: '/dashboard/sips/gas', access: ['sips:view'] },
            ],
          },
          ...(environment.features.markets ? [{
            title: 'Mercados',
            icon: { type: 'apolo' as const, icon: PieIcon, size: 20 },
            url: '/dashboard/markets',
            access: ['markets:view'],
          }] : []),
          {
            title: 'Landings personalizadas',
            icon: { type: 'apolo' as const, icon: HomeIcon,size: 20 },
            url: '/dashboard/landings',
            access: ['analytics:view'],
          },
          {
            title: 'Gas regulatorio',
            icon: { type: 'apolo' as const, icon: NoteIcon, size: 20 },
            access: ['analytics:view'],
            children: [
              { title: 'Tramos de acceso', url: '/dashboard/gas/access-tariffs',    access: ['analytics:view'] },
              { title: 'Parámetros',       url: '/dashboard/gas/regulatory-params', access: ['analytics:view'] },
            ],
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

    if (isApolo && userId && !isSubUser) {
      sections.push({
        section: '',
        items: [{
          title: 'Mi Perfil',
          icon: { type: 'apolo', icon: UserIcon, size: 20 },
          url: `/dashboard/settings/users/${userId}`,
        }],
      });
    } else if (!isApolo) {
      // Merge SOPORTE items into GENERAL so the sidebar library doesn't pin SOPORTE to the bottom
      const soporteIdx = sections.findIndex(s => s.section === 'SOPORTE');
      if (soporteIdx >= 0) {
        sections[0].items = [...sections[0].items, ...sections[soporteIdx].items];
        sections.splice(soporteIdx, 1);
      }
    }

    return sections;
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
