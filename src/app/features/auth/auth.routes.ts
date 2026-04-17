import { Routes } from '@angular/router';
import { LoginPageComponent, LoginSlide } from '@apolo-energies/auth';
import { AuthLayout } from './layout/auth-layout';
import { guestGuard } from '../../guards/guest.guard';

const slides: LoginSlide[] = [
  { src: '/images/login/image3.png', alt: 'Slide of Coexpal' },
];

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    component: AuthLayout,
    canActivate: [guestGuard],
    children: [
      {
        path: '',
        component: LoginPageComponent,
        data: {
          slides,
          titleLine1: 'Acceder al',
          titleLine2: 'Panel de Control',
          submitLabel: 'Iniciar Sesión',
          rememberLabel: 'Recordar contraseña',
        },
      },
    ],
  },
];
