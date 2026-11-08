import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { ApiService } from './core/services/api.service';
import { AuthStateService } from './core/services/auth-state.service';
import { AuthService, AuthUserDto } from './core/services/auth.service';
import { TokenService } from './core/services/token.service';

function initializeAuthSession(
  authState: AuthStateService,
  apiService: ApiService,
  tokenService: TokenService,
  authService: AuthService
): () => Promise<void> {
  return async () => {
    const hasTokens = tokenService.hasAccessToken() || tokenService.hasRefreshToken();
    if (!hasTokens) {
      authState.logout();
      return;
    }

    try {
      const user = await firstValueFrom(apiService.get<AuthUserDto>('auth/me'));
      const authUser = authService.toAuthUser(user, tokenService.getAccessToken() ?? undefined);
      authState.setUser(authUser);
    } catch {
      authState.logout();
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: initializeAuthSession,
      deps: [AuthStateService, ApiService, TokenService, AuthService]
    },
    {
      provide: DATE_PIPE_DEFAULT_OPTIONS,
      useValue: { dateFormat: 'MMMM d, y (EEE)' }
    },
    provideIonicAngular({ animated: typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches }),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes)
  ]
};
