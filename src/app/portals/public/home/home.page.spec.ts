import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { HomePage } from './home.page';
describe('Public home request states (mock API only)', () => {
  let doctors: Subject<any[]>;
  beforeEach(async () => {
    doctors = new Subject<any[]>();
    const api = { get: (endpoint: string) => endpoint === 'doctors' ? doctors : of(endpoint === 'settings' ? null : []) };
    await TestBed.configureTestingModule({ imports: [HomePage], providers: [provideRouter([]), { provide: ApiService, useValue: api }] }).compileComponents();
  });
  it('shows doctor placeholders while waiting', () => {
    const f = TestBed.createComponent(HomePage); f.detectChanges();
    expect(f.nativeElement.querySelector('[aria-label="Loading doctors"]')).not.toBeNull();
    expect(f.nativeElement.textContent).not.toContain('No doctors listed yet');
  });
  it('shows a genuine empty state after a successful empty response', () => {
    const f = TestBed.createComponent(HomePage); f.detectChanges(); doctors.next([]); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No doctors listed yet');
    expect(f.nativeElement.querySelector('[aria-label="Loading doctors"]')).toBeNull();
  });
  it('offers retry after failure and recovers', () => {
    const f = TestBed.createComponent(HomePage); f.detectChanges(); doctors.error(new Error('offline')); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Doctors could not be loaded');
    doctors = new Subject<any[]>(); f.componentInstance.retry(); f.detectChanges();
    expect(f.nativeElement.querySelector('[aria-label="Loading doctors"]')).not.toBeNull();
    doctors.next([]); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Doctors could not be loaded');
    expect(f.nativeElement.textContent).toContain('No doctors listed yet');
  });
});
