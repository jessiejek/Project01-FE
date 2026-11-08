import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { IonSpinner, ToastController } from '@ionic/angular/standalone';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, filter, take } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { AvailabilityStatus, Booking, DayOfWeek, Doctor, DoctorDayStatus, DoctorSchedule } from '../../../core/models';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { DoctorTodaySummary } from '../../../core/services/booking.service';
import { ClinicDashboardRealtimeService } from '../../../core/services/clinic-dashboard-realtime.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  standalone: true,
  selector: 'app-doctor-dashboard-page',
  imports: [StatCardComponent,
    NgClass, NgFor, NgIf, FormsModule, RouterLink,
    AvatarComponent,
    IonSpinner, EmptyStateComponent, StatusBadgeComponent
  ],
  templateUrl: './doctor-dashboard.page.html',
  styleUrl: './doctor-dashboard.page.scss'
})
export class DoctorDashboardPage implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly authState = inject(AuthStateService);
  private readonly realtime = inject(ClinicDashboardRealtimeService);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);

  isLoading = true;
  savingStatus = false;
  readonly loadErrors = new Set<string>();
  doctor: Doctor | null = null;
  summary: { bookedToday: number; waiting: number; checkedIn: number; completed: number } | null = null;
  queueItems: Booking[] = [];
  schedule: DoctorSchedule[] = [];
  todayStatus: AvailabilityStatus = 'Available';
  greeting = '';
  runningLateMinutes = 15;
  private shiftTimerId: ReturnType<typeof setInterval> | null = null;

  get nextPatient(): Booking | null {
    const inClinic = this.queueItems.find((booking) => this.queueState(booking) === 'in_clinic');
    if (inClinic) {
      return inClinic;
    }

    const waiting = this.queueItems.find((booking) => this.queueState(booking) === 'waiting');
    return waiting ?? null;
  }

  get greetingSubtitle(): string {
    const now = new Date();
    const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now);
    const dateLabel = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(now);
    const todaySchedule = this.getScheduleForDate(now);
    const shiftLabel = todaySchedule
      ? `${this.formatTimeLabel(todaySchedule.startTime)}-${this.formatTimeLabel(todaySchedule.endTime)} shift`
      : 'No shift today';
    const specialization = this.doctor?.specialization || 'General Practice';
    return `${dayLabel}, ${dateLabel} - ${shiftLabel} - ${specialization}`;
  }

  get todaySchedule(): DoctorSchedule | null {
    return this.getScheduleForDate(new Date());
  }

  get tomorrowSchedule(): DoctorSchedule | null {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.getScheduleForDate(tomorrow);
  }

  ngOnInit(): void {
    this.setGreeting();
    this.shiftTimerId = setInterval(() => {
      this.greeting = this.greeting;
    }, 60000);
    this.destroyRef.onDestroy(() => {
      if (this.shiftTimerId) {
        clearInterval(this.shiftTimerId);
        this.shiftTimerId = null;
      }
    });
    this.authState.currentUser$
      .pipe(
        filter((user): user is NonNullable<typeof user> => Boolean(user)),
        take(1),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.loadDashboard());

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
          this.loadDashboard();
        }
      });
  }

  ionViewWillEnter(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.isLoading = true;
    this.loadErrors.clear();
    this.apiService.get<any>('doctors/me').pipe(
      map((data) => {
        if (!data) {
          throw new Error('Doctor profile not found.');
        }
        return mapDoctorRow(data as Record<string, unknown>);
      }),
      switchMap((doc) => {
        if (!doc) return of(null);
        this.doctor = doc;
        return forkJoin({
          summary: this.apiService.get<any[]>('bookings/doctor/today').pipe(
            switchMap((todayData) => {
              const queue = ((todayData ?? []) as Record<string, unknown>[])
                .map((row) => normalizeQueueBooking(row))
                .filter((booking): booking is Booking => Boolean(booking));
              return this.apiService.get<any>('bookings/doctor/today-summary').pipe(
                map((summaryResponse) => {
                  const row = (summaryResponse ?? {}) as Record<string, unknown>;
                  return {
                    bookedToday: normalizeNumber(row['bookedToday'], queue.length),
                    checkedIn: normalizeNumber(row['checkedIn']),
                    waiting: normalizeNumber(row['waiting']),
                    completed: normalizeNumber(row['completed']),
                    noShow: normalizeNumber(row['noShow']),
                    cancelled: normalizeNumber(row['cancelled']),
                    items: queue
                  } as DoctorTodaySummary;
                })
              );
            }),
            catchError(() => { this.loadErrors.add('queue'); return of(null); })
          ),
          schedule: this.apiService.get<any[]>('doctors/' + doc.id + '/schedule').pipe(
            map((data) => ((data ?? []) as Record<string, unknown>[]).map(mapDoctorScheduleRow)),
            catchError(() => { this.loadErrors.add('schedule'); return of([] as DoctorSchedule[]); })
          ),
          dayStatus: this.apiService.get<any[]>('doctors/' + doc.id + '/day-status').pipe(
            map((data) => {
              const rows = (data ?? []) as Record<string, unknown>[];
              const today = new Date().toISOString().slice(0, 10);
              const match = rows.find((r) => (r['date'] ?? r['targetDate'] ?? r['target_date']) === today);
              return match
                ? mapDoctorDayStatusRow(match)
                : { id: '', doctorId: doc.id, date: today, status: 'Available' as AvailabilityStatus };
            }),
            catchError(() => { this.loadErrors.add('availability'); return of(null as DoctorDayStatus | null); })
          )
        });
      }),
      catchError(() => { this.doctor = null; return of(null); }),
      finalize(() => (this.isLoading = false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((result) => {
      if (!result || !this.doctor) return;
      this.summary = result.summary ? { bookedToday: result.summary.bookedToday, waiting: result.summary.waiting, checkedIn: result.summary.checkedIn, completed: result.summary.completed } : null;
      this.queueItems = (result.summary?.items ?? []).sort((a, b) => (a.queueNumber ?? 999) - (b.queueNumber ?? 999));
      this.schedule = result.schedule;
      this.todayStatus = result.dayStatus?.status ?? 'Available';
    });
  }

  updateStatus(status: AvailabilityStatus): void {
    if (!this.doctor || this.savingStatus) return;
    this.savingStatus = true;
    this.apiService.post<any>('doctors/' + this.doctor.id + '/day-status', {
      date: this.todayStr(),
      status,
      runningLateMinutes: status === 'RunningLate' ? this.runningLateMinutes : null
    }).pipe(
      map((data) => mapDoctorDayStatusRow((data ?? {}) as Record<string, unknown>)),
      catchError(() => { this.showToast('Failed to update status.', 'danger'); return of(null); }),
      finalize(() => this.savingStatus = false),
      takeUntilDestroyed(this.destroyRef)
    )
      .subscribe((res) => {
        if (!res) return;
        this.todayStatus = res.status as AvailabilityStatus;
        this.loadErrors.delete('availability');
        this.showToast(`Status: ${this.label(status)}`, 'success');
      });
  }

  openAppointment(id: string): void {
    this.router.navigate(['/doctor/appointments', id]);
  }

  startConsult(bookingId: string): void {
    void this.router.navigate(['/doctor/appointments', bookingId]);
  }

  viewChart(patientId: string): void {
    void this.router.navigate(['/doctor/patients', patientId]);
  }

  queueItemClass(booking: Booking): Record<string, boolean> {
    const status = this.queueState(booking);
    return {
      'qi--completed': status === 'completed',
      'qi--in-clinic': status === 'in_clinic',
      'qi--waiting': status === 'waiting'
    };
  }

  displayQueueService(booking: Booking): string {
    return (
      booking.serviceNames?.join(', ')
      || booking.serviceName
      || booking.service?.name
      || booking.services?.map((service) => service.name).filter(Boolean).join(', ')
      || 'General Consultation'
    );
  }

  formatTimeLabel(value: string): string {
    const trimmed = value?.trim();
    if (!trimmed) {
      return '--:--';
    }

    const [hours = '0', minutes = '00'] = trimmed.split(':');
    const hour = Number(hours);
    const normalizedHour = Number.isFinite(hour) ? hour : 0;
    const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
    const hour12 = ((normalizedHour + 11) % 12) + 1;
    return `${hour12}:${minutes.padStart(2, '0')} ${suffix}`;
  }

  getScheduleForDate(date: Date): DoctorSchedule | null {
    if (!this.schedule.length) {
      return null;
    }

    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
    return this.schedule.find((schedule) => schedule.dayOfWeek.toLowerCase() === dayName.toLowerCase()) ?? null;
  }

  getShiftProgress(schedule: DoctorSchedule | null): number {
    if (!schedule) {
      return 0;
    }

    const { start, end, now } = this.getShiftTimes(schedule);
    if (!start || !end) {
      return 0;
    }

    const total = end.getTime() - start.getTime();
    if (total <= 0) {
      return 0;
    }

    const progress = ((now.getTime() - start.getTime()) / total) * 100;
    return Math.max(0, Math.min(100, progress));
  }

  getShiftRemaining(schedule: DoctorSchedule | null): string {
    if (!schedule) {
      return 'No shift scheduled';
    }

    const { end, now } = this.getShiftTimes(schedule);
    if (!end) {
      return 'No shift scheduled';
    }

    const remainingMinutes = Math.max(0, Math.round((end.getTime() - now.getTime()) / 60000));
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    if (hours >= 2) {
      return `${hours}h remaining`;
    }
    return `${hours}h ${minutes}m remaining`;
  }

  getTomorrowScheduleLabel(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(tomorrow);
    const schedule = this.tomorrowSchedule;
    return schedule
      ? `${dayLabel} - ${this.formatTimeLabel(schedule.startTime)} - ${this.formatTimeLabel(schedule.endTime)}`
      : `${dayLabel} - Day off`;
  }

  private setGreeting(): void {
    const h = new Date().getHours();
    this.greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  private normalizeStatus(status: string | null | undefined): string {
    return (status || '')
      .toString()
      .trim()
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/\s+/g, '_')
      .toLowerCase();
  }

  private queueState(booking: Booking): 'waiting' | 'in_clinic' | 'completed' | 'other' {
    const status = this.normalizeStatus(booking.status);
    if (['completed', 'done', 'done_for_today'].includes(status)) {
      return 'completed';
    }
    if (['checked_in', 'in_progress', 'in_clinic', 'consulting'].includes(status)) {
      return 'in_clinic';
    }
    if (['waiting', 'confirmed', 'pending', 'proof_submitted'].includes(status)) {
      return 'waiting';
    }
    return 'other';
  }

  private getShiftTimes(schedule: DoctorSchedule): { start: Date | null; end: Date | null; now: Date } {
    const now = new Date();
    const [startHour = '0', startMinute = '0'] = schedule.startTime.split(':');
    const [endHour = '0', endMinute = '0'] = schedule.endTime.split(':');
    const start = new Date(now);
    start.setHours(Number(startHour), Number(startMinute), 0, 0);
    const end = new Date(now);
    end.setHours(Number(endHour), Number(endMinute), 0, 0);
    return { start, end, now };
  }

  private label(s: AvailabilityStatus): string {
    return s === 'RunningLate' ? 'Running Late' : s === 'UnavailableToday' ? 'Unavailable Today' : 'Available';
  }

  private todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  private async showToast(msg: string, color: string = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 1800, color, position: 'top' });
    await t.present();
  }
}

function mapDoctorRow(row: Record<string, unknown>): Doctor {
  return {
    id: resolveStr(row, 'id') ?? '',
    userId: resolveStr(row, 'userId') ?? '',
    fullName: resolveStr(row, 'fullName') ?? 'Doctor',
    specialization: resolveStr(row, 'specialization') ?? '',
    bio: resolveStr(row, 'bio'),
    profilePhotoUrl: resolveStr(row, 'profilePhotoUrl') ?? resolveStr(row, 'profile_photo_url'),
    licenseNumber: resolveStr(row, 'licenseNumber') ?? '',
    ptrNumber: resolveStr(row, 'ptrNumber') ?? '',
    s2Number: resolveStr(row, 's2Number') ?? '',
    consultationFee: resolveNum(row, 'consultationFee') ?? 0,
    slotDurationMinutes: resolveNum(row, 'slotDurationMinutes') ?? 30,
    slotCapacity: resolveNum(row, 'slotCapacity') ?? 1,
    dailyPatientLimit: resolveNum(row, 'dailyPatientLimit') ?? null,
    status: (resolveStr(row, 'status') as Doctor['status']) ?? 'Active',
    averageRating: resolveNum(row, 'averageRating') ?? undefined,
    reviewCount: resolveNum(row, 'reviewCount') ?? undefined,
  };
}

function mapDoctorScheduleRow(row: Record<string, unknown>): DoctorSchedule {
  return {
    id: resolveStr(row, 'id') ?? '',
    doctorId: resolveStr(row, 'doctorId') ?? '',
    dayOfWeek: normalizeDayOfWeek(resolveStr(row, 'dayOfWeek')),
    startTime: normalizeTime(resolveStr(row, 'startTime')),
    endTime: normalizeTime(resolveStr(row, 'endTime')),
  };
}

function mapDoctorDayStatusRow(row: Record<string, unknown>): DoctorDayStatus {
  return {
    id: resolveStr(row, 'id') ?? '',
    doctorId: resolveStr(row, 'doctorId') ?? '',
    date: resolveStr(row, 'date') ?? resolveStr(row, 'targetDate') ?? '',
    status: (resolveStr(row, 'status') as AvailabilityStatus) ?? 'Available',
    runningLateMinutes: resolveNum(row, 'runningLateMinutes') ?? undefined,
  };
}

function normalizeDayOfWeek(value: string | undefined): DayOfWeek {
  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  if (!value) return 'Monday';
  const normalized = value.trim().toLowerCase();
  return days.find((d) => d.toLowerCase() === normalized) ?? 'Monday';
}

function normalizeTime(value: string | undefined): string {
  if (!value) return '00:00';
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function resolveStr(row: Record<string, unknown>, key: string): string | undefined {
  const snake = key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
  const val = row[key] ?? row[snake];
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  return trimmed || undefined;
}

function resolveNum(row: Record<string, unknown>, key: string): number | null {
  const snake = key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
  const val = row[key] ?? row[snake];
  if (val === null || val === undefined) return null;
  if (typeof val === 'number' && isFinite(val)) return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    if (isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeQueueBooking(row: Record<string, unknown>): Booking | undefined {
  const id = trimOptionalString(row['id'] ?? row['booking_id'] ?? row['bookingId']);
  if (!id) {
    return undefined;
  }

  const appointmentDate = trimOptionalString(row['appointmentDate'] ?? row['appointment_date']) ?? '';
  const slotStartTime = trimOptionalString(row['slotStartTime'] ?? row['slot_start_time']) ?? '';
  const slotEndTime = trimOptionalString(row['slotEndTime'] ?? row['slot_end_time']) ?? slotStartTime;

  const patient = typeof row['patient'] === 'object' && row['patient'] !== null ? (row['patient'] as Record<string, unknown>) : null;
  const doctor = typeof row['doctor'] === 'object' && row['doctor'] !== null ? (row['doctor'] as Record<string, unknown>) : null;

  return {
    id,
    patientId: trimOptionalString(row['patientId'] ?? row['patient_id']) ?? trimOptionalString(patient?.['id']) ?? '',
    patientName:
      trimOptionalString(row['patientName'] ?? row['patient_name']) ?? trimOptionalString(patient?.['fullName']) ?? 'Patient',
    doctorId: trimOptionalString(row['doctorId'] ?? row['doctor_id']) ?? trimOptionalString(doctor?.['id']) ?? '',
    doctorName:
      trimOptionalString(row['doctorName'] ?? row['doctor_name']) ?? trimOptionalString(doctor?.['fullName']) ?? 'Doctor',
    serviceId: trimOptionalString(row['serviceId'] ?? row['service_id']) ?? '',
    serviceName: trimOptionalString(row['serviceName'] ?? row['service_name']),
    serviceNames: normalizeTextArray(row['serviceNames'] ?? row['service_names']),
    services: normalizeServices(row['services']),
    appointmentDate,
    slotStartTime,
    slotEndTime,
    status: (trimOptionalString(row['status']) as Booking['status']) ?? 'Pending',
    paymentStatus: (trimOptionalString(row['paymentStatus'] ?? row['payment_status']) as Booking['paymentStatus']) ?? 'Unpaid',
    paymentMode: (trimOptionalString(row['paymentMode'] ?? row['payment_mode']) as Booking['paymentMode']) ?? 'PayAtClinic',
    queueNumber: normalizeNullableNumber(row['queueNumber'] ?? row['queue_number']),
    totalFee: normalizeNumber(row['totalFee'] ?? row['total_fee']),
    consultationFeeSnapshot: normalizeNumber(row['consultationFeeSnapshot'] ?? row['consultation_fee_snapshot']),
    serviceFeeSnapshot: normalizeNumber(row['serviceFeeSnapshot'] ?? row['service_fee_snapshot']),
    isWalkIn: normalizeBoolean(row['isWalkIn'] ?? row['is_walk_in']),
    createdAt: trimOptionalString(row['createdAt'] ?? row['created_at']) ?? new Date().toISOString(),
    finalAmount: normalizeNullableNumber(row['finalAmount'] ?? row['final_amount']),
    amountDue: normalizeNullableNumber(row['amountDue'] ?? row['amount_due']),
    isProfessionalFeeWaived: normalizeBooleanOrUndefined(row['isProfessionalFeeWaived'] ?? row['is_professional_fee_waived']),
    professionalFeeWaivedReason: trimOptionalString(row['professionalFeeWaivedReason'] ?? row['professional_fee_waived_reason'])
  };
}

function trimOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (value == null) {
    return undefined;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function normalizeTextArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.map((entry) => trimOptionalString(entry)).filter((entry): entry is string => Boolean(entry));
  return items.length > 0 ? items : undefined;
}

function normalizeServices(value: unknown): Booking['services'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const row = entry as Record<string, unknown>;
      const id = trimOptionalString(row['id'] ?? row['service_id']);
      const name = trimOptionalString(row['name'] ?? row['service_name']);
      return id && name ? { id, name } : null;
    })
    .filter((entry): entry is NonNullable<Booking['services']>[number] => Boolean(entry));
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const text = trimOptionalString(value);
  if (!text) {
    return fallback;
  }

  const num = Number(text);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeNullableNumber(value: unknown): number | null {
  const text = trimOptionalString(value);
  if (!text) {
    return null;
  }

  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const text = trimOptionalString(value);
  if (!text) {
    return false;
  }

  return text.toLowerCase() === 'true' || text === '1';
}

function normalizeBooleanOrUndefined(value: unknown): boolean | undefined {
  if (value == null) {
    return undefined;
  }

  return normalizeBoolean(value);
}
