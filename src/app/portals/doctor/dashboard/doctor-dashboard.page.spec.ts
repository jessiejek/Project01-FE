import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { Subject, EMPTY } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ClinicDashboardRealtimeService } from '../../../core/services/clinic-dashboard-realtime.service';
import { DoctorDashboardPage } from './doctor-dashboard.page';
describe('Doctor availability feedback (mock API only)', () => {
  let api: jasmine.SpyObj<ApiService>;
  beforeEach(async () => {
    api = jasmine.createSpyObj('ApiService', ['post']);
    await TestBed.configureTestingModule({ imports: [DoctorDashboardPage], providers: [provideRouter([]),
      { provide: ApiService, useValue: api }, { provide: AuthStateService, useValue: {} },
      { provide: ClinicDashboardRealtimeService, useValue: { events$: EMPTY } },
      { provide: ToastController, useValue: { create: async () => ({ present: async () => {} }) } }
    ] }).overrideComponent(DoctorDashboardPage, { set: { imports: [], template: '' } }).compileComponents();
  });
  it('prevents duplicate saves and releases the button after failure', () => {
    const request = new Subject<any>(); api.post.and.returnValue(request);
    const f = TestBed.createComponent(DoctorDashboardPage); f.componentInstance.doctor = { id: 'test-doctor' } as any;
    f.componentInstance.updateStatus('Available'); f.componentInstance.updateStatus('Available');
    expect(api.post).toHaveBeenCalledTimes(1); expect(f.componentInstance.savingStatus).toBeTrue();
    request.error(new Error('offline')); expect(f.componentInstance.savingStatus).toBeFalse();
  });
});
