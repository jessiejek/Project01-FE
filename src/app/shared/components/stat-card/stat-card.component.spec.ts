import { TestBed } from '@angular/core/testing';
import { StatCardComponent } from './stat-card.component';
describe('Shared metric card', () => {
  beforeEach(async () => { await TestBed.configureTestingModule({ imports: [StatCardComponent] }).compileComponents(); });
  it('uses a neutral surface unless an accent is requested', () => {
    const f = TestBed.createComponent(StatCardComponent);
    f.componentRef.setInput('label', 'Appointments'); f.componentRef.setInput('value', 12); f.detectChanges();
    expect(f.nativeElement.querySelector('.stat-card--neutral')).not.toBeNull();
    expect(f.nativeElement.querySelector('.stat-card__value').textContent).toContain('12');
  });
  it('never presents a loading metric as zero', () => {
    const f = TestBed.createComponent(StatCardComponent);
    f.componentRef.setInput('value', 0); f.componentRef.setInput('loading', true); f.componentRef.setInput('badgeLabel', 'Collect payment'); f.detectChanges();
    expect(f.nativeElement.querySelector('article').getAttribute('aria-busy')).toBe('true');
    expect(f.nativeElement.querySelector('.stat-card__value').textContent).toBe('—');
    expect(f.nativeElement.querySelector('.stat-card__hint')).toBeNull();
  });
});
