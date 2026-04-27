export interface UserDetail {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isEnergyExpert: boolean;
  isActive: boolean;
  role: number;
  providerId: number | null;
  customerId: string | null;
  identifier: string | null;
  hasActiveContract: boolean;
  customer: CustomerDetail | null;
  contract: ContractDetail | null;
  commissions: UserDetailCommission[];
  isSubUser: boolean;
  availableActions: string[];
}

export interface UserDetailCommission {
  id: string;
  commissionType: CommissionType;
  isActive: boolean;
}

export interface CommissionType {
  id: string;
  percentage: number;
  name: string;
}

export interface CustomerDetail {
  id: string;
  kind: number;
  personType: number;
  firstName: string;
  lastName: string;
  companyName: string | null;
  dni: string | null;
  cif: string | null;
  email: string;
  phone: string;
  userId: string;
  legalAddress: string;
  notificationAddress: string;
  bankAccount: string;
  createdAt: string;
}

export interface ContractDetail {
  id: string;
  customerId: string;
  signatureRequestId: string | null;
  signatureStatus: number;
  origin: number;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  daysUntilExpiration: number | null;
  documents: ContractDocuments;
  createdAt: string;
}

export interface ContractDocuments {
  required: string[];
  uploaded: ContractDocument[];
  missingTypes: string[];
  completionPercentage: number;
}

export interface ContractDocument {
  id: string;
  contractId: string;
  documentType: number;
  status: number;
  fileUrl: string;
  previewUrl?: string;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
}
