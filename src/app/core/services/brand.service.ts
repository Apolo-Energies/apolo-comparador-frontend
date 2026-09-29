import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BrandConfig,
  BrandImage,
  BrandImageUploadResponse,
  BrandModule,
  BrandPreviewPdfRequest,
  BrandSummary,
  CreateBrandRequest,
  CreateBrandResponse,
} from '../models/brand.model';

@Injectable({ providedIn: 'root' })
export class BrandService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/brand`;

  list(): Observable<BrandSummary[]> {
    return this.http.get<BrandSummary[]>(this.base);
  }

  getConfig(slug: string): Observable<BrandConfig> {
    return this.http.get<BrandConfig>(`${this.base}/${encodeURIComponent(slug)}/config`);
  }

  create(payload: CreateBrandRequest): Observable<CreateBrandResponse> {
    return this.http.post<CreateBrandResponse>(this.base, payload);
  }

  /** Sube un archivo a S3 y lo agrega a la marca (no borra las existentes). */
  uploadImage(id: string, file: File, kind: string, sortOrder?: number): Observable<BrandImageUploadResponse> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('kind', kind);
    if (sortOrder != null) form.append('sortOrder', String(sortOrder));
    return this.http.post<BrandImageUploadResponse>(`${this.base}/${id}/images/upload`, form);
  }

  /** Fija el set final de imágenes (reemplaza todas). Usar después de subir con uploadImage(). */
  updateImages(id: string, images: BrandImage[]): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/images`, { images });
  }

  updateModules(id: string, modules: BrandModule[]): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/modules`, { modules });
  }

  updateSettings(id: string, settingsJson: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/settings`, { settingsJson });
  }

  /** No toca la BD: renderiza un PDF de muestra con los valores que se están probando ahora. */
  previewPdf(id: string, payload: BrandPreviewPdfRequest): Observable<Blob> {
    return this.http.post(`${this.base}/${id}/preview-pdf`, payload, { responseType: 'blob' });
  }
}
