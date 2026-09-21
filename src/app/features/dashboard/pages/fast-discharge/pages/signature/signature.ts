import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { FastDischargeStore } from '../../store/fast-discharge.store';

@Component({
  selector: 'app-fd-signature',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signature.html',
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
