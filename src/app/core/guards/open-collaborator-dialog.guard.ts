import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { CollaboratorScopeService } from '../services/collaborator-scope.service';

/**
 * No es una guarda de seguridad: es el truco para que el ítem "Colaborador"
 * del sidebar (que solo soporta navegación por url, no un click handler
 * propio) abra el modal de "ver como colaborador" en vez de navegar.
 * Siempre cancela la navegación (return false) — el usuario se queda en la
 * página actual — y como efecto secundario abre el diálogo.
 */
export const openCollaboratorDialogGuard: CanActivateFn = () => {
  inject(CollaboratorScopeService).openDialog();
  return false;
};
