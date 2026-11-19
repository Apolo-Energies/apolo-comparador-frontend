import { afterEveryRender, afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, PLATFORM_ID, signal, untracked, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router, RouterLink, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ApoloSidebar } from '@apolo-energies/sidebar';
import { ApoloHeader, HeaderWelcomeContent, HeaderActionLink, UserMenuItem } from '@apolo-energies/header';
import { AuthService } from '@apolo-energies/auth';
import { chevronDownIcon, chevronRightIcon, CircleIcon, CompassIcon, InfoIcon, LogoutIcon, StarIcon, UiIconSource, UserIcon } from '@apolo-energies/icons';
import { environment } from '../../environments/environment';
import { RefreshTokenService } from '../core/services/refresh-token.service';
import { OpportunityCountsStore } from '../core/services/opportunity-counts.store';
import { GlobalLoadingService } from '../core/services/global-loading.service';
import { BrandModulesService } from '../core/services/brand-modules.service';
import { BrandLoaderComponent } from '../shared/components/brand-loader/brand-loader.component';
import { CollaboratorScopeSelectorComponent } from '../shared/components/collaborator-scope-selector/collaborator-scope-selector';
import { NavSectionsService } from './nav-sections.service';
import { buildCrumbs } from './breadcrumbs';
import { ThemeService } from '../core/services/theme.service';
import { OpportunitiesBadgeController } from './opportunities-badge.controller';
import { BrandThemeController } from './brand-theme.controller';
import { OnboardingTourService } from '../shared/components/onboarding-tour/onboarding-tour.service';
import { OnboardingTourController } from './onboarding-tour.controller';
import { TOUR_MENU_ITEM_ID } from './onboarding-tour-steps';

/** SVG vacío (transparente) — placeholder de logoSrc mientras se resuelve la marca del colaborador. */
const TRANSPARENT_LOGO_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, ApoloSidebar, ApoloHeader, BrandLoaderComponent, CollaboratorScopeSelectorComponent],
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
  private nav = inject(NavSectionsService);
  readonly theme = inject(ThemeService);

  readonly isApolo = environment.features.userDetail;

  /** Escudo de los loaders del layout según el tema: negro sobre blanco, blanco sobre negro. */
  readonly loaderLogoUrl = computed(() => this.theme.isDark() ? '/apolo/isotipo_blanco.svg' : '/apolo/Isotipo_Oscuro.svg');

  readonly currentUrl = toSignal(
    this.router.events.pipe(map(() => this.router.url)),
    { initialValue: this.router.url }
  );

  readonly mobileOpen    = signal(false);
  readonly loggingOut    = signal(false);

  // ── Menú lateral fuera de pantalla ──────────
  // En escritorio el sidebar del paquete se desplaza fuera de la vista y se abre
  // desde el borde izquierdo (hover) o con el botón "Menú". En móvil se sigue
  // usando el drawer propio del paquete (isMobileOpen).
  readonly menuOpen = signal(false);
  private openedByHover = false;
  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly menuPanel  = viewChild<ElementRef<HTMLElement>>('menuPanel');
  private readonly themeSwitch = viewChild<ElementRef<HTMLButtonElement>>('themeSwitch');
  private readonly themeFallback = viewChild<ElementRef<HTMLElement>>('themeFallback');
  readonly isDesktop = signal(true);
  readonly canHover  = signal(true);
  /** Migas de pan: se recalculan con la URL. */
  readonly crumbs = computed(() =>
    buildCrumbs(this.currentUrl(), this.refreshTokenService.getUserIdFromToken()?.toString() ?? null,
      environment.features.userDetail && this.brandModules.brandAllows('comparator')));

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
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => { this.closeMenu(false); this.mobileOpen.set(false); });

    if (!isPlatformBrowser(this.platformId)) return;

    // Tema del portal: clase en <body> para que modales, drawers y overlays
    // (fuera del layout) también la hereden. Se retiran al salir, así el login sigue como estaba.
    effect(() => {
      const dark = this.theme.isDark();
      document.body.classList.toggle('portal-dark', dark);
      document.body.classList.toggle('portal-light', !dark);
    });
    this.theme.portalActive.set(true);
    this.destroyRef.onDestroy(() => {
      document.body.classList.remove('portal-light', 'portal-dark', 'logo-invert');
      // Clases puestas por index.html antes de arrancar: fuera del portal no aplican.
      document.documentElement.classList.remove('portal-boot-light', 'portal-boot-dark');
      this.theme.portalActive.set(false);
    });
    effect(() => {
      const tenantLogo = !this.brandTheme.logoUrl();
      document.body.classList.toggle('logo-invert', tenantLogo && environment.invertLogoOnLight && !this.theme.isDark());
    });

    const desktopMq = window.matchMedia('(min-width: 768px)');
    const hoverMq   = window.matchMedia('(hover: hover) and (pointer: fine)');
    this.isDesktop.set(desktopMq.matches);
    this.canHover.set(hoverMq.matches);
    const onDesktop = (e: MediaQueryListEvent) => this.isDesktop.set(e.matches);
    const onHover   = (e: MediaQueryListEvent) => this.canHover.set(e.matches);
    desktopMq.addEventListener('change', onDesktop);
    hoverMq.addEventListener('change', onHover);
    this.destroyRef.onDestroy(() => {
      desktopMq.removeEventListener('change', onDesktop);
      hoverMq.removeEventListener('change', onHover);
    });
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
    // Tour guiado: sus pasos señalan ítems del menú, así que lo abre mientras dura.
    // Solo depende de tour.active(): el resto va en untracked para no cerrar
    // el menú cada vez que el usuario lo abre.
    let wasActive = false;
    effect(() => {
      const active = this.tour.active();
      untracked(() => {
        if (active) { this.openedByHover = false; this.menuOpen.set(true); }
        else if (wasActive) this.closeMenu(false);
        wasActive = active;
      });
    });
    // El Inicio muestra el mismo logo (tenant o marca blanca) que resuelve el layout.
    effect(() => this.nav.logoSrc.set(this.brandTheme.loading() ? null : this.logoSrc()));
    afterNextRender(() => this.tourController.maybeAutoStart());
    // En cada render (no solo el primero): si la cabecera se vuelve a pintar (recarga en
    // caliente, cambio de marca…) el selector de tema vuelve a su sitio en vez de desaparecer.
    afterEveryRender({ write: () => this.moveThemeSwitch() });
  }

  /** La cabecera es de un paquete sin hueco para contenido propio: el selector de tema se
   *  inserta al principio de su grupo derecho (antes de "Alta Rápida" y del menú de usuario).
   *  Angular sigue gestionando el botón (bindings y click) aunque cambie de padre. */
  private moveThemeSwitch(): void {
    const sw = this.themeSwitch()?.nativeElement;
    // Si una versión nueva del paquete cambia su estructura, el selector queda en la barra
    // de "Menú" en vez de desaparecer.
    const group = document.querySelector('lib-apolo-header header > div > div.shrink-0') ?? this.themeFallback()?.nativeElement;
    if (!sw || !group) return;
    if (sw.parentElement !== group) group.insertBefore(sw, group.firstChild);
    sw.classList.add('is-placed');
  }

  /** Botón "Menú": en escritorio abre el panel; en móvil, el drawer del paquete. */
  toggleMenu(): void {
    if (!this.isDesktop()) { this.mobileOpen.update(v => !v); return; }
    if (this.menuOpen()) { this.closeMenu(); return; }
    this.openedByHover = false;
    this.menuOpen.set(true);
    // Lleva el foco al primer enlace del menú cuando ya es visible.
    setTimeout(() => this.menuPanel()?.nativeElement.querySelector<HTMLElement>('a[href], button')?.focus(), 0);
  }

  openFromEdge(): void {
    if (this.menuOpen() || !this.canHover()) return;
    this.openedByHover = true;
    this.menuOpen.set(true);
  }

  onMenuLeave(): void {
    if (this.openedByHover) this.closeMenu(false);
  }

  closeMenu(restoreFocus = true): void {
    if (!this.menuOpen() || this.tour.active()) return;
    const byKeyboard = !this.openedByHover;
    this.menuOpen.set(false);
    this.openedByHover = false;
    if (restoreFocus && byKeyboard) this.menuButton()?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (!this.tour.active()) this.closeMenu(); }

  readonly tourActive = computed(() => this.tour.active());

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
    const tenantLogo = this.theme.isDark() ? environment.logoUrl : (environment.logoOnLightUrl ?? environment.logoUrl);
    return this.brandTheme.logoUrl() ?? tenantLogo;
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

  readonly sections = this.nav.sections;

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

  readonly accessFn = this.nav.accessFn;

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
