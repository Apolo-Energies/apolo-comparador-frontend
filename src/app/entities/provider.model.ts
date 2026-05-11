import { Period } from '../shared/constants/period';

export interface Provider {
  id:      number;
  name:    string;
  users:   unknown[];
  tariffs: Tariff[];
}

export interface Tariff {
  id:                number;
  code:              string;
  providerId:        number;
  provider:          Provider | null;
  products:          Product[];
  omieDistributions: OmieDistribution[];
  boePowers:         BoePower[];
}

export interface BoePower {
  id:       number;
  tariffId: number;
  tariff:   Tariff | null;
  periods:  BoePowerPeriod[];
}

export interface BoePowerPeriod {
  id:         number;
  period:     Period;
  value:      number;
  boePowerId: number;
  boePower:   BoePower | null;
}

export interface OmieDistribution {
  id:         number;
  periodName: string;
  tariffId:   number;
  tariff:     Tariff | null;
  periods:    OmieDistributionPeriod[];
}

export interface OmieDistributionPeriod {
  id:                 number;
  period:             Period;
  factor:             number;
  omieDistributionId: number;
  omieDistribution:   OmieDistribution | null;
}

export interface Product {
  id:                   number;
  name:                 string;
  tariffId:             number;
  tariff:               Tariff | null;
  periods:              ProductPeriod[];
  isAvailable?:         boolean;
  commissionPercentage?: number | null;
}

export interface ProductPeriod {
  id:        number;
  period:    Period;
  value:     number;
  productId: number;
  product:   Product | null;
}
