import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personOutline, starOutline } from 'ionicons/icons';
import { Doctor } from '../../../../core/models';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { PesoPipe } from '../../../../shared/pipes/peso.pipe';

@Component({
  selector: 'app-doctor-card',
  standalone: true,
  imports: [RouterLink, IonIcon, AvatarComponent, StatusBadgeComponent, PesoPipe],
  templateUrl: './doctor-card.component.html',
  styleUrl: './doctor-card.component.scss'
})
export class DoctorCardComponent {
  @Input({ required: true }) doctor!: Doctor;

  constructor() {
    addIcons({ personOutline, starOutline });
  }
}
