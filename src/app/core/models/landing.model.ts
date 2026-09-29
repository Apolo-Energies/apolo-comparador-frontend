export interface PublicLandingProduct {
  id:           number;
  name:         string;
  tariffId:     number;
  tariffCode:   string;
  providerId:   number;
  providerName: string;
}

export interface PublicLandingBranding {
  logoUrl:        string | null;
  heroImageUrls:  string[];
  heroTitle:      string;
  heroSubtitle:   string;
  formTitle:      string | null;
  formSubtitle:   string | null;
}

export interface PublicLanding {
  id:       string;
  slug:     string;
  name:     string;
  isActive: boolean;
  product:  PublicLandingProduct;
  branding: PublicLandingBranding;
}

export interface LandingSummary {
  id:                  string;
  slug:                string;
  name:                string;
  isActive:            boolean;
  productName:         string;
  tariffCode:          string;
  providerName:        string;
  comparisonsCount:    number;
  offerRequestsCount:  number;
}

export interface LandingDetail {
  id:             string;
  slug:           string;
  name:           string;
  isActive:       boolean;
  productId:      number;
  productName:    string;
  tariffId:       number;
  tariffCode:     string;
  providerId:     number;
  providerName:   string;
  logoUrl?:       string;
  heroImageUrls:  string[];
  heroTitle:      string;
  heroSubtitle:   string;
  formTitle?:     string;
  formSubtitle?:  string;
  createdAt:      string;
}

export interface LandingPayload {
  slug:          string;
  name:          string;
  productId:     number;
  heroTitle:     string;
  heroSubtitle:  string;
  formTitle?:    string;
  formSubtitle?: string;
}

export interface LandingStats {
  comparisonsCount:    number;
  offerRequestsCount:  number;
}

export interface LandingListQuery {
  page:      number;
  pageSize:  number;
  search?:   string;
  isActive?: boolean;
}

export interface LandingListResult {
  items: LandingSummary[];
  total: number;
}
