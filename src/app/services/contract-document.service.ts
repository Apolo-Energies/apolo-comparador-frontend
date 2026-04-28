import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContractDocumentService {
  private http = inject(HttpClient);

  upload(contractId: string, documentType: number, file: File) {
    const fd = new FormData();
    fd.append('documentType', String(documentType));
    fd.append('file', file, file.name);
    fd.append('Name', file.name);
    return this.http.post<{ message: string }>(`${environment.apiUrl}/contractdocument/${contractId}`, fd);
  }

  validate(id: string) {
    return this.http.post(`${environment.apiUrl}/contractdocument/validate/${id}`, {});
  }

  validateSigned(id: string) {
    return this.http.post(`${environment.apiUrl}/contracts/validate-signed/${id}`, {});
  }

  reject(id: string, observation: string) {
    return this.http.post(`${environment.apiUrl}/contractdocument/reject/${id}`, { observation });
  }

  delete(id: string) {
    return this.http.delete(`${environment.apiUrl}/contractdocument/${id}`);
  }
}
