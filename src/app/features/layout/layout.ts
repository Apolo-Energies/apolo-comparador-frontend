import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ApoloSidebar, SidebarSection } from '@apolo-energies/sidebar';
import { ApoloHeader, HeaderWelcomeContent, HeaderActionLink, UserMenuItem } from '@apolo-energies/header';
import { AuthService } from '@apolo-energies/auth';
import { ArrowDownBoxIcon, chevronDownIcon, chevronRightIcon, CircleIcon, CompassIcon, InfoIcon, ListIcon, LogoutIcon, PieIcon, SettingsIcon, StarIcon, SupportIcon, UiIconSource, UserIcon, UserSimpleIcon } from '@apolo-energies/icons';
import { getUserRoles } from '../../utils/auth.utils';
import { environment } from '../../../environments/environment';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  'Colaborador': [
    'contracts:view',
    'comparator:view',
    'sips:view',
    'settings:view',
    'settings.users:view',
    'settings.commission:view',
    'settings.rates:view',
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

  readonly currentUrl = toSignal(
    this.router.events.pipe(map(() => this.router.url)),
    { initialValue: this.router.url }
  );

  readonly mobileOpen = signal(false);

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

  readonly sections: SidebarSection[] = [
    {
      section: 'GENERAL',
      items: [
        {
          title: 'Contratos',
          icon: {
            type: 'apolo',
            icon: ListIcon,
            size: 20,
          },
          url: '/projects',
          access: ['contracts:view'],
        },
        {
          title: 'Analítica',
          icon: {
            type: 'apolo',
            icon: PieIcon,
            size: 20,
          },
          access: ['analytics:view'],
          children: [
            {
              title: 'Historial',
              url: '/dashboard/analytics/history',
              access: ['analytics.history:view'],
            },
            {
              title: 'Estadísticas',
              url: '/dashboard/analytics/statistics',
              access: ['analytics.statistics:view'],
            },
          ],
        },
        {
          title: 'Comparador',
          icon: {
            type: 'apolo',
            icon: ArrowDownBoxIcon,
            size: 20,
          },
          url: '/dashboard/comparator',
          access: ['comparator:view'],
        },
        {
          title: 'Consultas SIPS',
          icon: {
            type: 'apolo',
            icon: CompassIcon,
            size: 20,
          },
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
          icon: {
            type: 'apolo',
            icon: SettingsIcon,
            size: 20,
          },
          access: ['settings:view'],
          children: [
            {
              title: 'Usuarios',
              url: '/dashboard/settings/users',
              access: ['settings.users:view'],
            },
            {
              title: 'Comisión',
              url: '/dashboard/settings/commission',
              access: ['settings.commission:view'],
            },
            {
              title: 'Tarifas',
              url: '/dashboard/settings/rates',
              access: ['settings.rates:view'],
            },
          ],
        },
        {
          title: 'Soporte',
          icon: {
            type: 'apolo',
            icon: SupportIcon,
            size: 20,
          },
          url: '/dashboard/support',
          access: ['support:view'],
        },
      ],
    },
  ];

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

  readonly quickAction = signal<HeaderActionLink>({
    label: 'Alta Rápida',
    type: 'external',
    url: 'https://ee.apoloenergies.es/App/',
    icon: {
      type: 'apolo',
      icon: StarIcon,
      className: 'text-current',
      size: 14,
      strokeWidth: 0.2
    },
    target: '_blank',
  });

  readonly menuItems: UserMenuItem[] = [
    { id: 'logout', label: 'Cerrar sesión',  icon: {
        type: 'apolo',
        icon: LogoutIcon,
        className: 'text-red-600',
        size: 20,
      }, type: 'action', danger: true },
  ];

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
    this.auth.signOut();
  }
}
