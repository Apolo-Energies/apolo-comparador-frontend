import { Provider }       from './provider.model';
import { UserCommission } from './commission.model';

export interface User {
  id:             string;
  fullName:       string;
  email:          string;
  isEnergyExpert: boolean;
  isActive:       boolean;
  role:           number;
  providerId:     number;
  provider:       Provider | null;
  commissions:    UserCommission[];
}

export interface UserPaged {
  items:           User[];
  currentPage:     number;
  pageSize:        number;
  totalCount:      number;
  totalPages:      number;
  hasPreviousPage: boolean;
  hasNextPage:     boolean;
}

export interface UserFilters {
  fullName?: string;
  email?:    string;
  role?:     string;
  page?:     number;
  pageSize?: number;
}
