export type SignatureStatus =
  | 'Pending' | 'InProgress' | 'Signed' | 'Declined' | 'Cancelled' | 'Expired';

export type ContractOrigin = 'Initial' | 'Renewal' | 'Resend';

export type ContractAction =
  | 'UploadDocument' | 'RequestSignature' | 'Renew' | 'Resend'
  | 'ReplaceDocument' | 'ValidateDocument' | 'RejectDocument';

export type DocumentStatusType = 'Pending' | 'Uploaded' | 'Signed' | 'Rejected' | 'Validated';

export type UserContractStatus =
  | 'NoContract' | 'DocsPending' | 'ReadyToSign' | 'InProgress'
  | 'Active' | 'ExpiringSoon' | 'Expired' | 'Declined' | null;

export interface ContractStatusDocument {
  id: string;
  type: string;
  status: DocumentStatusType;
  url: string;
  uploadedAt: string;
  reviewComment?: string;
}

export interface ContractStatusResponse {
  contract: {
    id: string | null;
    signatureStatus: SignatureStatus | null;
    origin: ContractOrigin | null;
    isActive: boolean;
    startDate: string | null;
    endDate: string | null;
    daysUntilExpiration: number | null;
  } | null;
  documents: {
    required: string[];
    uploaded: ContractStatusDocument[];
    missingTypes: string[];
    completionPercentage: number;
  };
  availableActions: ContractAction[];
}
