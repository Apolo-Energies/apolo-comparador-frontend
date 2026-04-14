import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Provider } from '../entities/provider.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProviderService {
  private http = inject(HttpClient);

  getByUser() {
    return this.http.get<{ result: Provider }>(`${environment.apiUrl}/provider/user-provider`);
  }
}
