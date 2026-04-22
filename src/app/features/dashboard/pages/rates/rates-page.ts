import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ProviderService } from '../../../../services/provider.service';
import { Provider } from '../../../../entities/provider.model';
import { TabType } from '../../../../entities/rates.model';
import { LucideAngularModule, Building, Calculator, TrendingUp, Zap, Download } from 'lucide-angular';

// Tab components
import { ProviderTabComponent } from './components/provider-tab.component';
import { TariffsTabComponent } from './components/tariffs-tab.component';
import { OmieDistributionTabComponent } from './components/omie-distribution-tab.component';
import { BoePowerTabComponent } from './components/boe-power-tab.component';

@Component({
  selector: 'app-rates-page',
  standalone: true,
  imports: [
    LucideAngularModule,
    ProviderTabComponent,
    TariffsTabComponent,
    OmieDistributionTabComponent,
    BoePowerTabComponent,
  ],
  templateUrl: './rates-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatesPageComponent {
  private readonly providerService = inject(ProviderService);

  // Tab icons
  readonly BuildingIcon = Building;
  readonly CalculatorIcon = Calculator;
  readonly TrendingUpIcon = TrendingUp;
  readonly ZapIcon = Zap;
  readonly DownloadIcon = Download;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<TabType>('provider');

  // Data cargada una sola vez
  readonly providerData = signal<Provider | null>(null);

  readonly providerName = computed(() => this.providerData()?.name || '');
  readonly tariffsCount = computed(() => this.providerData()?.tariffs?.length || 0);

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.providerService.getByUser().subscribe({
      next: (response) => {
        console.log('Provider data received:', response);
        this.providerData.set(response);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Error al cargar los datos del proveedor');
        this.loading.set(false);
        console.error('Error loading provider data:', err);
      },
    });
  }

  setActiveTab(tab: TabType): void {
    this.activeTab.set(tab);
  }

  onExportExcel(): void {
    // TODO: Implementar exportación a Excel
    console.log('Exportando a Excel...');
  }
}
