import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { SupportTicketCategory, SupportTicketService } from '../../../../../../core/services/support-ticket.service';

type Field = 'subject' | 'category' | 'description';

const LIMITS = { subjectMin: 3, subjectMax: 150, descriptionMin: 10, descriptionMax: 5000 } as const;

/**
 * Formulario "Abrir ticket":
 * etiquetas visibles, validación al salir del campo (si se editó) y limpieza al escribir,
 * foco al primer error al enviar, aria-invalid / aria-describedby, resultado en role="status",
 * botón bloqueado solo durante un envío válido (sin dobles envíos) y el texto se conserva si falla.
 */
@Component({
  selector: 'app-support-ticket-form',
  standalone: true,
  templateUrl: './support-ticket-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportTicketFormComponent {
  private readonly service = inject(SupportTicketService);

  readonly limits = LIMITS;
  readonly categories: { value: SupportTicketCategory; label: string }[] = [
    { value: 'IncidenciaContrato', label: 'Incidencia de contrato' },
    { value: 'Comisiones',         label: 'Comisiones' },
    { value: 'AccesoPortal',       label: 'Acceso al portal' },
    { value: 'Otro',               label: 'Otro' },
  ];

  readonly subject = signal('');
  readonly category = signal<SupportTicketCategory | ''>('');
  readonly description = signal('');

  readonly errors = signal<Partial<Record<Field, string>>>({});
  private readonly touched = new Set<Field>();

  readonly sending = signal(false);
  readonly sentReference = signal<string | null>(null);
  readonly serverError = signal<string | null>(null);

  private readonly subjectEl = viewChild<ElementRef<HTMLInputElement>>('subjectEl');
  private readonly categoryEl = viewChild<ElementRef<HTMLInputElement>>('categoryEl');
  private readonly descriptionEl = viewChild<ElementRef<HTMLTextAreaElement>>('descriptionEl');

  onInput(field: Field, value: string): void {
    if (field === 'subject') this.subject.set(value);
    else if (field === 'description') this.description.set(value);
    else this.category.set(value as SupportTicketCategory);
    this.touched.add(field);
    // Al escribir solo se limpian errores (nunca se muestran nuevos).
    if (this.errors()[field] && !this.validate(field)) this.setError(field, undefined);
    this.sentReference.set(null);
    this.serverError.set(null);
  }

  onBlur(field: Field): void {
    if (this.touched.has(field)) this.setError(field, this.validate(field));
  }

  submit(event: Event): void {
    event.preventDefault();
    if (this.sending()) return;

    const fields: Field[] = ['subject', 'category', 'description'];
    const next: Partial<Record<Field, string>> = {};
    for (const f of fields) {
      const e = this.validate(f);
      if (e) next[f] = e;
    }
    this.errors.set(next);
    const first = fields.find(f => next[f]);
    if (first) { this.focusField(first); return; }

    this.sending.set(true);
    this.serverError.set(null);
    this.service.send({
      subject: this.subject().trim(),
      category: this.category() as SupportTicketCategory,
      description: this.description().trim(),
    }).subscribe({
      next: ({ reference }) => {
        this.sending.set(false);
        this.sentReference.set(reference);
        this.subject.set(''); this.category.set(''); this.description.set('');
        this.touched.clear();
        this.errors.set({});
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        // Se conserva lo escrito; el mensaje del backend ya es legible (400 / 429 / 503).
        this.serverError.set(err.error?.error ?? 'No se pudo enviar el ticket. Inténtelo de nuevo.');
      },
    });
  }

  private validate(field: Field): string | undefined {
    if (field === 'subject') {
      const v = this.subject().trim();
      if (!v) return 'Escriba un asunto.';
      if (v.length < LIMITS.subjectMin) return `El asunto debe tener al menos ${LIMITS.subjectMin} caracteres.`;
      if (v.length > LIMITS.subjectMax) return `El asunto no puede superar ${LIMITS.subjectMax} caracteres.`;
    }
    if (field === 'category' && !this.category()) return 'Elija una categoría.';
    if (field === 'description') {
      const v = this.description().trim();
      if (!v) return 'Describa el problema.';
      if (v.length < LIMITS.descriptionMin) return `Añada algo más de detalle (mínimo ${LIMITS.descriptionMin} caracteres).`;
      if (v.length > LIMITS.descriptionMax) return `La descripción no puede superar ${LIMITS.descriptionMax} caracteres.`;
    }
    return undefined;
  }

  private setError(field: Field, message: string | undefined): void {
    this.errors.update(e => ({ ...e, [field]: message }));
  }

  private focusField(field: Field): void {
    const el = field === 'subject' ? this.subjectEl() : field === 'category' ? this.categoryEl() : this.descriptionEl();
    el?.nativeElement.focus();
  }
}
