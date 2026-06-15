import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EnergyType } from '../../../entities/energy-type.enum';
import { EnergyContextService } from '../../../services/energy-context.service';

@Component({
  selector: 'app-energy-type-toggle',
  standalone: true,
  templateUrl: './energy-type-toggle.component.html',
  styleUrl: './energy-type-toggle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnergyTypeToggleComponent {
  private readonly ctx = inject(EnergyContextService);

  readonly current = this.ctx.current;
  readonly EnergyType = EnergyType;

  select(value: EnergyType): void {
    if (this.current() === value) return;
    this.ctx.set(value);
  }
}
