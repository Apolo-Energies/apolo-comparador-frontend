import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Provider } from '../entities/provider.model';
import { environment } from '../../environments/environment';

export interface ProviderRow {
  id:   number;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class ProviderService {
  private http = inject(HttpClient);

  getAll() {
    return this.http.get<ProviderRow[]>(`${environment.apiUrl}/provider`);
  }

  getByUser() {
    return this.http.get<{ result: Provider }>(`${environment.apiUrl}/provider/user-provider`);
  }
}
