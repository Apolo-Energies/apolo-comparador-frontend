import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { EMPTY, catchError } from 'rxjs';
import { LandingService } from '../../services/landing.service';
import { PublicLanding } from '../../entities/landing.model';

export const brandedLandingResolver: ResolveFn<PublicLanding> = (route) => {
  const slug = route.paramMap.get('slug');
  const router = inject(Router);
  if (!slug) {
    router.navigateByUrl('/');
    return EMPTY;
  }
  return inject(LandingService).getBySlug(slug).pipe(
    catchError(() => {
      router.navigateByUrl('/');
      return EMPTY;
    }),
  );
};
