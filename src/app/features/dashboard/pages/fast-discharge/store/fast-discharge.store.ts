import { Injectable, signal } from '@angular/core';
import { Person, DocumentState, SupplyPoint, Product } from '../models/person.models';
import { SipsConsumo } from '../../../../../entities/sips.model';

@Injectable({ providedIn: 'root' })
export class FastDischargeStore {
  readonly person      = signal<Person | null>(null);
  readonly supplyPoint = signal<SupplyPoint | null>(null);
  readonly product     = signal<Product | null>(null);
  readonly consumos    = signal<SipsConsumo[]>([]);
  readonly documents   = signal<DocumentState>({});
  readonly signingUrl  = signal<string | null>(null);

  setPerson(person: Person): void            { this.person.set(person); }
  setSupplyPoint(sp: SupplyPoint): void      { this.supplyPoint.set(sp); }
  setProduct(p: Product): void               { this.product.set(p); }
  setConsumos(c: SipsConsumo[]): void        { this.consumos.set(c); }
  setDocuments(docs: DocumentState): void    { this.documents.set(docs); }
  setSigningUrl(url: string): void           { this.signingUrl.set(url); }

  reset(): void {
    this.person.set(null);
    this.supplyPoint.set(null);
    this.product.set(null);
    this.consumos.set([]);
    this.documents.set({});
    this.signingUrl.set(null);
  }
}
