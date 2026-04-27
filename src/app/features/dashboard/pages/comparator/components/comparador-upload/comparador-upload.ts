import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ButtonComponent, ComboboxComponent, ComboboxOption, DropzoneComponent } from '@apolo-energies/ui';
import { ComparadorCompareEvent, ComparadorUser } from '../../comparator.models';

@Component({
  selector: 'app-comparador-upload',
  standalone: true,
  imports: [ComboboxComponent, DropzoneComponent, ButtonComponent],
  templateUrl: './comparador-upload.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparadorUploadComponent {
  // ── inputs ─────────────────────────────────────────────────────────────────
  readonly loading          = input(false);
  readonly showUserSelector = input(false);
  readonly users            = input<ComparadorUser[]>([]);
  readonly selectedUserId   = input('');

  // ── outputs ────────────────────────────────────────────────────────────────
  readonly compare    = output<ComparadorCompareEvent>();
  readonly userChange = output<string>();

  // ── internal state ─────────────────────────────────────────────────────────
  readonly file         = signal<File | null>(null);
  readonly internalUser = signal<string>('');

  readonly usersAsOptions = computed<ComboboxOption[]>(() =>
    this.users().map(u => ({ id: u.id, name: u.name }))
  );

  // ── handlers ───────────────────────────────────────────────────────────────

  onFileSelect(file: File | null) {
    this.file.set(file);
  }

  onUserChange(value: string | number) {
    const id = String(value);
    this.internalUser.set(id);
    this.userChange.emit(id);
  }

  onComparar() {
    const f      = this.file();
    const userId = this.selectedUserId() || this.internalUser();
    if (!f || this.loading() || (this.showUserSelector() && !userId)) return;
    this.compare.emit({ file: f, userId });
  }
}
