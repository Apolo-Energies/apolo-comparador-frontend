import { computed, signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { UserService } from '../../../../core/services/user.service';
import { BrandService } from '../../../../core/services/brand.service';
import { BrandUser } from '../../../../core/models/brand.model';

/**
 * Colaborador raíz de una marca blanca: si ya existe, se muestra de solo
 * lectura; si no, el alta queda fija a persona física y rol Colaborador
 * (role=2) — una marca tiene un único colaborador raíz, así que no hace
 * falta elegir tipo de persona ni rol. Extraído de BrandFormDialogComponent
 * para mantenerlo bajo el límite de líneas (R1).
 */
export class BrandUserController {
  constructor(
    private readonly userService:  UserService,
    private readonly brandService: BrandService,
    private readonly alert:        AlertService,
  ) {}

  readonly loading  = signal(false);
  readonly existing = signal<BrandUser | null>(null);

  readonly email    = signal('');
  readonly name     = signal('');
  readonly surnames = signal('');
  readonly phone    = signal('');
  readonly touched  = signal<Record<string, boolean>>({});
  readonly creating = signal(false);

  readonly emailValid  = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email()));
  readonly createValid = computed(() =>
    this.emailValid() && this.name().trim().length > 0 && this.surnames().trim().length > 0
  );

  reset(): void {
    this.loading.set(false);
    this.existing.set(null);
    this.email.set('');
    this.name.set('');
    this.surnames.set('');
    this.phone.set('');
    this.touched.set({});
    this.creating.set(false);
  }

  markTouched(field: string): void {
    this.touched.update(t => ({ ...t, [field]: true }));
  }

  isFieldInvalid(field: string): boolean {
    if (!this.touched()[field]) return false;
    if (field === 'email')    return !this.emailValid();
    if (field === 'name')     return this.name().trim().length === 0;
    if (field === 'surnames') return this.surnames().trim().length === 0;
    return false;
  }

  load(brandId: string): void {
    this.loading.set(true);
    this.brandService.getUser(brandId).subscribe({
      next: user => { this.existing.set(user); this.loading.set(false); },
      error: () => { this.existing.set(null); this.loading.set(false); },
    });
  }

  create(brandId: string): void {
    this.touched.set({ email: true, name: true, surnames: true });
    if (!this.createValid()) {
      this.alert.show('Revisa el email, nombre y apellidos.', 'error', 3500);
      return;
    }
    this.creating.set(true);
    this.userService.create({
      personType: 0,
      email:      this.email().trim().toLowerCase(),
      role:       2,
      name:       this.name().trim(),
      surnames:   this.surnames().trim(),
      phone:      this.phone().trim() || undefined,
      brandId,
    }).subscribe({
      next: res => {
        this.creating.set(false);
        this.existing.set({ id: res.id, fullName: res.fullName, email: res.email, role: 'Colaborador' });
        this.alert.show('Usuario creado. Le llegó un mail para poner su contraseña.', 'success', 4500);
      },
      error: err => {
        this.creating.set(false);
        const message = err?.status === 409 ? 'Ya existe un usuario con ese email.' : 'No se pudo crear el usuario.';
        this.alert.show(message, 'error', 4000);
      },
    });
  }
}
