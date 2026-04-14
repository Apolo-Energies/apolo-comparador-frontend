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
  products:          Product[];
  omieDistributions: OmieDistribution[];
  boePowers:         BoePower[];
}

export interface BoePower {
  id:       number;
  tariffId: number;
  periods:  BoePowerPeriod[];
}

export interface BoePowerPeriod {
  id:         number;
  period:     number;
  value:      number;
  boePowerId: number;
}

export interface OmieDistribution {
  id:         number;
  periodName: string;
  tariffId:   number;
  periods:    OmieDistributionPeriod[];
}

export interface OmieDistributionPeriod {
  id:                 number;
  period:             number;
  factor:             number;
  omieDistributionId: number;
}

export interface Product {
  id:       number;
  name:     string;
  tariffId: number;
  periods:  ProductPeriod[];
}

export interface ProductPeriod {
  id:        number;
  period:    number;
  value:     number;
  productId: number;
}
