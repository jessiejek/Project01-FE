import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { EMPTY, Subject, of, throwError } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ClinicDashboardRealtimeService } from '../../../core/services/clinic-dashboard-realtime.service';
import { DashboardPage } from './dashboard.page';
describe('Admin dashboard request states (mock API only)', () => {
  let api: jasmine.SpyObj<ApiService>;
  beforeEach(async () => {
    api = jasmine.createSpyObj('ApiService', ['get']);
    await TestBed.configureTestingModule({ imports: [DashboardPage], providers: [provideRouter([]),
      { provide: ApiService, useValue: api }, { provide: ClinicDashboardRealtimeService, useValue: { events$: EMPTY } },
      { provide: ToastController, useValue: {} }
    ] }).overrideComponent(DashboardPage, { set: { imports: [], template: '' } }).compileComponents();
  });
  it('keeps metrics loading while requests are pending', () => {
    api.get.and.returnValue(new Subject()); const f = TestBed.createComponent(DashboardPage);
    f.componentInstance.loadDashboard(); expect(f.componentInstance.isLoading).toBeTrue(); expect(f.componentInstance.hasLoadError).toBeFalse();
  });
  it('marks failures and clears them on a successful retry', () => {
    api.get.and.returnValue(throwError(() => new Error('offline'))); const f = TestBed.createComponent(DashboardPage);
    f.componentInstance.loadDashboard(); expect(f.componentInstance.hasLoadError).toBeTrue(); expect(f.componentInstance.isLoading).toBeFalse();
    api.get.and.returnValue(of([])); f.componentInstance.loadDashboard(); expect(f.componentInstance.hasLoadError).toBeFalse(); expect(f.componentInstance.isLoading).toBeFalse();
  });
});
