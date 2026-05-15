import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { FastDischargeStore } from '../../store/fast-discharge.store';

@Component({
  selector: 'app-fd-signature',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-start pt-16 px-4">
      <div class="w-full max-w-3xl bg-card border border-border rounded-lg shadow-xl px-10 py-10 space-y-6">

        <div>
          <p class="text-2xl font-semibold text-foreground">Firma el Contrato de Colaboración</p>
          <p class="text-sm text-muted-foreground mt-1">Revisa el documento y procede a firmar.</p>
        </div>

        @if (signingUrl()) {
          <iframe
            [src]="safeUrl()"
            class="w-full rounded-lg border border-border"
            style="height: 75vh"
            allow="camera; microphone"
          ></iframe>
        } @else {
          <div class="flex items-center justify-center h-64 rounded-lg border border-dashed border-border text-muted-foreground text-sm">
            No hay documento disponible para firmar.
          </div>
        }

      </div>
    </div>
  `,
})
export class SignaturePage {
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly store = inject(FastDischargeStore);

  readonly signingUrl = this.store.signingUrl;

  readonly safeUrl = () =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.signingUrl() ?? '');

  constructor() {
    effect(() => {
      if (!this.signingUrl()) {
        this.router.navigate(['/dashboard/fast-discharge']);
      }
    });
  }
}
