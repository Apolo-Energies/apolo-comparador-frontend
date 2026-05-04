import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Provider } from '../entities/provider.model';
import { OcrResult } from '../features/dashboard/pages/comparator/comparator.models';

@Injectable({ providedIn: 'root' })
export class PublicComparatorService {
  private http = inject(HttpClient);

  // ── Tracking ────────────────────────────────────────────────────────────
  register(cups: string | null | undefined) {
    return this.http.post<{ id: string }>(
      `${environment.apiUrl}/public/comparisons`,
      { cups: cups ?? null },
    );
  }

  markContratarClicked(comparisonId: string) {
    return this.http.post<void>(
      `${environment.apiUrl}/public/comparisons/${comparisonId}/contratar-click`,
      {},
    );
  }

  linkContract(comparisonId: string, contractId: string) {
    return this.http.post<void>(
      `${environment.apiUrl}/public/comparisons/${comparisonId}/link-contract`,
      { contractId },
    );
  }

  // ── Widget data ─────────────────────────────────────────────────────────
  getTariffs() {
    return this.http.get<Provider>(`${environment.apiUrl}/public/provider/tariffs`);
  }

  upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    form.append('name', file.name);
    return this.http.post<{ fileId: string; name: string; url: string; createdAt: string; ocrData: OcrResult }>(
      `${environment.apiUrl}/public/files/upload-and-process`,
      form,
    );
  }

  downloadPdf(payload: unknown) {
    return this.http.post(
      `${environment.apiUrl}/public/comparison-history/pdf`,
      payload,
      { responseType: 'blob' },
    );
  }
}
