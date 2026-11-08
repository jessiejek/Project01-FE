import { AsyncPipe, CurrencyPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { Router } from '@angular/router';
import { BaseComponent } from '../../../core/base/base.component';
import { ClinicDashboardRealtimeService } from '../../../core/services/clinic-dashboard-realtime.service';
import { TodayAppointmentsTableComponent } from '../components/today-appointments-table/today-appointments-table.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [
    AsyncPipe, CurrencyPipe, DatePipe, NgFor, NgIf,
    StatCardComponent, TodayAppointmentsTableComponent,
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss'
})
export class DashboardPage extends BaseComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly realtime = inject(ClinicDashboardRealtimeService);


  bookings: any[] = [];
  doctors: any[] = [];
  patients: any[] = [];
  services: any[] = [];
  todaysBookings: any[] = [];
  isLoading = false;

  todayAppointmentsCount = 0;
  monthlyAppointmentsCount = 0;
  revenueToday = 0;
  pendingVerificationCount = 0;
  onHoldCount = 0;
  unpaidCompletedCount = 0;
  noShowCount = 0;
  followUpsCount = 0;
  topDoctorStats: Array<{ label: string; value: number; max: number }> = [];

  ngOnInit(): void {
    this.loadDashboard();

    this.realtime.events$
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((event: any) => {
        const name = event.eventName;
        if (
          name === 'BookingCreated' ||
          name === 'BookingCancelled' ||
          name === 'PatientCheckedIn' ||
          name === 'DoctorCompletedConsultation' ||
          name === 'PaymentCompleted' ||
          name === 'PaymentWaived'
        ) {
          this.loadDashboard();
        }
      });
  }

  private loadDashboard(): void {
    this.isLoading = true;
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';

    forkJoin([
      this.api.get<any[]>('bookings?status=CheckedIn&pageSize=1'),
      this.api.get<any[]>('bookings?fromDate=' + encodeURIComponent(monthStart) + '&toDate=' + encodeURIComponent(today) + '&pageSize=1000'),
      this.api.get<any[]>('doctors'),
      this.api.get<any[]>('patients?pageSize=1000'),
      this.api.get<any[]>('services'),
    ]).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
      next: ([staffToday, monthBookings, doctorsList, patientsList, servicesList]) => {
        const todayRows = staffToday || [];
        const monthRows = monthBookings || [];

      this.doctors = (doctorsList || []).map((d: any) => ({ id: d.id, fullName: d.full_name }));
      this.patients = (patientsList || []).map((p: any) => ({ id: p.id, firstName: p.first_name, lastName: p.last_name }));
      this.services = (servicesList || []).map((s: any) => ({ id: s.id, name: s.name }));

      this.todayAppointmentsCount = todayRows.length;
      this.monthlyAppointmentsCount = monthRows.length;

      const todayStr = new Date().toISOString().slice(0, 10);
      this.todaysBookings = todayRows.map((r: any) => ({
        id: r.booking_id || r.id,
        patientId: r.patient_id,
        doctorId: r.doctor_id,
        serviceId: r.service_id,
        patientName: r.patient_name,
        doctorName: r.doctor_name,
        serviceName: r.service_name,
        serviceNames: r.service_names || [],
        appointmentDate: r.appointment_date || todayStr,
        slotStartTime: r.slot_start_time || '',
        slotEndTime: r.slot_end_time || '',
        status: r.booking_status || r.status,
        paymentStatus: r.payment_status || 'Unpaid',
        paymentMode: r.payment_mode || 'PayAtClinic',
        queueNumber: r.queue_number,
        totalFee: r.total_fee || 0,
      }));

      this.pendingVerificationCount = todayRows.filter((r: any) => r.booking_status === 'ProofSubmitted').length;
      this.onHoldCount = monthRows.filter((r: any) => r.booking_status === 'OnHold').length;
      this.unpaidCompletedCount = monthRows.filter((r: any) => r.booking_status === 'Completed' && r.payment_status === 'Unpaid').length;
      this.noShowCount = todayRows.filter((r: any) => r.booking_status === 'NoShow').length;

      // Revenue from today's completed bookings
      this.revenueToday = todayRows
        .filter((r: any) => r.booking_status === 'Completed')
        .reduce((sum: number, r: any) => sum + (r.total_fee || 0), 0);

      // Most booked doctors from monthly data
      const docCounts = new Map<string, { name: string; count: number }>();
      for (const r of monthRows) {
        const id = r.doctor_id;
        if (!id) continue;
        const entry = docCounts.get(id) || { name: r.doctor_name || 'Unknown', count: 0 };
        entry.count++;
        docCounts.set(id, entry);
      }
      const sortedDocs = [...docCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
      const maxCount = sortedDocs.length ? Math.max(...sortedDocs.map((d) => d.count), 1) : 1;
      this.topDoctorStats = sortedDocs.map((d) => ({ label: d.name, value: d.count, max: maxCount }));

      this.isLoading = false;
    },
    error: () => {
      this.todaysBookings = [];
      this.isLoading = false;
    }
  });
  }

  handleTableAction(event: { action: string; id: string }): void {
    if (event.action === 'view') {
      void this.openBooking(event.id);
    }
  }

  openBooking(id: string): void {
    if (!id) return;
    void this.router.navigate(['/admin/bookings', id]);
  }

}
