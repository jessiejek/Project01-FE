import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LoadingController } from '@ionic/angular/standalone';
import { of, Subject } from 'rxjs';
import { AppComponent } from './app.component';
import { ApiService } from './core/services/api.service';
import { ClinicSettingsService } from './core/services/clinic-settings.service';

describe('AppComponent (isolated; no backend)', () => {
  let api: jasmine.SpyObj<ApiService>;
  let settings: jasmine.SpyObj<ClinicSettingsService>;
  beforeEach(async () => {
    api = jasmine.createSpyObj('ApiService', ['get']);
    api.get.and.returnValue(of(null));
    settings = jasmine.createSpyObj('ClinicSettingsService', ['load', 'setSettings']);
    settings.load.and.returnValue({} as any);
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ClinicSettingsService, useValue: settings },
        { provide: Router, useValue: { events: new Subject() } },
        { provide: LoadingController, useValue: jasmine.createSpyObj('LoadingController', ['create']) }
      ]
    }).overrideComponent(AppComponent, { set: { imports: [], template: '<main>Clinic application</main>' } }).compileComponents();
  });
  it('creates the app shell', () => {
    expect(TestBed.createComponent(AppComponent).componentInstance).toBeTruthy();
  });
  it('loads settings only through the injected mock', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(api.get).toHaveBeenCalledOnceWith('settings');
    expect(settings.setSettings).toHaveBeenCalled();
  });
});
