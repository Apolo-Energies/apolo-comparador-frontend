import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  LandingDetail,
  LandingListQuery,
  LandingListResult,
  LandingPayload,
  LandingStats,
  PublicLanding,
} from '../entities/landing.model';

@Injectable({ providedIn: 'root' })
export class LandingService {
  private http = inject(HttpClient);
  private base       = `${environment.apiUrl}/landings`;
  private publicBase = `${environment.apiUrl}/public/landings`;

  getBySlug(slug: string): Observable<PublicLanding> {
    return this.http.get<PublicLanding>(`${this.publicBase}/${encodeURIComponent(slug)}`);
  }

  list(query: LandingListQuery): Observable<LandingListResult> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize);
    if (query.search)        params = params.set('search', query.search);
    if (query.isActive != null) params = params.set('isActive', String(query.isActive));
    return this.http.get<LandingListResult>(this.base, { params });
  }

  getById(id: string): Observable<LandingDetail> {
    return this.http.get<LandingDetail>(`${this.base}/${id}`);
  }

  create(payload: LandingPayload): Observable<LandingDetail> {
    return this.http.post<LandingDetail>(this.base, payload);
  }

  update(id: string, payload: LandingPayload): Observable<LandingDetail> {
    return this.http.put<LandingDetail>(`${this.base}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  uploadAssets(id: string, logo: File | null, heroImages: File[]): Observable<LandingDetail> {
    const form = new FormData();
    if (logo) form.append('Logo', logo, logo.name);
    for (const img of heroImages) form.append('HeroImages', img, img.name);
    return this.http.post<LandingDetail>(`${this.base}/${id}/assets`, form);
  }

  getStats(id: string): Observable<LandingStats> {
    return this.http.get<LandingStats>(`${this.base}/${id}/stats`);
  }
}
