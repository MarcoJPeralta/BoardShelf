import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';

import { guestGuard } from './guest-guard';
import { AuthService } from '../services/auth.service';

describe('guestGuard', () => {
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

  it('should let guests through', async () => {
    currentUser.set(null);
    expect(await TestBed.runInInjectionContext(() => guestGuard())).toBe(true);
  });

  it('should send signed-in users to the library', async () => {
    currentUser.set({});
    const result = await TestBed.runInInjectionContext(() => guestGuard());
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe('/library');
  });
});
