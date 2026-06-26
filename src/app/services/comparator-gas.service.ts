import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { GasUploadResponse } from '../features/dashboard/pages/comparator-gas/comparator-gas.models';

@Injectable({ providedIn: 'root' })
export class ComparatorGasService {
  private readonly http = inject(HttpClient);

  uploadGas(file: File, userId?: string): Observable<GasUploadResponse> {
    const form = new FormData();
    form.append('File', file, file.name);
    form.append('Name', file.name.replace(/\.pdf$/i, ''));
    form.append('Type', 'PDF');
    if (userId) form.append('UserId', userId);

    return this.http.post<GasUploadResponse>(
      `${environment.apiUrl}/files/upload-and-process-gas`,
      form,
    );
  }
}
