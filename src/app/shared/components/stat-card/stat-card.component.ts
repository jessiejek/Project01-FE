import { Component, Input } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, cashOutline, statsChartOutline, alertCircleOutline, timeOutline, warningOutline, personRemoveOutline, checkmarkCircleOutline, medkitOutline, receiptOutline } from 'ionicons/icons';

@Component({
  selector: 'app-stat-card', standalone: true,
  imports: [NgIf, NgClass, IonIcon],
  templateUrl: './stat-card.component.html', styleUrl: './stat-card.component.scss'
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() icon = '';
  @Input() color: 'primary' | 'neutral' | 'success' | 'warning' | 'danger' = 'neutral';
  @Input() badgeLabel?: string;
  @Input() description?: string;
  @Input() loading = false;
  constructor() {
    addIcons({ calendarOutline, cashOutline, statsChartOutline, alertCircleOutline, timeOutline, warningOutline, personRemoveOutline, checkmarkCircleOutline, medkitOutline, receiptOutline });
  }
}
