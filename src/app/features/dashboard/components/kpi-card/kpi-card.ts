import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  imports: [DecimalPipe],
  templateUrl: './kpi-card.html',
  styleUrl: './kpi-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly unit = input<string>('');
  readonly icon = input<string>('analytics');
  readonly tone = input<'primary' | 'info' | 'warning' | 'danger'>('primary');

  readonly isNumeric = computed(() => typeof this.value() === 'number');
}
