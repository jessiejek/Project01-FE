import { BehaviorSubject, Observable, catchError, of, shareReplay, switchMap } from 'rxjs';
import { LoadState, loadState } from '../../../shared/utils/load-state';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ServiceCategory } from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';
import { AnnouncementCardComponent } from '../components/announcement-card/announcement-card.component';
import { DoctorCardComponent } from '../components/doctor-card/doctor-card.component';
import { HeroSectionComponent } from '../components/hero-section/hero-section.component';
import { OperatingHoursBarComponent } from '../components/operating-hours-bar/operating-hours-bar.component';
import { ServiceCategoryCardComponent } from '../components/service-category-card/service-category-card.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    NgIf, EmptyStateComponent, SkeletonComponent,
    NgFor,
    AsyncPipe,
    RouterLink,
    HeroSectionComponent,
    OperatingHoursBarComponent,
    DoctorCardComponent,
    ServiceCategoryCardComponent,
    AnnouncementCardComponent
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss'
})
export class HomePage {
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);

  private readonly reload$ = new BehaviorSubject<void>(undefined);
  readonly doctorsState$ = this.collectionState('doctors');
  readonly servicesState$ = this.collectionState('services');
  readonly announcementsState$ = this.collectionState('announcements');
  readonly settings$ = this.reload$.pipe(
    switchMap(() => this.apiService.get<any>('settings').pipe(catchError(() => of(null))))
  );

  retry(): void { this.reload$.next(); }

  private collectionState(endpoint: string): Observable<LoadState<any[]>> {
    return this.reload$.pipe(
      switchMap(() => loadState(() => this.apiService.get<any[]>(endpoint), [])),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  readonly categoryRows: { key: ServiceCategory; description: string }[] = [
    {
      key: 'Consultation',
      description: 'Primary care, follow-ups, and medical advice tailored to you.'
    },
    {
      key: 'Procedure',
      description: 'Minor procedures performed safely in-clinic by our specialists.'
    },
    {
      key: 'Laboratory',
      description: 'Blood work and lab tests with reliable turnaround times.'
    },
    {
      key: 'Diagnostic',
      description: 'Imaging and screening to support accurate diagnosis.'
    }
  ];

  countFor(services: { category: ServiceCategory }[], cat: ServiceCategory): number {
    return services.filter((s) => s.category === cat).length;
  }

  onCategorySelect(category: ServiceCategory): void {
    this.router.navigate(['/public/services'], { queryParams: { category } });
  }
}
