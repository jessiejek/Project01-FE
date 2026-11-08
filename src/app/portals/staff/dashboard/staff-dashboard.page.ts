import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { NgFor, NgIf } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cashOutline } from 'ionicons/icons';
import { catchError, finalize, map, of } from 'rxjs';
import { Booking, Doctor, Patient } from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';
import { BookingService } from '../../../core/services/booking.service';
import { ClinicDashboardRealtimeService } from '../../../core/services/clinic-dashboard-realtime.service';
import { DoctorStateService } from '../../../core/services/doctor-state.service';
import { PatientStateService } from '../../../core/services/patient-state.service';
import { QueueTableComponent } from '../components/queue-table/queue-table.component';

@Component({
  selector: 'app-staff-dashboard-page',
  standalone: true,
  imports: [StatCardComponent, NgFor, NgIf, IonIcon, QueueTableComponent],
  templateUrl: './staff-dashboard.page.html',
  styleUrl: './staff-dashboard.page.scss'
})
export class StaffDashboardPage implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly bookingService = inject(BookingService);
  private readonly realtime = inject(ClinicDashboardRealtimeService);
  private readonly doctorState = inject(DoctorStateService);
  private readonly patientState = inject(PatientStateService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  todaysBookings: Booking[] = [];
  doctors: Doctor[] = [];
  patients: Patient[] = [];
  bookingsLoading = false;
  doctorsLoading = false;
  patientsLoading = false;

  get isLoading(): boolean {
    return this.bookingsLoading || this.doctorsLoading || this.patientsLoading;
  }

  get todaysAppointmentsCount(): number {
    return this.todaysBookings.length;
  }

  get walkInsTodayCount(): number {
    return this.todaysBookings.filter((booking) => booking.isWalkIn).length;
  }

  get confirmedTodayCount(): number {
    return this.todaysBookings.filter((booking) => booking.status === 'CheckedIn').length;
  }

  get completedUnpaidCount(): number {
    return this.todaysBookings.filter(
      (booking) => booking.status === 'Completed' && booking.paymentStatus === 'Unpaid'
    ).length;
  }

  constructor() {
    addIcons({ cashOutline });
  }

  ngOnInit(): void {
    this.doctorState.doctors$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((doctors: any) => (this.doctors = doctors));

    this.patientState.patients$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((patients: any) => (this.patients = patients));

    this.bookingService.isLoading$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((bookingsLoading: any) => {
      this.bookingsLoading = bookingsLoading;
    });
    this.doctorState.isLoading$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((doctorsLoading: any) => {
      this.doctorsLoading = doctorsLoading;
    });
    this.patientState.isLoading$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((patientsLoading: any) => {
      this.patientsLoading = patientsLoading;
    });

    // Realtime: auto-refresh dashboard on booking events
    this.realtime.events$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: any) => {
        if ([
          'BookingCreated',
          'BookingCancelled',
          'PatientCheckedIn',
          'PatientCheckInUndone',
          'DoctorCompletedConsultation',
          'PaymentCompleted',
          'PaymentWaived'
        ].includes(event.eventName)) {
          this.refreshDashboardBookings();
        }
      });

    this.refreshDashboardData();
  }

  ionViewWillEnter(): void {
    this.refreshDashboardData();
  }

  goToPaymentQueue(): void {
    void this.router.navigate(['/staff/payments']);
  }

  openBooking(bookingId: string): void {
    void this.router.navigate(['/staff/bookings', bookingId]);
  }

  onQueueAction(event: { action: string; bookingId: string }): void {
    switch (event.action) {
      case 'check-in':
        this.apiService.patch('bookings/' + event.bookingId + '/check-in', {}).subscribe();
        break;
      case 'undo-check-in':
        this.apiService.patch('bookings/' + event.bookingId + '/undo-check-in', {}).subscribe();
        break;
      case 'collect-payment':
        void this.goToPaymentQueue();
        break;
    }
  }

  private refreshDashboardBookings(): void {
    this.loadTodaysBookings();
  }

  private refreshDashboardData(): void {
    this.loadTodaysBookings();
    this.loadDoctors();
    this.patientState.refresh();
  }

  private loadTodaysBookings(): void {
    this.bookingService
      .getStaffTodayBookings({ page: 1, pageSize: 500 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.todaysBookings = result.items;
        },
        error: () => {
          this.todaysBookings = [];
        }
      });
  }

  private loadDoctors(): void {
    this.doctorState.setLoading(true);
    this.apiService
      .get<any[]>('doctors')
      .pipe(
        map((rows) => this.doctorState.normalizeDoctorRows(rows)),
        catchError((error: unknown) => {
          console.warn('Failed to load doctors:', error);
          return of([] as Doctor[]);
        }),
        finalize(() => this.doctorState.setLoading(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((doctors) => {
        this.doctors = doctors;
        this.doctorState.setDoctors(doctors);
      });
  }
}
