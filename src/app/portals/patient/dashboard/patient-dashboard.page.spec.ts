import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ClinicSettingsService } from '../../../core/services/clinic-settings.service';
import { DoctorStateService } from '../../../core/services/doctor-state.service';
import { MedicalRecordsService } from '../../../core/services/medical-records.service';
import { PatientDashboardPage } from './patient-dashboard.page';
describe('Patient dashboard retry (mock API only)', () => {
  let api: jasmine.SpyObj<ApiService>;
  beforeEach(async () => {
    api = jasmine.createSpyObj('ApiService', ['get']);
    api.get.and.callFake((endpoint: string) => of(endpoint === 'patients/me' ? { id: 'test-patient' } : []) as any);
    await TestBed.configureTestingModule({ imports: [PatientDashboardPage], providers: [provideRouter([]),
      { provide: ApiService, useValue: api },
      { provide: AuthStateService, useValue: { currentUser$: of({ id: 'test-user', fullName: 'Test User' }) } },
      { provide: ClinicSettingsService, useValue: { settings$: of({ consentVersion: '1' }) } },
      { provide: DoctorStateService, useValue: { doctors$: new BehaviorSubject([]), isLoading$: of(false), setLoading: () => {}, normalizeDoctorRows: () => [], setDoctors: () => {} } },
      { provide: MedicalRecordsService, useValue: { mapConsultationRows: () => [], mapPrescriptionRows: () => [] } }
    ] }).overrideComponent(PatientDashboardPage, { set: { imports: [], template: '' } }).compileComponents();
  });
  it('shares profile and booking requests between dashboard sections', () => {
    const f = TestBed.createComponent(PatientDashboardPage); const sub = f.componentInstance.vm$.subscribe();
    expect(api.get.calls.allArgs().filter(a => a[0] === 'patients/me').length).toBe(1);
    expect(api.get.calls.allArgs().filter(a => a[0].startsWith('bookings/me')).length).toBe(1);
    sub.unsubscribe();
  });
  it('keeps failed profile data hidden while a retry is still pending', () => {
    api.get.and.returnValue(throwError(() => new Error('offline')));
    const f = TestBed.createComponent(PatientDashboardPage); const sub = f.componentInstance.vm$.subscribe();
    expect(f.componentInstance.loadErrors.has('profile')).toBeTrue();
    const request = new Subject<any>();
    api.get.and.callFake((endpoint: string) => (endpoint === 'patients/me' ? request : of([])) as any);
    f.componentInstance.retryDashboard(); expect(f.componentInstance.loadErrors.has('profile')).toBeTrue();
    request.next({ id: 'test-patient' }); request.complete();
    expect(f.componentInstance.loadErrors.has('profile')).toBeFalse(); sub.unsubscribe();
  });
});
