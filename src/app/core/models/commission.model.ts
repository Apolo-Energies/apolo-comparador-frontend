export interface UserCommission {
  id:             string;
  userId:         string;
  commissionId:   string;
  startDate:      string;
  endDate:        string | null;
  isPaid:         boolean;
  isActive:       boolean;
  commissionType: {
    id:         string;
    percentage: number;
    name:       string;
  };
}
