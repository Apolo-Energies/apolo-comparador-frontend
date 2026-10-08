import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BrandConfig,
  BrandImage,
  BrandImageUploadResponse,
  BrandModule,
  BrandPreviewPdfRequest,
  BrandProvider,
  BrandSummary,
  BrandUser,
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

  /** null si la marca todavía no tiene un colaborador asignado (404). */
  getUser(id: string): Observable<BrandUser | null> {
    return this.http.get<BrandUser>(`${this.base}/${id}/user`).pipe(
      catchError(err => err?.status === 404 ? of(null) : throwError(() => err)),
    );
  }

  /** Reemplaza el conjunto completo de proveedores de la marca (no es incremental). */
  updateProviders(id: string, providers: Pick<BrandProvider, 'providerId' | 'sortOrder'>[]): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/providers`, { providers });
  }

  /** Opcional: restringe a estas tarifas completas (habilita todos sus productos). Reemplaza el set completo. */
  updateTariffs(id: string, tariffIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/tariffs`, { tariffIds });
  }

  /** Opcional: habilita estos productos puntuales, sin importar si su tarifa está en updateTariffs. Reemplaza el set completo. */
  updateProducts(id: string, productIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/products`, { productIds });
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
