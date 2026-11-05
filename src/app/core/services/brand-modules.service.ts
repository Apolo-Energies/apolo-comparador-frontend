import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { AuthService } from '@apolo-energies/auth';
import { BrandService } from './brand.service';
import { UserService } from './user.service';
import { BrandConfig } from '../models/brand.model';
import { environment } from '../../../environments/environment';

/**
 * Marca blanca del usuario logueado y sus módulos habilitados (los que se
 * configuran en Marcas Blancas → Módulos). Una sola carga por usuario,
 * compartida por el layout (logo/menú) y los guards de ruta.
 *
 * Sin marca, o con una marca que nunca guardó módulos, no restringe nada:
 * manda `environment.features` como siempre.
 */
@Injectable({ providedIn: 'root' })
export class BrandModulesService {
  private readonly auth         = inject(AuthService);
  private readonly userService  = inject(UserService);
  private readonly brandService = inject(BrandService);

  /** Config de la marca del usuario; null = sin marca. */
  readonly config  = signal<BrandConfig | null>(null);
  /** Códigos habilitados por la marca; null = la marca no restringe módulos. */
  readonly enabled = signal<ReadonlySet<string> | null>(null);

  private load$:     Observable<BrandConfig | null> | null = null;
  private loadedFor: string | null = null;

  ensureLoaded(): Observable<BrandConfig | null> {
    const userId = this.auth.currentUser()?.id;
    const key = userId ? String(userId) : null;
    if (!key) {
      this.clear();
      return of(null);
    }
    if (this.load$ && this.loadedFor === key) return this.load$;

    // `brandSlug` no viene en el JWT (dato mutable): se resuelve fresco vía GET /user/{id}.
    this.loadedFor = key;
    this.load$ = this.userService.getById(key).pipe(
      switchMap(user => (user.brandSlug ? this.brandService.getConfig(user.brandSlug) : of(null))),
      catchError(() => of(null)),
      tap(config => this.apply(config)),
      shareReplay(1),
    );
    return this.load$;
  }

  /** ¿La marca del usuario permite este módulo? (true si no hay marca o no restringe). */
  brandAllows(code: string): boolean {
    const enabled = this.enabled();
    return enabled === null || enabled.has(code);
  }

  /** Módulo activo en el tenant (environment.features) y permitido por la marca. */
  isEnabled(code: keyof typeof environment.features): boolean {
    return environment.features[code] && this.brandAllows(code);
  }

  /** Espera la carga y responde brandAllows — para guards. */
  allows$(code: string): Observable<boolean> {
    return this.ensureLoaded().pipe(map(() => this.brandAllows(code)));
  }

  private apply(config: BrandConfig | null): void {
    this.config.set(config);
    const modules = config?.modules ?? [];
    this.enabled.set(modules.length > 0
      ? new Set(modules.filter(m => m.isEnabled).map(m => m.code))
      : null);
  }

  private clear(): void {
    this.load$ = null;
    this.loadedFor = null;
    this.apply(null);
  }
}
