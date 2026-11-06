import { signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { ContractTemplateService } from '../../../../../core/services/contract-template.service';
import { ContractTemplate, SignatureWidget } from '../../../../../core/models/contract-template.model';

export interface ContractTemplateSubmitDeps {
  templateService: ContractTemplateService;
  alertService:    AlertService;
  /** Called once the save/create request succeeds (resets the form and emits `saved`). */
  onSuccess: () => void;
  /** Called on 409 (concurrencyVersion desactualizado) — debería recargar la plantilla. */
  onConflict?: () => void;
}

export interface ContractTemplateSubmitParams {
  isEditMode:   boolean;
  isNewVersion: boolean;
  template:     ContractTemplate | null;
  code?:        string;
  name?:        string;
  type?:        string;
  version:      string;
  changeNotes:  string;
  html:         string;
  signatureWidgets: SignatureWidget[] | undefined;
}

/**
 * Encapsulates the 3 submit variants of the contract-template form (create a
 * brand-new template, create a new version of an existing one, or correct
 * the current version's content). Extracted from ContractTemplateFormComponent
 * to keep it under the file-size guideline (R1).
 */
export class ContractTemplateSubmitController {
  constructor(private readonly deps: ContractTemplateSubmitDeps) {}

  readonly saving = signal(false);

  submit(p: ContractTemplateSubmitParams): void {
    this.saving.set(true);
    const changeNotes = p.changeNotes || undefined;

    if (p.isEditMode) {
      const tpl = p.template!;
      if (p.isNewVersion) {
        this.deps.templateService.createVersion(tpl.code, {
          version: p.version, content: p.html, changeNotes, signatureWidgets: p.signatureWidgets,
        }).subscribe({
          next:  () => this.finish('Nueva versión creada correctamente'),
          error: () => this.fail('Error al crear la versión'),
        });
      } else {
        this.deps.templateService.updateContent(tpl.id, {
          content: p.html, changeNotes, signatureWidgets: p.signatureWidgets,
          concurrencyVersion: tpl.concurrencyVersion,
        }).subscribe({
          next:  () => this.finish('Plantilla actualizada correctamente'),
          error: (err) => this.failUpdate(err),
        });
      }
    } else {
      this.deps.templateService.create({
        code: p.code!, name: p.name!, type: p.type as 'individual' | 'company',
        version: p.version, content: p.html, changeNotes, signatureWidgets: p.signatureWidgets,
      }).subscribe({
        next:  () => this.finish('Plantilla creada correctamente'),
        error: (err) => this.fail(err?.status === 409 ? 'Ya existe una plantilla con ese código' : 'Error al crear la plantilla'),
      });
    }
  }

  private finish(message: string): void {
    this.deps.alertService.show(message, 'success');
    this.saving.set(false);
    this.deps.onSuccess();
  }

  private fail(message: string): void {
    this.saving.set(false);
    this.deps.alertService.show(message, 'error');
  }

  // 409 por concurrencyVersion desactualizado — el body viene como texto plano con el mensaje.
  private failUpdate(err: unknown): void {
    this.saving.set(false);
    const httpErr = err as { status?: number; error?: unknown };
    if (httpErr?.status === 409) {
      const message = typeof httpErr.error === 'string'
        ? httpErr.error
        : 'La plantilla fue modificada por otra persona mientras editabas — recargá los datos e intentá de nuevo.';
      this.deps.alertService.show(message, 'error');
      this.deps.onConflict?.();
      return;
    }
    this.deps.alertService.show('Error al actualizar la plantilla', 'error');
  }
}
