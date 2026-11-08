import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeroSectionComponent } from './hero-section.component';

describe('Clinic hero', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HeroSectionComponent], providers: [provideRouter([])] }).compileComponents();
  });
  it('describes the clinic and makes booking the primary action', () => {
    const fixture = TestBed.createComponent(HeroSectionComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Family medicine');
    expect(el.querySelector('.hero__cta-primary')?.getAttribute('href')).toBe('/public/booking');
    expect(el.querySelector('.hero__trust')).toBeNull();
    expect(el.textContent).not.toContain('3 Specialist Doctors');
  });
});
