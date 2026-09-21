export interface SubUserSummary {
  id:                   string;
  fullName:             string;
  email:                string;
  role:                 string;
  isActive:             boolean;
  providerId:           number;
  commissionPercentage: number | null;
}

export interface UserRow {
  id:             string;
  fullName:       string;
  email:          string;
  phone:          string | null;
  role:           string | number;
  isActive:       boolean;
  isEnergyExpert: boolean;
  commissions:    { isActive: boolean; commissionType: { id: string; name: string } }[];
  providerId:     number | null;
  provider:       { id: number; name: string } | null;
  delegationId?:  number | null;
  customerId?:                string | null;
  identifier?:                string | null;
  contractSignatureStatus?:   string | null;
  hasActiveContract?:         boolean;
  isSubUser?:                 boolean;
  customer?: {
    personType:  string;
    dni:         string | null;
    cif:         string | null;
    companyName: string | null;
  } | null;
  subUsers?:  SubUserSummary[];
  createdAt?: string;
}
