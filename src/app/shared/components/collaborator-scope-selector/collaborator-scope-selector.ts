import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CollaboratorOption, CollaboratorScopeService } from '../../../core/services/collaborator-scope.service';
import { CollaboratorDialogComponent } from '../collaborator-dialog/collaborator-dialog';

/**
 * Hospeda el modal "ver como colaborador" — vive una sola vez en el layout.
 * Se abre desde el ítem real del sidebar "APOLO ENERGIES → Colaborador" vía
 * openCollaboratorDialogGuard (no tiene trigger propio, es solo el diálogo).
 */
@Component({
  selector: 'app-collaborator-scope-selector',
  standalone: true,
  imports: [CollaboratorDialogComponent],
  templateUrl: './collaborator-scope-selector.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollaboratorScopeSelectorComponent {
  readonly scope = inject(CollaboratorScopeService);

  onClose(): void {
    this.scope.closeDialog();
  }

  onSelect(option: CollaboratorOption | null): void {
    this.scope.select(option);
  }
}
