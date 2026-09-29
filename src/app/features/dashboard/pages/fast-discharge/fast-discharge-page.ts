import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-fast-discharge',
  imports: [RouterOutlet],
  templateUrl: './fast-discharge-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FastDischarge {}
