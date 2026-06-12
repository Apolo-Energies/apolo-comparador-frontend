import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ContractTemplate,
  CreateTemplateRequest,
  CreateVersionRequest,
  UpdateContentRequest,
} from '../entities/contract-template.model';

@Injectable({ providedIn: 'root' })
export class ContractTemplateService {
  private http = inject(HttpClient);

  getAll(): Observable<ContractTemplate[]> {
    return this.http.get<ContractTemplate[]>(`${environment.apiUrl}/contract-templates`);
  }

  getHistory(code: string): Observable<ContractTemplate[]> {
    return this.http.get<ContractTemplate[]>(`${environment.apiUrl}/contract-templates/${code}/history`);
  }

  getActive(code: string): Observable<ContractTemplate> {
    return this.http.get<ContractTemplate>(`${environment.apiUrl}/contract-templates/${code}/active`);
  }

  create(data: CreateTemplateRequest): Observable<ContractTemplate> {
    return this.http.post<ContractTemplate>(`${environment.apiUrl}/contract-templates`, data);
  }

  createVersion(code: string, data: CreateVersionRequest): Observable<ContractTemplate> {
    return this.http.post<ContractTemplate>(`${environment.apiUrl}/contract-templates/${code}/version`, data);
  }

  updateContent(id: string, data: UpdateContentRequest): Observable<ContractTemplate> {
    return this.http.patch<ContractTemplate>(`${environment.apiUrl}/contract-templates/${id}`, data);
  }

  activate(id: string): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/contract-templates/${id}/activate`, {});
  }

  deactivate(id: string): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/contract-templates/${id}/deactivate`, {});
  }
}
