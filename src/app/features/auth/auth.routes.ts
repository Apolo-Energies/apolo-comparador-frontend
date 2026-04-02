import { Routes } from '@angular/router';
import { LoginPageComponent, LoginSlide } from '@apolo-energies/auth';

export const slides: LoginSlide[] = [
  {
    src: '/images/login/image1.webp',
    alt: 'Descripción imagen 1',
  },
  {
    src: '/images/login/image2.webp',
    alt: 'Descripción imagen 2',
  },
  {
    src: '/images/login/image3.webp',
    alt: 'Descripción imagen 3',
  }
];


export const AUTH_ROUTES: Routes = [
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
];
