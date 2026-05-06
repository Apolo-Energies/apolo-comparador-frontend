import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContractDocumentService {
  private http = inject(HttpClient);

  upload(contractId: string, documentType: string, file: File) {
    const fd = new FormData();
    fd.append('documentType', documentType);
    fd.append('file', file, file.name);
    fd.append('Name', file.name);
    return this.http.post<{ message: string }>(`${environment.apiUrl}/contract-document/${contractId}`, fd);
  }

  validate(id: string) {
    return this.http.post(`${environment.apiUrl}/contract-document/validate/${id}`, {});
  }

  validateSigned(id: string) {
    return this.http.post(`${environment.apiUrl}/contracts/validate-signed/${id}`, {});
  }

  reject(id: string, comment: string) {
    return this.http.post(`${environment.apiUrl}/contract-document/reject/${id}`, { comment });
  }

  replace(documentId: string, file: File) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post(`${environment.apiUrl}/contract-document/replace/${documentId}`, fd);
  }

  delete(id: string) {
    return this.http.delete(`${environment.apiUrl}/contract-document/${id}`);
  }
}
