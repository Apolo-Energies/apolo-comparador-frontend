import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-alta-rapida-gas',
  imports: [RouterOutlet],
  templateUrl: './alta-rapida-gas.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AltaRapidaGas {}
