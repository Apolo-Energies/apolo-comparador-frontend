import { computed, signal } from '@angular/core';
import { ComboboxOption } from '@apolo-energies/ui';
import { UserService } from '../../../../core/services/user.service';

export interface SipsRecipientDeps {
  userService: UserService;
}

/** Selector de usuario (Master) para redirigir el correo del Excel multi-CUPS. */
export class SipsRecipientController {
  constructor(private readonly deps: SipsRecipientDeps) {}

  readonly usersLoading = signal(false);
  readonly users = signal<{ id: string; name: string; email: string }[]>([]);
  readonly recipientUserId = signal('');

  readonly usersAsOptions = computed<ComboboxOption[]>(() =>
    this.users().map(u => ({ id: u.id, name: u.email ? `${u.name} (${u.email})` : u.name }))
  );

  readonly recipientEmail = computed(() =>
    this.users().find(u => u.id === this.recipientUserId())?.email ?? ''
  );

  onRecipientChange(value: string | number): void {
    this.recipientUserId.set(String(value));
  }

  loadUsers(): void {
    this.usersLoading.set(true);
    this.deps.userService.getByFilters({ pageSize: 200 }).subscribe({
      next: res => {
        this.users.set(res.items.map(u => ({ id: u.id, name: u.fullName, email: u.email })));
        this.usersLoading.set(false);
      },
      error: () => this.usersLoading.set(false),
    });
  }
}
