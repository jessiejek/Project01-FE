import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, checkmarkCircleOutline, medkitOutline, receiptOutline } from 'ionicons/icons';
import { BehaviorSubject, catchError, combineLatest, finalize, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { AuthUser, Booking, Consultation, Doctor, Patient, Prescription } from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ClinicSettingsService } from '../../../core/services/clinic-settings.service';
import { DoctorStateService } from '../../../core/services/doctor-state.service';
import { MedicalRecordsService } from '../../../core/services/medical-records.service';
import { BannerComponent } from '../../../shared/components/banner/banner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { DoctorCardComponent } from '../../public/components/doctor-card/doctor-card.component';
import { MedicalRecordCardComponent } from '../components/medical-record-card/medical-record-card.component';
import { PrescriptionCardComponent } from '../components/prescription-card/prescription-card.component';
import { UpcomingAppointmentCardComponent } from '../components/upcoming-appointment-card/upcoming-appointment-card.component';

interface DashboardVm {
  user: AuthUser | null;
  patient: Patient | undefined;
  upcomingBookings: Booking[];
  pendingProofBookings: Booking[];
  consultations: Consultation[];
  prescriptions: Prescription[];
  doctors: Doctor[];
  latestBooking?: Booking;
  latestBookingDoctor?: Doctor;
  recentConsultations: Array<{ consultation: Consultation; doctor?: Doctor }>;
  recentPrescriptions: Array<{ prescription: Prescription; doctor?: Doctor }>;
  showEmailWarning: boolean;
  showConsentWarning: boolean;
  upcomingCount: number;
  pendingProofCount: number;
  completedVisitCount: number;
  activePrescriptionCount: number;
}

@Component({
    selector: 'app-patient-dashboard-page',
  standalone: true,
  imports: [StatCardComponent,
    AsyncPipe,
    DatePipe,
    NgFor,
    NgIf,
    RouterLink,
    IonIcon,
    BannerComponent,
    EmptyStateComponent,
    DoctorCardComponent,
    UpcomingAppointmentCardComponent,
    MedicalRecordCardComponent,
    PrescriptionCardComponent
  ],
  templateUrl: './patient-dashboard.page.html',
  styleUrl: './patient-dashboard.page.scss'
})
export class PatientDashboardPage implements OnInit {
  constructor() {
    addIcons({ calendarOutline, checkmarkCircleOutline, medkitOutline, receiptOutline });
  }

  private readonly apiService = inject(ApiService);
  private readonly authState = inject(AuthStateService);
  private readonly clinicSettings = inject(ClinicSettingsService);
  private readonly doctorState = inject(DoctorStateService);
  private readonly medicalRecords = inject(MedicalRecordsService);
  private readonly router = inject(Router);

  readonly loadErrors = new Set<string>();
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  readonly currentUser$ = this.authState.currentUser$;
  readonly patient$ = this.reload$.pipe(
    switchMap(() => this.currentUser$),
    switchMap((user) =>
      user ? this.apiService.get<any>('patients/me').pipe(
        tap(() => this.loadErrors.delete('profile')),
        catchError(() => { this.loadErrors.add('profile'); return of(undefined); })
      ) : of(undefined)
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly patientBookings$ = this.patient$.pipe(
    switchMap((patient) =>
      patient
        ? this.apiService.get<any>('bookings/me?page=1&pageSize=100').pipe(
            map((data) =>
              mapDashboardBookings((data?.items ?? data ?? []) as Record<string, unknown>[], patient.id)
                .filter((booking) => !booking.patientId || booking.patientId === patient.id)
            ),
            tap(() => this.loadErrors.delete('appointments')),
            catchError(() => { this.loadErrors.add('appointments'); return of([] as Booking[]); })
          )
        : of([] as Booking[])
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly upcomingBookings$ = this.patientBookings$.pipe(
    map((bookings) =>
      bookings
        .filter(
          (booking) =>
            ['Confirmed', 'CheckedIn'].includes(booking.status) &&
            bookingDateTime(booking) >= Date.now()
        )
        .sort((a, b) => bookingDateTime(a) - bookingDateTime(b))
    )
  );

  readonly pendingProofBookings$ = this.patientBookings$.pipe(
    map((bookings) =>
      bookings
        .filter(
          (booking) =>
            booking.status === 'Completed' &&
            booking.paymentStatus === 'Unpaid' &&
            (booking.finalAmount ?? null) !== null &&
            (booking.finalAmount ?? 0) > 0
        )
        .sort((a, b) => bookingDateTime(a) - bookingDateTime(b))
    )
  );

  readonly doctors$ = this.doctorState.doctors$;
  readonly doctorsLoading$ = this.doctorState.isLoading$;

  vm$ = combineLatest([
    this.currentUser$,
    this.patient$,
    this.upcomingBookings$,
    this.pendingProofBookings$,
    this.doctors$
  ]).pipe(
    switchMap(([user, patient, upcomingBookings, pendingProofBookings, doctors]: [any, any, any, any, any]) => {
      if (!patient) {
        return of({
          user,
          patient,
          upcomingBookings,
          pendingProofBookings,
          consultations: [],
          prescriptions: [],
          doctors: (doctors ?? []).slice(0, 3),
          latestBooking: undefined,
          latestBookingDoctor: undefined,
          recentConsultations: [],
          recentPrescriptions: [],
          showEmailWarning: false,
          showConsentWarning: false,
          upcomingCount: 0,
          pendingProofCount: 0,
          completedVisitCount: 0,
          activePrescriptionCount: 0
        } satisfies DashboardVm);
      }

      return combineLatest([
        this.apiService.get<any[]>('medical-records/consultations?patientId=' + patient.id).pipe(
          map((rows) => this.medicalRecords.mapConsultationRows(rows ?? [])),
          tap(() => this.loadErrors.delete('medical records')),
          catchError(() => { this.loadErrors.add('medical records'); return of([] as Consultation[]); })
        ),
        this.apiService.get<any[]>('medical-records/prescriptions?patientId=' + patient.id).pipe(
          map((rows) => this.medicalRecords.mapPrescriptionRows(rows ?? [])),
          tap(() => this.loadErrors.delete('prescriptions')),
          catchError(() => { this.loadErrors.add('prescriptions'); return of([] as Prescription[]); })
        ),
        this.clinicSettings.settings$
      ]).pipe(
        map((result: [any, any, any]) => {
          const consultations = result[0];
          const prescriptions = result[1];
          const settings = result[2];
          // Build doctor lookup map from the already-loaded doctors array
          const doctorMap = new Map<string, Doctor>();
          for (const d of (doctors ?? [])) {
            doctorMap.set(d.id, d);
          }

          const latestBooking = (upcomingBookings ?? [])[0];
          const latestBookingDoctor = latestBooking
            ? doctorMap.get(latestBooking.doctorId)
            : undefined;

          return {
            user,
            patient,
            upcomingBookings: upcomingBookings ?? [],
            pendingProofBookings: pendingProofBookings ?? [],
            consultations: consultations ?? [],
            prescriptions: prescriptions ?? [],
            doctors: (doctors ?? []).slice(0, 3),
            latestBooking,
            latestBookingDoctor,
            recentConsultations: (consultations ?? []).slice(0, 2).map((consultation: any) => ({
              consultation,
              doctor: doctorMap.get(consultation.doctorId)
            })),
            recentPrescriptions: (prescriptions ?? []).slice(0, 2).map((prescription: any) => ({
              prescription,
              doctor: doctorMap.get(prescription.doctorId)
            })),
            showEmailWarning: (patient as any).isEmailVerified === false,
            showConsentWarning:
              (patient as any).consentVersion !== settings.consentVersion,
            upcomingCount: (upcomingBookings ?? []).length,
            pendingProofCount: (pendingProofBookings ?? []).length,
            completedVisitCount: (consultations ?? []).length,
            activePrescriptionCount: (prescriptions ?? []).filter((item: any) => item.status === 'Active').length
          } satisfies DashboardVm;
        })
      );
    })
  );

  retryDashboard(): void {
    this.reload$.next();
    this.loadDoctors();
  }

  ngOnInit(): void {
    this.loadDoctors();
  }

  private loadDoctors(): void {
    this.doctorState.setLoading(true);
    this.apiService
      .get<any[]>('doctors')
      .pipe(
        map((rows) => this.doctorState.normalizeDoctorRows(rows)),
        tap(() => this.loadErrors.delete('doctors')),
        catchError((error: unknown) => {
          this.loadErrors.add('doctors');
          return of([] as Doctor[]);
        }),
        finalize(() => this.doctorState.setLoading(false))
      )
      .subscribe((doctors) => this.doctorState.setDoctors(doctors));
  }

  canSubmitProof(booking: Booking): boolean {
    return (
      booking.paymentMode === 'Online' &&
      booking.paymentStatus === 'Unpaid' &&
      ['Pending', 'OnHold'].includes(booking.status)
    );
  }

  openBooking(bookingId: string): void {
    void this.router.navigate(['/patient/bookings', bookingId]);
  }

  showPhaseNineToast(): void {
    void this.router.navigate(['/patient/medical-records']);
  }

  showPhaseTenToast(): void {
    void this.router.navigate(['/patient/prescriptions']);
  }

  getWelcomeName(user: AuthUser | null): string {
    return user?.fullName?.split(' ')?.[0] ?? '';
  }
}

function mapDashboardBookings(rows: Record<string, unknown>[], patientId: string): Booking[] {
  return rows
    .map((row) => mapDashboardBookingRow(row, patientId))
    .filter((booking): booking is Booking => Boolean(booking));
}

function mapDashboardBookingRow(row: Record<string, unknown>, patientId: string): Booking | undefined {
  const id = trimOptionalString(row['id']) ?? trimOptionalString(row['booking_id']);
  if (!id) {
    return undefined;
  }

  const serviceNames = normalizeStringArray(row['serviceNames'] ?? row['service_names']);
  const services = normalizeServices(row['services']);
  const derivedServiceNames = serviceNames.length > 0
    ? serviceNames
    : services.map((service) => service.name).filter((name) => name.trim().length > 0);
  const serviceName = trimOptionalString(row['serviceName']) ?? trimOptionalString(row['service_name']) ?? derivedServiceNames[0] ?? 'Service';
  const serviceId = trimOptionalString(row['serviceId']) ?? trimOptionalString(row['service_id']) ?? services[0]?.id ?? '';
  const slotStartTime = normalizeTimeOnly(row['slotStartTime'] ?? row['slot_start_time']);
  const slotEndTime = normalizeTimeOnly(row['slotEndTime'] ?? row['slot_end_time']) || slotStartTime;

  return {
    id,
    patientId: trimOptionalString(row['patientId']) ?? trimOptionalString(row['patient_id']) ?? patientId,
    patientName: trimOptionalString(row['patientName']) ?? trimOptionalString(row['patient_name']) ?? undefined,
    doctorId: trimOptionalString(row['doctorId']) ?? trimOptionalString(row['doctor_id']) ?? '',
    doctorName: trimOptionalString(row['doctorName']) ?? trimOptionalString(row['doctor_name']) ?? undefined,
    serviceId,
    serviceIds: normalizeStringArray(row['serviceIds'] ?? row['service_ids']),
    serviceName,
    serviceNames: derivedServiceNames,
    services,
    appointmentDate: normalizeDateOnly(row['appointmentDate'] ?? row['appointment_date']),
    slotStartTime,
    slotEndTime,
    status: (trimOptionalString(row['status']) ?? trimOptionalString(row['booking_status']) ?? 'Pending') as Booking['status'],
    paymentStatus: (trimOptionalString(row['paymentStatus']) ?? trimOptionalString(row['payment_status']) ?? 'Unpaid') as Booking['paymentStatus'],
    paymentMode: (trimOptionalString(row['paymentMode']) ?? trimOptionalString(row['payment_mode']) ?? 'PayAtClinic') as Booking['paymentMode'],
    queueNumber: normalizeNullableNumber(row['queueNumber'] ?? row['queue_number']),
    totalFee: normalizeNumber(row['totalFee'] ?? row['total_fee']),
    finalAmount: normalizeNullableNumber(row['finalAmount'] ?? row['final_amount']),
    amountDue: normalizeNullableNumber(row['amountDue'] ?? row['amount_due']) ?? normalizeNullableNumber(row['finalAmount'] ?? row['final_amount']),
    consultationFeeSnapshot: normalizeNumber(row['consultationFeeSnapshot'] ?? row['consultation_fee_snapshot']),
    serviceFeeSnapshot: normalizeNumber(row['serviceFeeSnapshot'] ?? row['service_fee_snapshot']),
    isWalkIn: normalizeBoolean(row['isWalkIn'] ?? row['is_walk_in'], false),
    createdAt: trimOptionalString(row['createdAt'] ?? row['created_at']) ?? new Date().toISOString()
  };
}

function normalizeServices(value: unknown): Array<{ id: string; name: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        const name = item.trim();
        return name ? { id: '', name } : undefined;
      }

      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return undefined;
      }

      const row = item as Record<string, unknown>;
      const id = trimOptionalString(row['id']) ?? trimOptionalString(row['serviceId']) ?? '';
      const name = trimOptionalString(row['name']) ?? trimOptionalString(row['serviceName']) ?? '';
      return id || name ? { id, name } : undefined;
    })
    .filter((item): item is { id: string; name: string } => Boolean(item));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => trimOptionalString(item)).filter((item): item is string => Boolean(item));
}

function normalizeDateOnly(value: unknown): string {
  const raw = trimOptionalString(value);
  if (!raw) {
    return '';
  }

  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}

function normalizeTimeOnly(value: unknown): string {
  const raw = trimOptionalString(value);
  if (!raw) {
    return '';
  }

  return raw.length >= 5 ? raw.slice(0, 5) : raw;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  return fallback;
}

function trimOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function bookingDateTime(booking: Booking): number {
  const date = booking.appointmentDate?.trim() || '1970-01-01';
  const time = booking.slotStartTime?.trim() || '00:00';
  return new Date(`${date}T${time}:00`).getTime();
}
