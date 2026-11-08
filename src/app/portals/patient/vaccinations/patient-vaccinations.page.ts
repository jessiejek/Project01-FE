import { DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { IonSearchbar, IonSpinner, ToastController } from '@ionic/angular/standalone';
import { PatientVaccinationDto } from '../../../core/models/vaccination.models';
import { PatientVaccinationsService } from '../../../core/services/patient-vaccinations.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-patient-vaccinations-page',
  standalone: true,
  imports: [DatePipe, NgFor, NgIf, IonSearchbar, IonSpinner, EmptyStateComponent],
  templateUrl: './patient-vaccinations.page.html',
  styles: [`
    .vac-card{margin-bottom:var(--space-4)}
    .vac-card__header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-3);gap:var(--space-3)}
    .vac-card__title h3{font-size:var(--text-lg);margin:0 0 4px}
    .vac-card__source{font-size:var(--text-xs);color:#6b21a8;background:#ede9fe;padding:2px 8px;border-radius:var(--radius-sm);display:inline-block}
    .vac-card__date{font-size:var(--text-sm);color:#64748b;white-space:nowrap;padding-top:2px}
    .vac-card__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-3);margin-bottom:var(--space-3)}
    .vac-card__grid div span{display:block;font-size:var(--text-xs);font-weight:600;color:#475569;text-transform:uppercase;margin-bottom:2px}
    .vac-card__grid div p{font-size:var(--text-sm);color:var(--clinic-text-primary);margin:0}
    .vac-card__notes{border-top:1px solid #e2e8f0;padding-top:var(--space-3);margin-bottom:var(--space-3);display:grid;gap:var(--space-2)}
    .vac-card__notes span{font-size:var(--text-xs);font-weight:600;color:#475569;text-transform:uppercase}
    .vac-card__notes p{font-size:var(--text-sm);margin:2px 0 0;color:#475569}
    .vac-card__meta span{font-size:var(--text-xs);color: var(--clinic-text-muted)}
    @media(max-width:640px){.vac-card__header{flex-direction:column}}
  `]
})
export class PatientVaccinationsPage implements OnInit {
  private readonly vaccinationService = inject(PatientVaccinationsService);
  private readonly toastCtrl = inject(ToastController);

  vaccinations: PatientVaccinationDto[] = [];
  filteredVaccinations: PatientVaccinationDto[] = [];
  loading = false;
  error = '';
  errorTitle = 'Unable to load records';
  searchTerm = '';

  ngOnInit(): void {
    this.loadVaccinations();
  }

  loadVaccinations(): void {
    this.loading = true;
    this.error = '';

    this.vaccinationService.getMyVaccinations().subscribe({
      next: (vaccinations) => {
        this.vaccinations = vaccinations;
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        this.vaccinations = [];
        this.filteredVaccinations = [];
        this.loading = false;
        this.error = extractMessage(err, 'Unable to load vaccination records. Please try again.');
        this.errorTitle = normalizeErrorTitle(this.error);
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.applyFilter();
  }

  formatSource(source: string): string {
    switch (source) {
      case 'AdministeredInClinic': return 'Administered In Clinic';
      case 'PatientReported': return 'Patient Reported';
      case 'ExternalRecord': return 'External Record';
      default: return source;
    }
  }

  private applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredVaccinations = [...this.vaccinations];
      return;
    }

    this.filteredVaccinations = this.vaccinations.filter((v) => {
      const haystack = [
        v.vaccineName,
        v.manufacturer,
        v.lotNumber,
        v.notes,
        v.reactionNotes,
        v.status,
        v.administeredDate
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }
}

function extractMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const apiError = error as { error?: { message?: unknown }; message?: unknown };
    const direct = apiError.error?.message ?? apiError.message;
    if (typeof direct === 'string' && direct.trim()) {
      return direct;
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function normalizeErrorTitle(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('not linked') || lower.includes('patient profile not found')) {
    return 'Patient profile not linked';
  }
  if (lower.includes('unauthorized') || lower.includes('forbidden')) {
    return 'Please sign in again';
  }
  return 'Unable to load records';
}
