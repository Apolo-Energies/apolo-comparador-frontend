export interface Delegation {
  id:           number;
  name:         string;
  businessName: string | null;
  taxId:        string | null;
  address:      string | null;
  email:        string | null;
  postalCode:   string | null;
  provinceId:   number | null;
  province:     string | null;
}
