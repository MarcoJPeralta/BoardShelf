import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';

import { authGuard } from './auth-guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  const currentUser = signal<object | null>(null);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { currentUser, waitForAuthInitialization: () => Promise.resolve() },
        },
      ],
    });
  });

  it('should let signed-in users through', async () => {
    currentUser.set({});
    expect(await TestBed.runInInjectionContext(() => authGuard())).toBe(true);
  });

  it('should send guests to the landing page', async () => {
    currentUser.set(null);
    const result = await TestBed.runInInjectionContext(() => authGuard());
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe('/');
  });
});
