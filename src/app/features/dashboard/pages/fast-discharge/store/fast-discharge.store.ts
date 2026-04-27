import { Injectable, signal } from '@angular/core';
import { Person, DocumentState } from '../models/person.models';

@Injectable({ providedIn: 'root' })
export class FastDischargeStore {
  readonly person = signal<Person | null>(null);
  readonly documents = signal<DocumentState>({});
  readonly signingUrl = signal<string | null>(null);

  setPerson(person: Person): void {
    this.person.set(person);
  }

  setDocuments(docs: DocumentState): void {
    this.documents.set(docs);
  }

  setSigningUrl(url: string): void {
    this.signingUrl.set(url);
  }

  reset(): void {
    this.person.set(null);
    this.documents.set({});
    this.signingUrl.set(null);
  }
}
